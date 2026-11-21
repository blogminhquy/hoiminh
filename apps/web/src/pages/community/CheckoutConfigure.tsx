// Bước chọn: /:slug/thanh-toan?tier=premium&months=3 hoặc ?product=<id> → chọn kỳ hạn, cách thanh toán, mã giảm giá → POST /v1/checkout.
// Một cột từ trên xuống: đầu trang, chọn thời hạn, quyền lợi, cách thanh toán, mã giảm giá, bảng tiền, nút thanh toán.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CommunityMark, T, money } from '@hoiminh/ui';
import { Check, Lock, ShieldCheck, Tag } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import type { Shell } from '@/lib/community';
import { modeChoices, promoEndLabel, type TermChoice } from '@/lib/membership';
import { BUYER_METHOD_NAME, initialMethod } from '@/lib/payment-methods';
import { CheckoutFrame, ProviderOption, RadioRow, RadioRows, Section, Totals, providerMeta, type Provider } from './CheckoutParts';

/** Lời giới thiệu từng cách ở bước thanh toán của hội: nói rõ tiền về thẳng chủ hội. */
function buyerDesc(k: Provider, community: string, bankMode: 'manual' | 'auto' | null): string {
  if (k === 'sepay') return bankMode === 'auto' ? `Quét bằng app ngân hàng, tiền chuyển thẳng tới chủ hội ${community}, mở quyền ngay khi tiền về` : `Quét bằng app ngân hàng, tiền chuyển thẳng tới chủ hội ${community}`;
  if (k === 'momo') return 'Xác nhận ngay trong ví MoMo, tiền về thẳng chủ hội';
  if (k === 'vnpay') return 'Thẻ ATM nội địa, thẻ quốc tế hoặc QR ngân hàng';
  if (k === 'paypal') return 'Trả bằng USD qua PayPal, hợp với khách ở nước ngoài';
  return 'Thẻ quốc tế, thanh toán an toàn qua Stripe';
}

/** Nút thanh toán: cao, chữ được xuống dòng khi tên cách thanh toán dài (điện thoại hẹp) thay vì tràn ra ngoài nút. */
const PAY_BUTTON: CSSProperties = { height: 'auto', minHeight: 56, whiteSpace: 'normal', padding: '8px 12px', fontSize: 16, lineHeight: 1.25, textAlign: 'center' };

interface ProductLite { id: string; name: string; priceMinor: number; compareAtMinor: number | null; kind: string; slug: string }
interface ProductList { items: ProductLite[] }

/**
 * Một lựa chọn thời hạn: một hàng rộng hết bề ngang. Bên trái là tên và nhãn tiết kiệm (nằm gọn trong hàng), bên phải
 * là tổng tiền in đậm, dưới đó là giá quy ra mỗi tháng.
 */
function TermRow({ x, on, onClick }: { x: TermChoice; on: boolean; onClick: () => void }) {
  const sub = x.months && x.months > 1 ? `${money(Math.round(x.payMinor / x.months))} mỗi tháng` : x.months ? '' : 'một lần';
  return (
    <RadioRow on={on} onClick={onClick}>
      <span className="flex-1 min-w-[6rem] flex items-center flex-wrap gap-x-2.5 gap-y-1">
        <span className="text-[17px] font-semibold whitespace-nowrap">{x.months ? `${x.months} tháng` : 'Trọn đời'}</span>
        {x.savingPercent > 0 && <span className="tag" style={{ background: T.goldSoft, color: T.goldDark }}>Rẻ hơn {x.savingPercent}%</span>}
      </span>
      {/* Màn hình hẹp mà giá dài (đang khuyến mãi): giá gốc gạch đi tự xuống dòng riêng phía trên, không tràn ra ngoài hàng. */}
      <span className="min-w-0 flex flex-col items-end text-right">
        <span className="flex flex-wrap justify-end items-baseline gap-x-2">{x.percentOff > 0 && <span className="line-through text-[14px] whitespace-nowrap" style={{ color: T.ink3 }}>{money(x.listMinor)}</span>}<strong className="text-[17px] whitespace-nowrap">{money(x.payMinor)}</strong></span>
        {sub && <span className="text-[14px] whitespace-nowrap" style={{ color: T.ink2 }}>{sub}</span>}
      </span>
    </RadioRow>
  );
}

