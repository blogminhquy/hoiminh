// Rút tiền cộng sự chi trả thủ công (mục 201): tài khoản nhận mã hóa, yêu cầu có snapshot, hold/release/debit, optimistic lock, QR chuyển khoản.
import { decryptJson, encryptJson, maskAccount } from '@hoiminh/config';
import { VIETNAM_BANKS, type PayoutProfileInput } from '@hoiminh/contracts';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliateCommissions, affiliatePayoutProfiles, affiliatePrograms, affiliateWithdrawalRequests, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { AppError, conflict, forbidden, invalid, invalidState, notFound } from '../errors';
import { requireCommunityPermission, requireSuperAdmin, requireUser } from '../permissions';
import { ensureAccount, ledgerEntry, walletBalance } from './affiliate';
import { audit } from './audit';

interface PayoutPayload { bankCode: string; bankName: string; accountNumber: string; accountHolder: string }

function bankName(code: string): string {
  return VIETNAM_BANKS.find((b) => b.code === code)?.name ?? code;
}

/** Lưu tài khoản nhận tiền (mã hóa AES-GCM), chỉ trả về bản che. */
export async function setPayoutProfile(ctx: Ctx, programId: string, input: PayoutProfileInput) {
  const userId = requireUser(ctx);
  const acc = await ensureAccount(ctx, userId, programId);
  const payload: PayoutPayload = { bankCode: input.bankCode, bankName: bankName(input.bankCode), accountNumber: input.accountNumber, accountHolder: input.accountHolder };
  const masked = maskAccount(payload.bankName, payload.accountNumber);
  const encryptedPayload = await encryptJson(payload, ctx.env.ENCRYPTION_KEY, ctx.env.ENCRYPTION_KEY_VERSION);
  await ctx.db.insert(affiliatePayoutProfiles).values({ affiliateAccountId: acc.id, encryptedPayload, keyVersion: ctx.env.ENCRYPTION_KEY_VERSION, maskedAccount: masked, bankCode: input.bankCode, updatedAt: ctx.now() }).onConflictDoUpdate({ target: affiliatePayoutProfiles.affiliateAccountId, set: { encryptedPayload, keyVersion: ctx.env.ENCRYPTION_KEY_VERSION, maskedAccount: masked, bankCode: input.bankCode, updatedAt: ctx.now() } });
  await audit(ctx, { action: 'payout_profile.update', resourceType: 'affiliate_account', resourceId: acc.id, metadata: { maskedAccount: masked } });
  return { maskedAccount: masked, bankCode: input.bankCode };
}

/** Gửi yêu cầu rút ≥ min_withdrawal. Điều kiện đủ số dư nằm trong cùng transaction với bút toán hold. */
export async function requestWithdrawal(ctx: Ctx, programId: string, amountMinor: number) {
  const userId = requireUser(ctx);
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, programId) });
  if (!program) throw notFound();
  const acc = await ensureAccount(ctx, userId, programId);
  if (amountMinor < program.minWithdrawalMinor) throw invalid(`Mức rút tối thiểu là ${program.minWithdrawalMinor.toLocaleString('vi-VN')}đ`);
  const profile = await ctx.db.query.affiliatePayoutProfiles.findFirst({ where: eq(affiliatePayoutProfiles.affiliateAccountId, acc.id) });
  if (!profile) throw invalid('Hãy nhập tài khoản nhận tiền trước khi rút');
  const wd = await ctx.db.transaction(async (tx) => {
    const r = await raw(tx, 
      sql`select coalesce(sum(case when entry_type in ('credit','release','adjustment') then amount_minor else -amount_minor end),0)::bigint as bal from affiliate_wallet_entries where affiliate_account_id = ${acc.id}`,
    );
    const bal = Number((r[0] as { bal: string }).bal);
    if (bal < amountMinor) throw new AppError('insufficient_balance', `Số dư có thể rút là ${bal.toLocaleString('vi-VN')}đ`);
    const [row] = await tx.insert(affiliateWithdrawalRequests).values({ affiliateAccountId: acc.id, programId, amountMinor, payoutSnapshotEncrypted: profile.encryptedPayload, maskedAccount: profile.maskedAccount, status: 'requested' }).returning();
    await tx.insert((await import('@hoiminh/db')).affiliateWalletEntries).values({ affiliateAccountId: acc.id, withdrawalId: row!.id, entryType: 'hold', amountMinor, idempotencyKey: `withdrawal-hold:${row!.id}`, note: 'Khóa khi gửi yêu cầu rút' });
    return row!;
  });
  await ctx.events.emit('affiliate.withdrawal_requested', { withdrawalId: wd.id, programId, affiliateAccountId: acc.id, amountMinor });
  await audit(ctx, { action: 'withdrawal.request', resourceType: 'affiliate_withdrawal_request', resourceId: wd.id, communityId: program.communityId, metadata: { amountMinor } });
  return wd;
}

