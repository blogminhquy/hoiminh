// Trang Tài khoản → Affiliate: kiểu dữ liệu và phần tính toán không dính giao diện (chọn chương trình mở sẵn, câu
// mô tả hoa hồng, hoa hồng ước tính của một sản phẩm, sao chép link).
export interface AffiliateProgram {
  id: string;
  name: string;
  scope: 'platform' | 'community';
  community: { name: string; slug: string; logoMark: string; logoColor: string; logoUrl: string | null } | null;
  rateBps: number;
  /** Số tháng đầu được tính hoa hồng; null là trọn đời. */
  durationMonths: number | null;
  /** Chương trình đang bật: link đang tính hoa hồng. */
  enabled: boolean;
  /** Tôi có quyền bật chương trình này (chủ hội, quản trị). */
  canManage: boolean;
  /** Tôi đã có ví trong chương trình này. */
  hasAccount: boolean;
}

export interface LinkTarget {
  key: string;
  kind: 'platform' | 'community' | 'product';
  label: string;
  url: string;
  productKind: 'course' | 'bundle' | 'digital' | null;
  priceMinor: number | null;
  /** false: sản phẩm gắn khóa học mà chủ hội đã tắt hoa hồng bán lẻ. */
  commission: boolean;
}

const REMEMBER_KEY = 'hm_affiliate_program';

/** Chương trình mở lần gần nhất trên máy này. */
export function readRememberedProgram(): string | null {
  try { return localStorage.getItem(REMEMBER_KEY); } catch { return null; }
}

export function rememberProgram(id: string): void {
  try { localStorage.setItem(REMEMBER_KEY, id); } catch { /* chế độ riêng tư: lần sau mở chương trình mặc định */ }
}

/**
 * Chương trình mở sẵn khi vào trang mà đường dẫn chưa nêu chương trình nào: chương trình mở lần trước (nếu còn trong
 * danh sách), không có thì hội đang bật mà tôi đã có ví (nơi tôi đang kiếm hoa hồng), không có nữa thì chương trình
 * đầu danh sách (nền tảng).
 */
export function defaultProgramId(programs: AffiliateProgram[], remembered: string | null): string | null {
  if (remembered && programs.some((p) => p.id === remembered)) return remembered;
  return (programs.find((p) => p.scope === 'community' && p.enabled && p.hasAccount) ?? programs[0])?.id ?? null;
}

/** "40%", "12,5%". */
export function ratePercent(rateBps: number): string {
  return `${String(rateBps / 100).replace('.', ',')}%`;
}

/** Một câu nói rõ tôi nhận được gì khi chia sẻ link của chương trình này. */
export function earnLine(p: Pick<AffiliateProgram, 'scope' | 'rateBps' | 'durationMonths' | 'name'>): string {
  const rate = ratePercent(p.rateBps);
  const span = p.durationMonths ? ` trong ${p.durationMonths} tháng đầu` : '';
  return p.scope === 'platform'
    ? `Nhận ${rate} hoa hồng mỗi lần người bạn mời trả tiền gói Hội Mình${span || ', trọn đời'}.`
    : `Nhận ${rate} hoa hồng mỗi lần người bạn mời trả phí trong ${p.name}${span}.`;
}

/** Hoa hồng ước tính của một đơn theo giá niêm yết: cùng cách làm tròn xuống với máy chủ. */
export function estimateCommission(priceMinor: number | null, rateBps: number): number {
  return priceMinor ? Math.floor((priceMinor * rateBps) / 10_000) : 0;
}

/** Lọc danh sách trang theo chữ người dùng gõ, không phân biệt hoa thường và dấu. */
export function filterTargets(targets: LinkTarget[], query: string): LinkTarget[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const q = fold(query.trim());
  return q ? targets.filter((t) => fold(t.label).includes(q)) : targets;
}

/**
 * Sao chép chữ vào bộ nhớ tạm. Trang không chạy HTTPS hoặc trình duyệt cũ không có navigator.clipboard thì chép qua
 * một ô chữ tạm. Trả về false khi cả hai cách đều không được, để giao diện nhắc người dùng tự bôi đen link.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* thử cách dưới */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Thứ người dùng gõ vào ô mã giới thiệu: viết thường, bỏ dấu tiếng Việt, bỏ mọi ký tự không phải chữ và số, cắt còn 20 ký tự. */
export function cleanCodeInput(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '').slice(0, 20);
}