/** Lựa chọn mở sẵn: đúng số tháng trên đường dẫn nếu có, không thì theo `cycle` kiểu cũ, không thì kỳ ngắn nhất. */
function initialChoice(list: TermChoice[], cycle: string | null, months: string | null): number | null {
  const want = cycle === 'one_time' ? null : Number(months) || (cycle === 'yearly' ? 12 : cycle === 'monthly' ? 1 : 0);
  return (list.find((x) => x.months === want) ?? list[0])?.months ?? null;
}

export function CheckoutConfigure({ shell, tierKey, productId, initialCycle, initialMonths, ref }: { shell: Shell; tierKey: string | null; productId: string | null; initialCycle: string | null; initialMonths: string | null; ref: string | null }) {
  const navigate = useNavigate();
  const c = shell.community;
  const premium = shell.premium;
  const choices = modeChoices(premium, c.pricingMode);
  const [months, setMonths] = useState<number | null>(() => initialChoice(choices, initialCycle, initialMonths));
  const choice = choices.find((x) => x.months === months) ?? choices[0] ?? null;
  // Đơn của hội: tiền về thẳng chủ hội, bằng chuyển khoản QR hoặc qua cổng riêng của chủ hội. Người mua chỉ thấy cách
  // chủ hội đã cài và đang bật; cách chủ hội đặt làm mặc định được chọn sẵn.
  const methods = c.paymentMethods ?? [];
  const [picked, setPicked] = useState<Provider | null>(null);
  const provider: Provider | null = picked && methods.includes(picked) ? picked : initialMethod(methods, c.defaultPaymentMethod);
  const ready = c.paymentsReady && provider !== null;
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const products = useQuery({ queryKey: ['products', c.id], queryFn: () => api.get<ProductList>(`/v1/communities/${c.id}/products`), enabled: Boolean(productId) });
  const product = productId ? products.data?.items.find((p) => p.id === productId || p.slug === productId) ?? null : null;

  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', {
      target: product ? { type: 'product', productId: product.id } : { type: 'tier', communityId: c.id, tierKey: tierKey ?? 'premium', ...(choice?.months ? { cycle: choice.months === 12 ? 'yearly' : 'monthly', months: choice.months } : { cycle: 'one_time' }) },
      provider: provider ?? undefined, couponCode: applied ?? undefined, ref: ref ?? undefined,
    }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });

  if (productId && products.isLoading) return <CheckoutFrame backTo={`/${c.slug}/cua-hang`}><LoadingBlock /></CheckoutFrame>;
  const listAmount = product ? product.priceMinor : choice?.listMinor ?? 0;
  const amount = product ? product.priceMinor : choice?.payMinor ?? 0;
  const promo = !product && choice && choice.percentOff > 0 ? premium?.promo ?? null : null;
  const promoEnd = promoEndLabel(promo);
  const title = product ? product.name : 'Gói Premium';
  const line = product ? product.name : `Premium · ${choice?.months ? `${choice.months} tháng` : 'trọn đời'}`;
  const benefits = product ? ['Truy cập trọn đời', 'Cập nhật miễn phí', 'Hoàn tiền 7 ngày nếu xem chưa quá 20%'] : premium?.benefits ?? [];

  return (
    <CheckoutFrame backTo={product ? `/${c.slug}/cua-hang` : `/${c.slug}/bang-tin`}>
      <div className="flex gap-3.5 items-center">
        <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={56} radius={14} />
        <div className="min-w-0"><div className="text-[14px]" style={{ color: T.ink2 }}>{product ? 'Mua tại' : 'Nâng cấp tại'} {c.name}</div><h1 className="serif text-[24px] leading-tight font-extrabold">{title}</h1></div>
      </div>
      {!product && promo && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-semibold" style={{ background: T.goldSoft, color: T.goldDark }}><Tag size={18} className="flex-shrink-0" />Đang giảm {promo.percentOff}%{promoEnd ? ` đến hết ngày ${promoEnd}` : ''}</div>
      )}
      {!product && choices.length > 0 && (
        <Section title={choices.length > 1 ? 'Chọn thời hạn' : 'Thời hạn'}>
          <RadioRows label="Thời hạn">
            {choices.map((x) => <TermRow key={x.months ?? 'once'} x={x} on={choice?.months === x.months} onClick={() => setMonths(x.months)} />)}
          </RadioRows>
        </Section>
      )}
      {benefits.length > 0 && (
        <Section title={product ? 'Bạn nhận được' : 'Quyền lợi của gói'}>
          <ul className="card px-4 py-3.5 md:px-5 flex flex-col gap-2.5 text-[15px]">
            {benefits.map((b) => <li key={b} className="flex items-start gap-2.5 leading-snug"><Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: T.teal }} />{b}</li>)}
          </ul>
        </Section>
      )}
      <Section title="Cách thanh toán">
        {ready ? (
          <RadioRows label="Cách thanh toán">
            {methods.map((k) => <ProviderOption key={k} p={{ ...providerMeta(k), desc: buyerDesc(k, c.name, c.bankConfirmMode) }} on={provider === k} onClick={() => setPicked(k)} />)}
          </RadioRows>
        ) : (
          <div className="px-4 py-3 rounded-xl text-[15px] leading-snug" style={{ background: T.goldSoft, color: T.goldDark }}>{shell.viewer.permissions.includes('billing.manage')
            ? <>Bạn chưa cài cách nhận tiền nào. <Link to={`/${c.slug}/cai-dat/nhan-tien`} className="font-semibold underline">Cài nhận tiền</Link> để mở nút mua.</>
            : 'Chủ hội chưa cài cách nhận tiền nên chưa mua được. Bạn quay lại sau nhé.'}</div>
        )}
      </Section>
      <Section title="Mã giảm giá">
        <div className="flex gap-2">
          <div className="input flex-1 min-w-0" style={{ width: 'auto', height: 48 }}><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Mã giảm giá" aria-label="Mã giảm giá" autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="flex-grow" /></div>
          <Button className="flex-shrink-0" style={{ height: 48 }} onClick={() => setApplied(coupon.trim() || null)}>{applied ? 'Đã áp dụng' : 'Áp dụng'}</Button>
        </div>
        {applied && <div className="text-[14px]" style={{ color: T.ink2 }}>Mã {applied} sẽ được kiểm tra khi tạo đơn.</div>}
      </Section>
      <Section title="Tóm tắt đơn">
        <Totals lines={[{ label: line, amountMinor: listAmount }, { label: promo ? `Khuyến mãi ${promo.percentOff}%` : 'Giảm giá', amountMinor: amount - listAmount }]} total={amount} referredBy={null} totalOnDesktopOnly />
      </Section>
      {/* Tổng tiền và nút thanh toán. Điện thoại: ghim dưới đáy màn hình (sticky) để lúc nào cũng bấm được; cuộn tới cuối
          trang thì thanh nằm lại đúng chỗ của nó nên không che dòng nào. Trang này nằm ngoài khung hội, không có thanh
          điều hướng dưới để đè lên. Máy tính: nút rộng hết cột, ngay dưới bảng tiền. */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_-6px_18px_rgba(8,24,23,0.07)] md:static md:mx-0 md:p-0 md:border-0 md:bg-transparent md:shadow-none">
        {m.isError && <div role="alert" className="text-[15px] leading-snug" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        <div className="flex items-center gap-3">
          <div className="md:hidden flex-shrink-0"><div className="leading-tight" style={{ color: T.ink2, fontSize: 15 }}>Tổng tiền</div><div className="serif text-[20px] leading-tight font-extrabold whitespace-nowrap">{money(amount)}</div></div>
          {ready ? (
            <Button variant="primary" size="lg" loading={m.isPending} disabled={!amount} onClick={() => m.mutate()} className="flex-1 min-w-0" style={PAY_BUTTON}>{provider === 'sepay' ? 'Lấy mã QR chuyển khoản' : `Thanh toán ${money(amount)} bằng ${BUYER_METHOD_NAME[provider!]}`}</Button>
          ) : (
            <Button size="lg" disabled className="flex-1 min-w-0" style={PAY_BUTTON} icon={<Lock size={18} className="flex-shrink-0" />}>Hội chưa mở thanh toán</Button>
          )}
        </div>
      </div>
      <div className="text-[14px] leading-snug flex items-start justify-center gap-1.5" style={{ color: T.ink2 }}><ShieldCheck size={18} className="flex-shrink-0 mt-0.5" /><span>Hội Mình không thu phí giao dịch và không giữ tiền của bạn</span></div>
    </CheckoutFrame>
  );
}