/** Cộng sự hủy khi còn requested → release. */
export async function cancelWithdrawal(ctx: Ctx, withdrawalId: string) {
  const userId = requireUser(ctx);
  const wd = await ctx.db.query.affiliateWithdrawalRequests.findFirst({ where: eq(affiliateWithdrawalRequests.id, withdrawalId) });
  if (!wd) throw notFound();
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, wd.affiliateAccountId) });
  if (acc?.userId !== userId) throw forbidden();
  if (wd.status !== 'requested') throw invalidState('Chỉ hủy được khi yêu cầu còn ở trạng thái Chờ duyệt');
  await ctx.db.update(affiliateWithdrawalRequests).set({ status: 'cancelled', version: wd.version + 1, reviewedAt: ctx.now() }).where(and(eq(affiliateWithdrawalRequests.id, withdrawalId), eq(affiliateWithdrawalRequests.version, wd.version)));
  await ledgerEntry(ctx, { affiliateAccountId: wd.affiliateAccountId, entryType: 'release', amountMinor: wd.amountMinor, idempotencyKey: `withdrawal-release:${withdrawalId}`, withdrawalId, note: 'Cộng sự tự hủy' });
  return { ok: true };
}

/** Lịch sử rút của tôi. */
export async function myWithdrawals(ctx: Ctx, programId: string) {
  const userId = requireUser(ctx);
  const acc = await ensureAccount(ctx, userId, programId);
  return ctx.db.query.affiliateWithdrawalRequests.findMany({ where: eq(affiliateWithdrawalRequests.affiliateAccountId, acc.id), orderBy: desc(affiliateWithdrawalRequests.requestedAt), limit: 50 });
}

async function requirePayer(ctx: Ctx, programId: string) {
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, programId) });
  if (!program) throw notFound();
  if (program.scopeType === 'platform') requireSuperAdmin(ctx);
  else await requireCommunityPermission(ctx, program.communityId!, 'affiliates.manage');
  return program;
}

