// Chương trình cộng sự hội + nền tảng, 5 cộng sự có ví, hoa hồng, sổ cái, yêu cầu rút, snapshot xếp hạng.
import { encryptJson, maskAccount } from '@hoiminh/config';
import type { Database } from '../client';
import {
  affiliateAccounts, affiliateAttributions, affiliateClicks, affiliateCommissions, affiliateConversions, affiliateLeaderboardSnapshots, affiliateLinks,
  affiliatePayoutProfiles, affiliatePrograms, affiliateWalletEntries, affiliateWithdrawalRequests,
} from '../schema';
import type { SeedCommunity } from './community';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

interface Ctx { db: Database; base: Date; U: Record<string, SeedUser>; c: SeedCommunity; key: string; appUrl: string }

/** Tạo chương trình, tài khoản cộng sự và toàn bộ dữ liệu tiền. */
export async function seedAffiliate(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity, opts: { encryptionKey: string; appUrl: string }): Promise<void> {
  const programId = await sid('program:kd');
  const platformProgramId = await sid('program:platform');
  await db
    .insert(affiliatePrograms)
    .values([
      { id: programId, scopeType: 'community', communityId: c.id, workspaceId: c.workspaceId, name: 'Cộng sự Kinh Doanh Online Cùng AI', commissionRateBps: 5000, holdDays: 14, minWithdrawalMinor: 500_000, payerUserId: U.minhquy!.id },
      { id: platformProgramId, scopeType: 'platform', name: 'Cộng sự nền tảng Hội Mình', commissionRateBps: 4000, commissionDurationMonths: 12, holdDays: 30, minWithdrawalMinor: 500_000, payerUserId: U.admin!.id },
    ])
    .onConflictDoNothing();

  const ctx: Ctx = { db, base, U, c, key: opts.encryptionKey, appUrl: opts.appUrl };
  const affs: Array<{ who: string; code: string; clicks: number; signups: number; paid: number; bank?: ['VCB' | 'TCB' | 'MB' | 'ACB', string, string] }> = [
    { who: 'hoangvu', code: 'hv8k2', clicks: 612, signups: 34, paid: 23, bank: ['VCB', '0071008812345', 'NGUYEN HOANG VU'] },
    { who: 'hongkim', code: 'hk3m1', clicks: 301, signups: 19, paid: 11, bank: ['TCB', '19033305118011', 'NGUYEN THI HONG KIM'] },
    { who: 'kienbui', code: 'kb7t4', clicks: 154, signups: 12, paid: 8, bank: ['MB', '0330199887766', 'BUI TRUNG KIEN'] },
    { who: 'dien', code: 'dn5q9', clicks: 88, signups: 9, paid: 6, bank: ['MB', '0330199012345', 'PHAM NGOC DIEN'] },
    { who: 'duy', code: 'dn2w6', clicks: 73, signups: 8, paid: 5 },
    { who: 'cong', code: 'ct4e8', clicks: 60, signups: 7, paid: 4 },
    { who: 'thulan', code: 'tl9r3', clicks: 41, signups: 5, paid: 3, bank: ['ACB', '2210099887', 'LE THU LAN'] },
    { who: 'minhquy', code: 'mq8k2', clicks: 128, signups: 4, paid: 3, bank: ['VCB', '0071000004521', 'NGUYEN MINH QUY'] },
  ];
  const accountIds: Record<string, string> = {};
  for (const a of affs) {
    const id = await sid(`affiliate:kd:${a.who}`);
    accountIds[a.who] = id;
    await db.insert(affiliateAccounts).values({ id, userId: U[a.who]!.id, programId, affiliateCode: a.code, clickCount: a.clicks, signupCount: a.signups, paidCount: a.paid, approvedAt: daysFrom(base, -30), createdAt: daysFrom(base, -30) }).onConflictDoNothing();
    await db.insert(affiliateLinks).values({ id: await sid(`afflink:kd:${a.who}`), affiliateAccountId: id, targetType: 'community', targetId: c.id, slug: a.code, destinationUrl: `${opts.appUrl}/${c.slug}?ref=${a.code}` }).onConflictDoNothing();
    if (a.bank) {
      const [bankCode, number, holder] = a.bank;
      const bankName = { VCB: 'Vietcombank', TCB: 'Techcombank', MB: 'MB Bank', ACB: 'ACB' }[bankCode];
      await db.insert(affiliatePayoutProfiles).values({ affiliateAccountId: id, encryptedPayload: await encryptJson({ bankCode, bankName, accountNumber: number, accountHolder: holder }, opts.encryptionKey), maskedAccount: maskAccount(bankName, number), bankCode }).onConflictDoNothing();
    }
    for (let i = 0; i < Math.min(a.clicks, 5); i++) {
      await db.insert(affiliateClicks).values({ id: await sid(`click:${a.who}:${i}`), affiliateAccountId: id, visitorId: `v-${a.code}-${i}`, landingUrl: `${opts.appUrl}/${c.slug}`, clickedAt: daysFrom(base, -i - 1) }).onConflictDoNothing();
    }
  }
  // Attribution: Hoàng Vũ giới thiệu Điền, Hồng Kim, Công.
  for (const who of ['dien', 'hongkim', 'cong', 'kienbui']) {
    await db.insert(affiliateAttributions).values({ id: await sid(`attr:hv:${who}`), affiliateAccountId: accountIds.hoangvu!, programId, userId: U[who]!.id, attributedAt: daysFrom(base, -U[who]!.joinedDaysAgo - 1), expiresAt: daysFrom(base, 29) }).onConflictDoNothing();
  }
  // Hoa hồng khớp màn Ví cộng sự (nhìn từ góc Minh Quý là cộng sự, và Hoàng Vũ là người giới thiệu Điền/Hồng Kim/Công).
  await commission(ctx, { key: 'hv:dien', acc: accountIds.hoangvu!, programId, who: 'dien', order: 'dien', base: 249_000, status: 'pending', days: 0 });
  await commission(ctx, { key: 'hv:hongkim', acc: accountIds.hoangvu!, programId, who: 'hongkim', order: 'hongkim', base: 2_490_000, status: 'available', days: -18 });
  await commission(ctx, { key: 'hv:cong', acc: accountIds.hoangvu!, programId, who: 'cong', order: 'cong', base: 249_000, status: 'reversed', days: -3 });
  await commission(ctx, { key: 'hv:kienbui', acc: accountIds.hoangvu!, programId, who: 'kienbui', order: 'hoangvu-fmm', base: 1_000_000, status: 'paid', days: -25 });
  await commission(ctx, { key: 'hv:m5', acc: accountIds.hoangvu!, programId, who: 'member5', base: 2_490_000, status: 'available', days: -20 });
  await commission(ctx, { key: 'hv:m6', acc: accountIds.hoangvu!, programId, who: 'member6', base: 2_490_000, status: 'available', days: -24 });
  await commission(ctx, { key: 'hk:m10', acc: accountIds.hongkim!, programId, who: 'member10', base: 2_490_000, status: 'available', days: -21 });
  await commission(ctx, { key: 'hk:m15', acc: accountIds.hongkim!, programId, who: 'member15', base: 249_000, status: 'pending', days: -2 });
  await commission(ctx, { key: 'kb:m20', acc: accountIds.kienbui!, programId, who: 'member20', base: 2_490_000, status: 'available', days: -22 });
  await commission(ctx, { key: 'dn:m25', acc: accountIds.dien!, programId, who: 'member25', base: 1_000_000, status: 'available', days: -19 });
  await commission(ctx, { key: 'mq:m1', acc: accountIds.minhquy!, programId, who: 'member1', base: 2_490_000, status: 'available', days: -18 });
  await commission(ctx, { key: 'mq:m2', acc: accountIds.minhquy!, programId, who: 'member2', base: 249_000, status: 'pending', days: -1 });
  await commission(ctx, { key: 'mq:m3', acc: accountIds.minhquy!, programId, who: 'member3', base: 2_490_000, status: 'paid', days: -30 });
  await commission(ctx, { key: 'mq:m4', acc: accountIds.minhquy!, programId, who: 'member4', base: 2_490_000, status: 'available', days: -22 });
  await commission(ctx, { key: 'mq:m5', acc: accountIds.minhquy!, programId, who: 'member7', base: 1_000_000, status: 'available', days: -26 });
  await commission(ctx, { key: 'mq:m6', acc: accountIds.minhquy!, programId, who: 'member8', base: 249_000, status: 'pending', days: -3 });

  // Yêu cầu rút: hàng đợi + lịch sử khớp màn Cài đặt · Cộng sự · Yêu cầu rút.
  await withdrawal(ctx, { key: 'hv:req', acc: accountIds.hoangvu!, programId, amount: 1_500_000, status: 'requested', days: 0, hour: 9 });
  await withdrawal(ctx, { key: 'hk:rev', acc: accountIds.hongkim!, programId, amount: 620_000, status: 'reviewing', days: -1, hour: 21 });
  await withdrawal(ctx, { key: 'dn:req', acc: accountIds.dien!, programId, amount: 500_000, status: 'requested', days: -2, hour: 18 });
  await withdrawal(ctx, { key: 'hv:paid', acc: accountIds.hoangvu!, programId, amount: 2_000_000, status: 'paid', days: -9, hour: 10, ref: 'FT26090512873' });
  await withdrawal(ctx, { key: 'kb:paid', acc: accountIds.kienbui!, programId, amount: 750_000, status: 'paid', days: -11, hour: 10, ref: 'FT26090309112' });
  await withdrawal(ctx, { key: 'tl:rej', acc: accountIds.thulan!, programId, amount: 500_000, status: 'rejected', days: -13, hour: 10, reason: 'Sai tên chủ tài khoản, đã hoàn về ví' });
  await withdrawal(ctx, { key: 'dn:cancel', acc: accountIds.duy!, programId, amount: 600_000, status: 'cancelled', days: -17, hour: 10 });
  await withdrawal(ctx, { key: 'mq:req', acc: accountIds.minhquy!, programId, amount: 500_000, status: 'requested', days: 0, hour: 8 });
  await withdrawal(ctx, { key: 'mq:paid1', acc: accountIds.minhquy!, programId, amount: 2_000_000, status: 'paid', days: -9, hour: 11, ref: 'FT26090512873' });
  await withdrawal(ctx, { key: 'mq:paid2', acc: accountIds.minhquy!, programId, amount: 490_000, status: 'paid', days: -25, hour: 11, ref: 'FT26082010021' });

  // Cộng sự nền tảng (super admin xử lý).
  const plat: Array<[string, string, number, 'requested' | 'reviewing', ['VCB' | 'ACB' | 'VTB', string, string]]> = [
    ['lehanh', 'lh1p2', 1_996_000, 'requested', ['ACB', '2210021234', 'LE THI HANH']],
    ['thaovy', 'tv9z8', 998_000, 'requested', ['VTB', '107774112233', 'TRAN THAO VY']],
    ['huan', 'nh2x7', 1_856_000, 'reviewing', ['VCB', '0071005520931', 'NGUYEN VAN HUAN']],
  ];
  for (const [who, code, amount, status, [bankCode, number, holder]] of plat) {
    const id = await sid(`affiliate:platform:${who}`);
    const bankName = { VCB: 'Vietcombank', ACB: 'ACB', VTB: 'Vietinbank' }[bankCode];
    await db.insert(affiliateAccounts).values({ id, userId: U[who]!.id, programId: platformProgramId, affiliateCode: code, commissionRateBps: who === 'huan' ? 5000 : null, signupCount: who === 'huan' ? 18 : 6, paidCount: who === 'huan' ? 18 : 6, approvedAt: daysFrom(base, -60) }).onConflictDoNothing();
    await db.insert(affiliateLinks).values({ id: await sid(`afflink:platform:${who}`), affiliateAccountId: id, targetType: 'platform_signup', slug: code, destinationUrl: `${opts.appUrl}/tao-hoi?ref=${code}` }).onConflictDoNothing();
    await db.insert(affiliatePayoutProfiles).values({ affiliateAccountId: id, encryptedPayload: await encryptJson({ bankCode, bankName, accountNumber: number, accountHolder: holder }, opts.encryptionKey), maskedAccount: maskAccount(bankName, number), bankCode }).onConflictDoNothing();
    await commission(ctx, { key: `plat:${who}`, acc: id, programId: platformProgramId, who: 'member4', base: 4_990_000, status: 'available', days: -35, rate: who === 'huan' ? 5000 : 4000 });
    await withdrawal(ctx, { key: `plat:${who}`, acc: id, programId: platformProgramId, amount, status, days: -1, hour: 10 });
  }

  // Snapshot xếp hạng tháng này và từ đầu.
  const month = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  const ranks: Array<[string, number, number, number, number, number]> = [
    ['hoangvu', 1, 34, 23, 5_727_000, 2_863_500], ['hongkim', 2, 19, 11, 2_739_000, 1_369_500], ['kienbui', 3, 12, 8, 1_992_000, 996_000],
    ['dien', 4, 9, 6, 1_494_000, 747_000], ['duy', 5, 8, 5, 1_245_000, 622_500], ['cong', 6, 7, 4, 996_000, 498_000], ['thulan', 7, 5, 3, 747_000, 373_500], ['minhquy', 8, 4, 3, 747_000, 373_500],
  ];
  const deltas: Record<string, number> = { dien: 2, duy: 0, cong: 4, thulan: -1, minhquy: 0, hoangvu: 0, hongkim: 1, kienbui: -1 };
  for (const period of ['month', 'all_time'] as const) {
    for (const [who, rank, ref, paid, rev, com] of ranks) {
      await db.insert(affiliateLeaderboardSnapshots).values({ id: await sid(`lb:${period}:${who}`), communityId: c.id, periodType: period, periodKey: period === 'month' ? month : 'all', affiliateAccountId: accountIds[who]!, rank, referralsCount: ref, paidCount: paid, revenueCents: rev, commissionCents: com, rankDelta: deltas[who] ?? 0, computedAt: new Date(Date.now() - 10 * 60_000) }).onConflictDoNothing();
    }
  }
}

