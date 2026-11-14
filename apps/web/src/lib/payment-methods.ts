// Sáu cách nhận tiền của chủ hội ở Cài đặt, Nhận tiền, và cách người mua thấy chúng. Hàm thuần để test được.
// Chuyển khoản QR và QR tự động qua SePay dùng chung một tài khoản ngân hàng nên mỗi lúc bật một cách; người mua thấy
// cả hai là một ô "Chuyển khoản QR". MoMo, VNPAY, PayPal, Stripe là cổng riêng của chủ hội.
import type { OwnerGateway, PaymentProvider } from '@hoiminh/contracts';

/** Một hàng trong danh sách sáu cách ở màn chủ hội. */
export type OwnerMethodKey = 'bank' | 'sepay_auto' | OwnerGateway;

export const OWNER_METHOD_ORDER: OwnerMethodKey[] = ['bank', 'sepay_auto', 'momo', 'vnpay', 'paypal', 'stripe'];

/** Tên, chữ trên ô logo, màu ô logo, và lời giới thiệu cho chủ hội. */
export const OWNER_METHOD_META: Record<OwnerMethodKey, { name: string; logo: string; bg: string; desc: string }> = {
  bank: { name: 'Chuyển khoản QR', logo: 'QR', bg: '#1F1B17', desc: 'Người mua quét mã bằng app ngân hàng. Bạn kiểm tra tài khoản rồi bấm xác nhận từng đơn.' },
  sepay_auto: { name: 'QR tự động qua SePay', logo: 'SePay', bg: '#1A7F5A', desc: 'Như chuyển khoản QR, nhưng tiền về là đơn tự xác nhận. Nối SePay một lần, khoảng 10 phút.' },
  momo: { name: 'MoMo', logo: 'MoMo', bg: '#A50064', desc: 'Người mua trả trong ví MoMo, tiền về tài khoản MoMo doanh nghiệp của bạn.' },
  vnpay: { name: 'VNPAY', logo: 'VNPAY', bg: '#0A5EB0', desc: 'Thẻ ATM nội địa, thẻ quốc tế và QR ngân hàng qua cổng VNPAY của bạn.' },
  paypal: { name: 'PayPal', logo: 'PayPal', bg: '#003087', desc: 'Khách quốc tế trả bằng USD vào tài khoản PayPal của bạn, quy đổi theo tỷ giá của Hội Mình.' },
  stripe: { name: 'Thẻ Visa, Mastercard (Stripe)', logo: 'Thẻ', bg: '#635BFF', desc: 'Khách trả bằng thẻ quốc tế qua tài khoản Stripe của bạn.' },
};

/** Tên ngắn của từng cách khi người mua chọn (cũng là chữ trên nút thanh toán). */
export const BUYER_METHOD_NAME: Record<PaymentProvider, string> = { sepay: 'Chuyển khoản QR', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal', stripe: 'Thẻ Visa, Mastercard' };

export interface GatewayState { provider: OwnerGateway; configured: boolean; complete: boolean; missing: string[]; enabled: boolean; mode: 'sandbox' | 'production'; summary: Record<string, string>; webhookUrl: string | null; lastWebhookAt: string | null; updatedAt: string | null }
interface BankLike { enabled: boolean; confirmMode: 'manual' | 'auto'; lastWebhookAt: string | null }
export interface MethodsSetup { account: BankLike | null; gateways: GatewayState[]; methods: PaymentProvider[]; defaultMethod: PaymentProvider | null }

/**
 * Trạng thái một hàng:
 * - `off_unset`: chưa cài.
 * - `incomplete`: đã lưu khóa nhưng còn thiếu bước webhook, người mua chưa thấy.
 * - `off`: đã cài nhưng đang tắt (hoặc cách chuyển khoản kia đang bật).
 * - `on`: người mua đang thấy cách này.
 */
export type RowState = 'off_unset' | 'incomplete' | 'off' | 'on';

export interface OwnerRow { key: OwnerMethodKey; buyerKey: PaymentProvider; state: RowState; isDefault: boolean; gateway: GatewayState | null }

/** Cách người mua trả tương ứng với một hàng. */
export const buyerKeyOf = (key: OwnerMethodKey): PaymentProvider => (key === 'bank' || key === 'sepay_auto' ? 'sepay' : key);

/** Sáu hàng ở màn chủ hội, theo đúng thứ tự, kèm trạng thái và dấu mặc định. */
export function ownerRows(s: MethodsSetup): OwnerRow[] {
  return OWNER_METHOD_ORDER.map((key) => {
    const buyerKey = buyerKeyOf(key);
    if (key === 'bank' || key === 'sepay_auto') {
      const a = s.account;
      const mode = key === 'bank' ? 'manual' : 'auto';
      const state: RowState = !a ? 'off_unset' : a.enabled && a.confirmMode === mode ? 'on' : 'off';
      return { key, buyerKey, state, isDefault: state === 'on' && s.defaultMethod === 'sepay', gateway: null };
    }
    const g = s.gateways.find((x) => x.provider === key) ?? null;
    const state: RowState = !g?.configured ? 'off_unset' : !g.complete ? 'incomplete' : g.enabled ? 'on' : 'off';
    return { key, buyerKey, state, isDefault: state === 'on' && s.defaultMethod === key, gateway: g };
  });
}

/** Dòng tóm tắt cho chủ hội: người mua đang thấy những cách nào, cách nào chọn sẵn. */
export function buyerSummary(s: Pick<MethodsSetup, 'methods' | 'defaultMethod'>): string {
  if (!s.methods.length) return '';
  return s.methods.map((m) => (m === s.defaultMethod && s.methods.length > 1 ? `${BUYER_METHOD_NAME[m]} (chọn sẵn)` : BUYER_METHOD_NAME[m])).join(', ');
}

/** Cách chọn sẵn ở bước thanh toán: cách mặc định nếu còn trong danh sách, không thì cách đầu tiên. */
export function initialMethod(methods: PaymentProvider[], defaultMethod: PaymentProvider | null | undefined): PaymentProvider | null {
  return defaultMethod && methods.includes(defaultMethod) ? defaultMethod : methods[0] ?? null;
}