/** Hàng đợi rút của chương trình (chủ hội hoặc super admin). */
export async function payoutQueue(ctx: Ctx, programId: string) {
  await requirePayer(ctx, programId);
  const rows = await ctx.db.select({ w: affiliateWithdrawalRequests, u: { id: users.id, name: users.name, email: users.email, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(affiliateWithdrawalRequests).innerJoin(affiliateAccounts, eq(affiliateAccounts.id, affiliateWithdrawalRequests.affiliateAccountId)).innerJoin(users, eq(users.id, affiliateAccounts.userId)).where(eq(affiliateWithdrawalRequests.programId, programId)).orderBy(desc(affiliateWithdrawalRequests.requestedAt)).limit(100);
  return { queue: rows.filter((r) => r.w.status === 'requested' || r.w.status === 'reviewing').map((r) => ({ ...r.w, user: r.u, payoutSnapshotEncrypted: undefined })), history: rows.filter((r) => r.w.status === 'paid' || r.w.status === 'rejected' || r.w.status === 'cancelled').map((r) => ({ ...r.w, user: r.u, payoutSnapshotEncrypted: undefined })) };
}

/** Bấm "Xem xét": chuyển reviewing, mở số tài khoản đầy đủ (audit), sinh QR chuyển khoản có sẵn số tiền và nội dung. */
export async function reviewWithdrawal(ctx: Ctx, withdrawalId: string) {
  const wd = await ctx.db.query.affiliateWithdrawalRequests.findFirst({ where: eq(affiliateWithdrawalRequests.id, withdrawalId) });
  if (!wd) throw notFound();
  const program = await requirePayer(ctx, wd.programId);
  if (wd.status === 'requested') await ctx.db.update(affiliateWithdrawalRequests).set({ status: 'reviewing', version: wd.version + 1, reviewedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : null, reviewedAt: ctx.now() }).where(and(eq(affiliateWithdrawalRequests.id, withdrawalId), eq(affiliateWithdrawalRequests.version, wd.version)));
  const payout = await decryptJson<PayoutPayload>(wd.payoutSnapshotEncrypted, ctx.env.ENCRYPTION_KEY);
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, wd.affiliateAccountId) });
  const user = acc ? await ctx.db.query.users.findFirst({ where: eq(users.id, acc.userId), columns: { name: true, email: true, handle: true } }) : null;
  const initials = (user?.name ?? 'CS').split(/\s+/).map((w) => w[0]).join('').slice(-2).toUpperCase();
  const d = wd.requestedAt;
  const suggestedContent = `HM ${program.scopeType === 'platform' ? 'AFF' : 'CS'} ${initials} ${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const bin = VIETNAM_BANKS.find((b) => b.code === payout.bankCode)?.bin ?? payout.bankCode;
  const qrImageUrl = `https://img.vietqr.io/image/${bin}-${payout.accountNumber}-compact2.png?amount=${wd.amountMinor}&addInfo=${encodeURIComponent(suggestedContent)}&accountName=${encodeURIComponent(payout.accountHolder)}`;
  await audit(ctx, { action: 'withdrawal.reveal_account', resourceType: 'affiliate_withdrawal_request', resourceId: withdrawalId, communityId: program.communityId, metadata: { maskedAccount: wd.maskedAccount } });
  const fresh = await ctx.db.query.affiliateWithdrawalRequests.findFirst({ where: eq(affiliateWithdrawalRequests.id, withdrawalId) });
  return { withdrawal: { ...fresh!, payoutSnapshotEncrypted: undefined }, user, payout, suggestedContent, qrImageUrl };
}