async function commission(ctx: Ctx, o: { key: string; acc: string; programId: string; who: string; order?: string; base: number; status: 'pending' | 'available' | 'reversed' | 'paid'; days: number; rate?: number }): Promise<void> {
  const rate = o.rate ?? 5000;
  const amount = Math.floor((o.base * rate) / 10_000);
  const convId = await sid(`conv:${o.key}`);
  const commId = await sid(`comm:${o.key}`);
  const at = daysFrom(ctx.base, o.days, 9);
  await ctx.db.insert(affiliateConversions).values({ id: convId, affiliateAccountId: o.acc, programId: o.programId, customerUserId: ctx.U[o.who]!.id, orderId: o.order ? await sid(`order:${o.order}`) : null, conversionType: 'community_purchase', grossMinor: o.base, status: o.status === 'reversed' ? 'reversed' : 'confirmed', convertedAt: at }).onConflictDoNothing();
  await ctx.db
    .insert(affiliateCommissions)
    .values({ id: commId, conversionId: convId, affiliateAccountId: o.acc, programId: o.programId, paymentId: o.order ? await sid(`payment:${o.order}`) : null, orderId: o.order ? await sid(`order:${o.order}`) : null, baseMinor: o.base, rateBps: rate, amountMinor: amount, status: o.status, availableAt: daysFrom(at, 14), releasedAt: o.status === 'pending' || o.status === 'reversed' ? null : daysFrom(at, 14), reversedAt: o.status === 'reversed' ? daysFrom(at, 1) : null, paidAt: o.status === 'paid' ? daysFrom(at, 20) : null, createdAt: at })
    .onConflictDoNothing();
  if (o.status === 'available' || o.status === 'paid') {
    await ctx.db.insert(affiliateWalletEntries).values({ id: await sid(`wallet:credit:${o.key}`), affiliateAccountId: o.acc, commissionId: commId, entryType: 'credit', amountMinor: amount, idempotencyKey: `commission-credit:${commId}`, note: 'Hoa hồng hết hạn giữ', createdAt: daysFrom(at, 14) }).onConflictDoNothing();
  }
}

