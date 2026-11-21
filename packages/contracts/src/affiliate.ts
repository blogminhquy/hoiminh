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

/** Thành viên tự đổi người giới thiệu: `code` nhận mã giới thiệu, cả link có `?ref=`, hoặc email của người giới thiệu. */
export const setReferrerSchema = z.object({ code: z.string().trim().min(2).max(300) });

/** Người giới thiệu của tôi trong một hội. `enabled`: hội đang bật affiliate; `active`: tài khoản affiliate của người đó còn hoạt động. */
export interface MyReferrer { enabled: boolean; referrer: { name: string; handle: string; avatarUrl: string | null; coverColor: string | null; code: string; active: boolean } | null }

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
