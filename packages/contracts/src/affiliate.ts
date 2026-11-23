// Hợp đồng affiliate: ví, tài khoản nhận tiền, yêu cầu rút, xếp hạng.
import { z } from 'zod';
import { amountMinorSchema, idSchema } from './common';

export const walletEntryTypeSchema = z.enum(['credit', 'hold', 'release', 'debit', 'adjustment']);
export type WalletEntryType = z.infer<typeof walletEntryTypeSchema>;

export const commissionStatusSchema = z.enum(['pending', 'available', 'reversed', 'paid']);
export type CommissionStatus = z.infer<typeof commissionStatusSchema>;

export const withdrawalStatusSchema = z.enum(['requested', 'reviewing', 'paid', 'rejected', 'cancelled']);
export type WithdrawalStatus = z.infer<typeof withdrawalStatusSchema>;

export const programScopeSchema = z.enum(['platform', 'community']);

export const VIETNAM_BANKS = [
  { code: 'VCB', name: 'Vietcombank', bin: '970436' },
  { code: 'TCB', name: 'Techcombank', bin: '970407' },
  { code: 'MB', name: 'MB Bank', bin: '970422' },
  { code: 'ACB', name: 'ACB', bin: '970416' },
  { code: 'VTB', name: 'Vietinbank', bin: '970415' },
  { code: 'BIDV', name: 'BIDV', bin: '970418' },
  { code: 'TPB', name: 'TPBank', bin: '970423' },
  { code: 'VPB', name: 'VPBank', bin: '970432' },
  { code: 'STB', name: 'Sacombank', bin: '970403' },
  { code: 'AGR', name: 'Agribank', bin: '970405' },
] as const;
export const bankCodeSchema = z.enum(['VCB', 'TCB', 'MB', 'ACB', 'VTB', 'BIDV', 'TPB', 'VPB', 'STB', 'AGR']);

export const payoutProfileInputSchema = z.object({
  bankCode: bankCodeSchema,
  accountNumber: z.string().trim().regex(/^\d{6,20}$/),
  accountHolder: z.string().trim().min(3).max(80).transform((s) => s.toUpperCase()),
});
export type PayoutProfileInput = z.infer<typeof payoutProfileInputSchema>;

export const requestWithdrawalSchema = z.object({
  programId: idSchema,
  amountMinor: amountMinorSchema.min(1),
});

export const markPaidSchema = z.object({ transferReference: z.string().trim().min(4).max(64), version: z.number().int() });
export const rejectWithdrawalSchema = z.object({ reason: z.string().trim().min(3).max(300), version: z.number().int() });

/** Số mã giới thiệu tối đa một người xem mang theo (cookie và các trường `ref`). */
export const REF_CODES_MAX = 8;

/** Một phần tử trong danh sách mã: `mã`, hoặc `mã.phạm-vi` (phạm vi là trang mà link được mở). */
const REF_TOKEN = /^[a-z0-9_-]{1,32}(?:\.[a-z0-9_-]{1,48})?$/;

/**
 * Các mã giới thiệu một người đang mang theo, mới bấm đứng trước. Một người có thể được nhiều affiliate giới thiệu
 * tới nhiều hội khác nhau (và tới nền tảng), nên cookie và các trường `ref` chứa một DANH SÁCH mã cách nhau bằng dấu
 * phẩy, không phải một mã. Mỗi hội chỉ nhận mã của chương trình hội đó; mã mới nhất của hội đó thắng (last click).
 * Mỗi phần tử là `mã` hoặc `mã.phạm-vi`: phạm vi là trang mà link được mở (xem refScopeOf), cần cho MÃ CHUNG của một
 * người, vì mã chung dùng cho mọi chương trình nên phải biết link được mở ở trang nào mới tính đúng chương trình.
 */
export function refCodes(...parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    for (const raw of (part ?? '').split(',')) {
      const code = raw.trim().toLowerCase();
      if (code && REF_TOKEN.test(code) && !out.includes(code)) out.push(code);
    }
  }
  return out.slice(0, REF_CODES_MAX);
}

/** Phạm vi của một trang không thuộc hội nào (trang chủ, trang mở hội, trang đăng ký trơn): tính cho chương trình nền tảng. */
export const REF_PLATFORM_SCOPE = '_';