async function withdrawal(ctx: Ctx, o: { key: string; acc: string; programId: string; amount: number; status: 'requested' | 'reviewing' | 'paid' | 'rejected' | 'cancelled'; days: number; hour: number; ref?: string; reason?: string }): Promise<void> {
  const id = await sid(`wd:${o.key}`);
  const profile = await ctx.db.query.affiliatePayoutProfiles.findFirst({ where: (t, { eq }) => eq(t.affiliateAccountId, o.acc) });
  const snapshot = profile?.encryptedPayload ?? (await encryptJson({ bankCode: 'VCB', bankName: 'Vietcombank', accountNumber: '0071000000000', accountHolder: 'CHUA CAP NHAT' }, ctx.key));
  const at = daysFrom(ctx.base, o.days, o.hour, 20);
  await ctx.db
    .insert(affiliateWithdrawalRequests)
    .values({ id, affiliateAccountId: o.acc, programId: o.programId, amountMinor: o.amount, payoutSnapshotEncrypted: snapshot, maskedAccount: profile?.maskedAccount ?? 'Vietcombank ••••0000', status: o.status, version: o.status === 'requested' ? 1 : 2, transferReference: o.ref ?? null, rejectionReason: o.reason ?? null, reviewedByUserId: o.status === 'requested' || o.status === 'cancelled' ? null : ctx.U.minhquy!.id, requestedAt: at, reviewedAt: o.status === 'requested' ? null : daysFrom(at, 1), paidAt: o.status === 'paid' ? daysFrom(at, 1) : null })
    .onConflictDoNothing();
  // Sổ cái: hold khi gửi; debit khi trả; release khi từ chối/hủy.
  await ctx.db.insert(affiliateWalletEntries).values({ id: await sid(`wallet:hold:${o.key}`), affiliateAccountId: o.acc, withdrawalId: id, entryType: 'hold', amountMinor: o.amount, idempotencyKey: `withdrawal-hold:${id}`, createdAt: at }).onConflictDoNothing();
  if (o.status === 'paid') {
    await ctx.db.insert(affiliateWalletEntries).values({ id: await sid(`wallet:release:${o.key}`), affiliateAccountId: o.acc, withdrawalId: id, entryType: 'release', amountMinor: o.amount, idempotencyKey: `withdrawal-release:${id}`, note: 'Mở khóa để ghi nợ', createdAt: daysFrom(at, 1) }).onConflictDoNothing();
    await ctx.db.insert(affiliateWalletEntries).values({ id: await sid(`wallet:debit:${o.key}`), affiliateAccountId: o.acc, withdrawalId: id, entryType: 'debit', amountMinor: o.amount, idempotencyKey: `withdrawal-debit:${id}`, note: o.ref ?? null, createdAt: daysFrom(at, 1) }).onConflictDoNothing();
  }
  if (o.status === 'rejected' || o.status === 'cancelled') await ctx.db.insert(affiliateWalletEntries).values({ id: await sid(`wallet:release:${o.key}`), affiliateAccountId: o.acc, withdrawalId: id, entryType: 'release', amountMinor: o.amount, idempotencyKey: `withdrawal-release:${id}`, note: o.reason ?? 'Cộng sự tự hủy', createdAt: daysFrom(at, 1) }).onConflictDoNothing();
}