/** Đã chuyển khoản: nhập mã tham chiếu → paid, ghi debit, hoa hồng → paid, phát affiliate.withdrawal_paid. */
export async function markPaid(ctx: Ctx, withdrawalId: string, transferReference: string, version: number) {
  const wd = await ctx.db.query.affiliateWithdrawalRequests.findFirst({ where: eq(affiliateWithdrawalRequests.id, withdrawalId) });
  if (!wd) throw notFound();
  const program = await requirePayer(ctx, wd.programId);
  if (wd.status !== 'reviewing' && wd.status !== 'requested') throw invalidState('Yêu cầu không ở trạng thái xử lý được');
  const updated = await ctx.db.update(affiliateWithdrawalRequests).set({ status: 'paid', transferReference, version: version + 1, paidAt: ctx.now(), reviewedAt: wd.reviewedAt ?? ctx.now(), reviewedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : wd.reviewedByUserId }).where(and(eq(affiliateWithdrawalRequests.id, withdrawalId), eq(affiliateWithdrawalRequests.version, version))).returning();
  if (!updated.length) throw conflict('Yêu cầu vừa được người khác xử lý, tải lại trang');
  // Mở khóa khoản đã giữ rồi ghi nợ: số dư khả dụng không đổi, khoản tiền rời ví vĩnh viễn.
  await ledgerEntry(ctx, { affiliateAccountId: wd.affiliateAccountId, entryType: 'release', amountMinor: wd.amountMinor, idempotencyKey: `withdrawal-release:${withdrawalId}`, withdrawalId, note: 'Mở khóa để ghi nợ' });
  await ledgerEntry(ctx, { affiliateAccountId: wd.affiliateAccountId, entryType: 'debit', amountMinor: wd.amountMinor, idempotencyKey: `withdrawal-debit:${withdrawalId}`, withdrawalId, note: transferReference });
  // Đánh dấu hoa hồng available → paid theo thứ tự cũ nhất cho đến đủ số tiền.
  const avail = await ctx.db.query.affiliateCommissions.findMany({ where: and(eq(affiliateCommissions.affiliateAccountId, wd.affiliateAccountId), eq(affiliateCommissions.status, 'available')), orderBy: (t, { asc }) => asc(t.releasedAt) });
  let remaining = wd.amountMinor;
  const ids: string[] = [];
  for (const c of avail) { if (remaining <= 0) break; ids.push(c.id); remaining -= c.amountMinor; }
  if (ids.length) await ctx.db.update(affiliateCommissions).set({ status: 'paid', paidAt: ctx.now() }).where(inArray(affiliateCommissions.id, ids));
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, wd.affiliateAccountId) });
  await ctx.events.emit('affiliate.withdrawal_paid', { withdrawalId, programId: wd.programId, affiliateAccountId: wd.affiliateAccountId, amountMinor: wd.amountMinor, userId: acc!.userId, transferReference });
  await audit(ctx, { action: 'withdrawal.paid', resourceType: 'affiliate_withdrawal_request', resourceId: withdrawalId, communityId: program.communityId, metadata: { amountMinor: wd.amountMinor, transferReference } });
  return updated[0]!;
}

/** Từ chối kèm lý do → rejected, ghi release trả về ví. */
export async function rejectWithdrawal(ctx: Ctx, withdrawalId: string, reason: string, version: number) {
  const wd = await ctx.db.query.affiliateWithdrawalRequests.findFirst({ where: eq(affiliateWithdrawalRequests.id, withdrawalId) });
  if (!wd) throw notFound();
  const program = await requirePayer(ctx, wd.programId);
  if (wd.status !== 'reviewing' && wd.status !== 'requested') throw invalidState('Yêu cầu không ở trạng thái xử lý được');
  const updated = await ctx.db.update(affiliateWithdrawalRequests).set({ status: 'rejected', rejectionReason: reason, version: version + 1, reviewedAt: ctx.now(), reviewedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : null }).where(and(eq(affiliateWithdrawalRequests.id, withdrawalId), eq(affiliateWithdrawalRequests.version, version))).returning();
  if (!updated.length) throw conflict('Yêu cầu vừa được người khác xử lý, tải lại trang');
  await ledgerEntry(ctx, { affiliateAccountId: wd.affiliateAccountId, entryType: 'release', amountMinor: wd.amountMinor, idempotencyKey: `withdrawal-release:${withdrawalId}`, withdrawalId, note: reason });
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, wd.affiliateAccountId) });
  await ctx.events.emit('affiliate.withdrawal_rejected', { withdrawalId, affiliateAccountId: wd.affiliateAccountId, amountMinor: wd.amountMinor, userId: acc!.userId, reason });
  await audit(ctx, { action: 'withdrawal.rejected', resourceType: 'affiliate_withdrawal_request', resourceId: withdrawalId, communityId: program.communityId, metadata: { reason } });
  return updated[0]!;
}

/** Xuất đối soát CSV cho người chi trả. */
export async function exportPayoutsCsv(ctx: Ctx, programId: string): Promise<string> {
  const q = await payoutQueue(ctx, programId);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['cong_su,email,so_tien,tai_khoan,trang_thai,gui_luc,ma_tham_chieu,ly_do'];
  for (const w of [...q.queue, ...q.history]) lines.push([w.user.name, w.user.email, w.amountMinor, w.maskedAccount, w.status, w.requestedAt.toISOString(), w.transferReference ?? '', w.rejectionReason ?? ''].map(esc).join(','));
  return '﻿' + lines.join('\n');
}

export { walletBalance };
