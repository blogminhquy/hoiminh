// Đối tác chính thức (Hệ thống · Đối tác): chữ hiển thị điều khoản và chuyển qua lại giữa ô nhập với dữ liệu gửi lên.
// Hàm thuần để test được.
export type PartnerDurationMode = 'program' | 'months' | 'lifetime';

export interface PartnerItem {
  id: string;
  status: 'active' | 'ended';
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  user: { id: string; name: string; email: string; handle: string | null; avatarUrl: string | null; coverColor: string | null };
  affiliateAccountId: string;
  code: string;
  commissionRateBps: number | null;
  effectiveRateBps: number;
  durationMode: PartnerDurationMode;
  commissionDurationMonths: number | null;
  effectiveDurationMonths: number | null;
  stats: { clicks: number; signups: number; paidCustomers: number; grossMinor: number; commissionMinor: number };
}

export interface PartnerList { program: { commissionRateBps: number; commissionDurationMonths: number | null }; items: PartnerItem[] }

/** "12 tháng đầu" hoặc "trọn đời". */
export const durationText = (months: number | null) => (months === null ? 'trọn đời' : `${months} tháng đầu`);

/** Mức chung của chương trình, ghi gọn: "40% trong 12 tháng đầu". */
export const programTermsText = (p: PartnerList['program']) => `${p.commissionRateBps / 100}% trong ${durationText(p.commissionDurationMonths)}`.replace('trong trọn đời', 'trọn đời');

/** Điều khoản thực tế của một đối tác: "50% · trọn đời", kèm cho biết phần nào là riêng. */
export function partnerTermsText(p: Pick<PartnerItem, 'effectiveRateBps' | 'effectiveDurationMonths'>): string {
  return `${p.effectiveRateBps / 100}% · ${durationText(p.effectiveDurationMonths)}`;
}

/** Lựa chọn thời hạn trong ô chọn. Giá trị: 'program', 'lifetime' hoặc số tháng ('6', '12', ...). */
export const DURATION_CHOICES = ['program', '6', '12', '24', '36', 'lifetime'] as const;

export function durationChoiceLabel(choice: string, programMonths: number | null): string {
  if (choice === 'program') return `Theo mức chung (${durationText(programMonths)})`;
  if (choice === 'lifetime') return 'Trọn đời';
  return `${choice} tháng đầu`;
}

export function choiceOf(mode: PartnerDurationMode, months: number | null): string {
  if (mode === 'months' && months) return String(months);
  return mode === 'lifetime' ? 'lifetime' : 'program';
}

export function termsOfChoice(choice: string): { durationMode: PartnerDurationMode; commissionDurationMonths: number | null } {
  if (choice === 'program' || choice === 'lifetime') return { durationMode: choice, commissionDurationMonths: null };
  return { durationMode: 'months', commissionDurationMonths: Number(choice) };
}

/**
 * Ô "% hoa hồng riêng" là chữ người dùng gõ ("50", "37,5"). Trống là theo mức chung (null). Ngoài 0-90 hoặc không
 * phải số thì trả lỗi để hiện ngay dưới ô, không gửi lên.
 */
export function parseRatePercent(text: string): { ok: true; bps: number | null } | { ok: false; error: string } {
  const t = text.trim().replace(',', '.');
  if (!t) return { ok: true, bps: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 90) return { ok: false, error: 'Nhập từ 0 đến 90 (%), hoặc để trống để theo mức chung.' };
  return { ok: true, bps: Math.round(n * 100) };
}

export const ratePercentText = (bps: number | null) => (bps === null ? '' : String(bps / 100));