/**
 * Phạm vi của trang đang mở, để gắn vào mã giới thiệu đọc từ link. Trang của một hội (`/javiser`,
 * `/javiser/cua-hang/khoa-a`) có phạm vi là đoạn đầu của đường dẫn; trang đăng ký đi từ một hội (`?hoi=javiser`) lấy
 * theo hội đó; trang chủ lấy REF_PLATFORM_SCOPE. Máy chủ mới là nơi quyết định đoạn đó có phải một hội hay không
 * (không phải hội thì tính cho nền tảng), nên ở đây không cần biết danh sách hội.
 */
export function refScopeOf(pathname: string, hoi?: string | null): string {
  const pick = (v: string | null | undefined) => {
    const s = (v ?? '').trim().toLowerCase();
    return /^[a-z0-9-]{1,48}$/.test(s) ? s : null;
  };
  return pick(hoi) ?? pick(pathname.split('/').find(Boolean)) ?? REF_PLATFORM_SCOPE;
}

/** Gắn phạm vi cho các mã vừa đọc từ link. Mã đã có phạm vi (được chuyển tiếp từ một trang khác) thì giữ nguyên. */
export function scopeRefs(raw: string | null | undefined, scope: string): string | undefined {
  return refCodes(...refCodes(raw).map((t) => (t.includes('.') ? t : `${t}.${scope}`))).join(',') || undefined;
}

/** Tách `mã.phạm-vi`. Không có phạm vi (mã gõ tay, cookie cũ) thì `scope` là null. */
export function splitRef(token: string): { code: string; scope: string | null } {
  const i = token.indexOf('.');
  return i < 0 ? { code: token, scope: null } : { code: token.slice(0, i), scope: token.slice(i + 1) };
}

/** Mã giới thiệu chung do người dùng tự chọn: 3 đến 20 ký tự, chỉ chữ thường không dấu và số. */
export const REFERRAL_CODE_PATTERN = /^[a-z0-9]{3,20}$/;
export const setReferralCodeSchema = z.object({ code: z.string().trim().toLowerCase().regex(REFERRAL_CODE_PATTERN, 'Mã gồm 3 đến 20 ký tự, chỉ dùng chữ không dấu và số') });

/** Gộp các nguồn mã (mã trên link trước, rồi mã đã nhớ) thành một chuỗi để gửi đi; không có mã nào thì undefined. */
export function joinRefs(...parts: Array<string | null | undefined>): string | undefined {
  return refCodes(...parts).join(',') || undefined;
}

/** Thành viên tự đổi người giới thiệu: `code` nhận mã giới thiệu, cả link có `?ref=`, hoặc email của người giới thiệu. */
export const setReferrerSchema = z.object({ code: z.string().trim().min(2).max(300) });

/** Người giới thiệu của tôi trong một hội. `enabled`: hội đang bật affiliate; `active`: tài khoản affiliate của người đó còn hoạt động. */
export interface MyReferrer { enabled: boolean; referrer: { name: string; handle: string; avatarUrl: string | null; coverColor: string | null; code: string; active: boolean } | null }

/**
 * Chia sẻ khóa học ở thư viện khóa học. `courses`: khóa bán lẻ có tính hoa hồng, kèm số tiền tôi nhận mỗi đơn.
 * `monthlyCommissionMinor`: số tiền tôi nhận mỗi tháng khi người được mời đóng phí gói thành viên rẻ nhất (null khi hội
 * không có gói trả phí). `durationMonths`: số tháng đầu được tính, null là không giới hạn. `programId`: để mở thẳng ví của
 * chương trình này ở trang Tài khoản → Affiliate.
 */
export interface CourseShareOffer { enabled: boolean; programId: string | null; durationMonths: number | null; monthlyCommissionMinor: number | null; courses: Array<{ courseId: string; priceMinor: number; commissionMinor: number }> }
/** Link chia sẻ kèm mã của tôi. `courseUrl` null khi khóa không bán lẻ có hoa hồng. */
export interface CourseShareLinks { code: string; communityUrl: string; courseUrl: string | null }
export const courseShareLinksSchema = z.object({ courseId: idSchema.nullable().default(null) });

export const leaderboardQuerySchema = z.object({ period: z.enum(['month', 'quarter', 'all']).default('month') });

export const walletSummarySchema = z.object({
  programId: idSchema,
  programName: z.string(),
  scope: programScopeSchema,
  affiliateCode: z.string(),
  link: z.string(),
  commissionRateBps: z.number(),
  holdDays: z.number(),
  minWithdrawalMinor: z.number(),
  pendingMinor: z.number(),
  availableMinor: z.number(),
  requestedMinor: z.number(),
  paidMinor: z.number(),
  clicks: z.number(),
  signups: z.number(),
  paid: z.number(),
  maskedAccount: z.string().nullable(),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;
