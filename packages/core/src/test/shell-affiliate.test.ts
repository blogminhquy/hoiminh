// Khung hội trả thêm thông tin affiliate của hội cho người xem (chủ dự án yêu cầu ngày 21/11/2026): thành viên thấy
// mục "Affiliate" kèm phần trăm hoa hồng ngay trên thanh bên của hội, không phụ thuộc cờ bảng xếp hạng. Các ca: chương
// trình bật, tắt, gói của hội không có affiliate, khách. Khung hội chỉ đọc, không được mở tài khoản affiliate.
import { and, eq } from 'drizzle-orm';
import { affiliateAccounts, communities } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import * as affiliate from '../services/affiliate';
import * as flags from '../services/feature-flags';
import { communityPlan } from '../services/plans';
import * as shell from '../services/shell';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let KD = '';
let PROGRAM = '';
let owner: Ctx;
let outsider: Ctx;

const PROGRAM_ON = { enabled: true, commissionRateBps: 5000, holdDays: 14, minWithdrawalMinor: 500_000, leaderboardVisibility: 'members' as const, leaderboardShowMoney: true };
const accountOf = async (userKey: string) => app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, await app.ids(`user:${userKey}`)), eq(affiliateAccounts.programId, PROGRAM)) });

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  PROGRAM = await app.ids('program:kd');
  owner = await app.as('minhquy');
  outsider = { ...app.ctx, actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' }, requestId: 'test-outsider' };
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('khung hội: affiliate của hội với người xem', () => {
  it('chương trình bật: thành viên chưa làm affiliate nhận mức chung của chương trình, và không bị mở tài khoản affiliate', async () => {
    const s = await shell.communityShell(await app.as('member2'), 'minhquy');
    expect(s.affiliate).toEqual({ programId: PROGRAM, enabled: true, rateBps: 5000, durationMonths: null, hasAccount: false, leaderboardVisibility: 'members' });
    expect(await accountOf('member2')).toBeUndefined();
  });

  it('thành viên đã là affiliate: báo đã có tài khoản; có mức riêng thì trả mức riêng', async () => {
    const dien = await app.as('dien');
    expect((await shell.communityShell(dien, 'minhquy')).affiliate).toMatchObject({ enabled: true, rateBps: 5000, hasAccount: true });
    const acc = await accountOf('dien');
    await app.ctx.db.update(affiliateAccounts).set({ commissionRateBps: 6500 }).where(eq(affiliateAccounts.id, acc!.id));
    try {
      expect((await shell.communityShell(dien, 'minhquy')).affiliate).toMatchObject({ enabled: true, rateBps: 6500, hasAccount: true });
      // Mức riêng chỉ của người đó: thành viên khác vẫn thấy mức chung.
      expect((await shell.communityShell(await app.as('duy'), 'minhquy')).affiliate?.rateBps).toBe(5000);
    } finally {
      await app.ctx.db.update(affiliateAccounts).set({ commissionRateBps: null }).where(eq(affiliateAccounts.id, acc!.id));
    }
  });

  it('cờ bảng xếp hạng tắt: bảng xếp hạng ẩn (tabs.affiliate) nhưng affiliate của hội vẫn bật', async () => {
    const admin = await app.as('admin');
    await flags.setFlag(admin, flags.FLAG.affiliateLeaderboard, { enabled: false });
    try {
      const s = await shell.communityShell(await app.as('member2'), 'minhquy');
      expect(s.community.tabs.affiliate).toBe(false);
      expect(s.affiliate).toMatchObject({ enabled: true, rateBps: 5000 });
    } finally {
      await flags.setFlag(admin, flags.FLAG.affiliateLeaderboard, { enabled: true });
    }
    expect((await shell.communityShell(await app.as('member2'), 'minhquy')).community.tabs.affiliate).toBe(true);
  });

  it('chủ hội cũng là thành viên: nhận cùng thông tin, kèm cài đặt ai xem được bảng xếp hạng', async () => {
    await affiliate.updateProgram(owner, KD, { ...PROGRAM_ON, commissionRateBps: 4000, leaderboardVisibility: 'affiliates_only' });
    try {
      expect((await shell.communityShell(owner, 'minhquy')).affiliate).toMatchObject({ enabled: true, rateBps: 4000, hasAccount: true, leaderboardVisibility: 'affiliates_only' });
      expect((await shell.communityShell(await app.as('member2'), 'minhquy')).affiliate).toMatchObject({ enabled: true, rateBps: 4000, hasAccount: false, leaderboardVisibility: 'affiliates_only' });
    } finally {
      await affiliate.updateProgram(owner, KD, PROGRAM_ON);
    }
  });

  it('chương trình tắt: enabled là false với mọi thành viên, kể cả người đã có tài khoản affiliate', async () => {
    await affiliate.updateProgram(owner, KD, { ...PROGRAM_ON, enabled: false });
    try {
      expect((await shell.communityShell(await app.as('member2'), 'minhquy')).affiliate).toMatchObject({ programId: PROGRAM, enabled: false, hasAccount: false });
      expect((await shell.communityShell(await app.as('dien'), 'minhquy')).affiliate).toMatchObject({ enabled: false, hasAccount: true });
    } finally {
      await affiliate.updateProgram(owner, KD, PROGRAM_ON);
    }
    expect((await shell.communityShell(await app.as('member2'), 'minhquy')).affiliate?.enabled).toBe(true);
  });

  it('gói của hội không có affiliate: enabled là false dù chương trình còn để bật', async () => {
    const before = await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, KD), columns: { planKey: true } });
    await app.ctx.db.update(communities).set({ planKey: 'starter' }).where(eq(communities.id, KD));
    try {
      expect((await communityPlan(app.system(), KD)).features).not.toContain('affiliate');
      const s = await shell.communityShell(await app.as('member2'), 'minhquy');
      expect(s.affiliate).toMatchObject({ programId: PROGRAM, enabled: false });
      expect(s.community.tabs.affiliate).toBe(false);
    } finally {
      await app.ctx.db.update(communities).set({ planKey: before!.planKey }).where(eq(communities.id, KD));
    }
    expect((await shell.communityShell(await app.as('member2'), 'minhquy')).affiliate?.enabled).toBe(true);
  });

  it('khách (chưa đăng nhập, hoặc đã đăng nhập mà chưa vào hội) không nhận thông tin affiliate', async () => {
    const anon = await shell.communityShell(app.anon(), 'minhquy');
    expect(anon.viewer.isMember).toBe(false);
    expect(anon.affiliate).toBeNull();
    const guest = await shell.communityShell(outsider, 'minhquy');
    expect(guest.viewer.isMember).toBe(false);
    expect(guest.affiliate).toBeNull();
  });

  it('hội chưa có chương trình affiliate: null', async () => {
    const s = await shell.communityShell(await app.as('minhquy'), 'cong-su-mmo');
    expect(s.viewer.isMember).toBe(true);
    expect(s.affiliate).toBeNull();
  });
});
