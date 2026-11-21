// Bộ lọc khoảng ngày của Tiền, Bàn điều khiển chủ hội và Tổng quan hệ thống: ngày lịch giờ Việt Nam, tính cả hai đầu,
// "từ trước đến nay" lấy hết, tham số `days` cũ vẫn chạy.
import { dateRangeQuerySchema, revenueQuerySchema } from '@hoiminh/contracts';
import { orders } from '@hoiminh/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { resolvePeriod } from '../lib/period';
import * as admin from '../services/admin';
import * as revenue from '../services/revenue';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let workspaceId = '';
let buyer = '';

// Các đơn thử nằm ở năm 2031, cách xa dữ liệu seed (quanh ngày chạy test), nên mỗi khoảng ngày chỉ chứa đúng đơn thử.
// Ngày 10/03/2031 giờ Việt Nam chạy từ 2031-03-09T17:00:00Z tới trước 2031-03-10T17:00:00Z.
const A = { key: 'a', amount: 100_000, paidAt: '2031-03-09T16:59:59Z' }; // 23:59:59 ngày 09/03
const B = { key: 'b', amount: 200_000, paidAt: '2031-03-09T17:00:00Z' }; // 00:00:00 ngày 10/03
const C = { key: 'c', amount: 400_000, paidAt: '2031-03-10T16:59:59Z' }; // 23:59:59 ngày 10/03
const D = { key: 'd', amount: 800_000, paidAt: '2031-03-10T17:00:00Z' }; // 00:00:00 ngày 11/03
/** Đơn chưa trả, tạo lúc 10:00 ngày 10/03 giờ Việt Nam: có trong bảng giao dịch của ngày đó, không tính vào tiền. */
const PENDING_AT = '2031-03-10T03:00:00Z';

/** Ngữ cảnh với đồng hồ đứng ở một thời điểm cho trước. */
const at = (ctx: Ctx, iso: string): Ctx => ({ ...ctx, now: () => new Date(iso) });
/** 12:00 trưa giờ Việt Nam ngày 15/03/2031. */
const NOON_15 = '2031-03-15T05:00:00Z';
/** 12:00 trưa giờ Việt Nam ngày 11/03/2031. */
const NOON_11 = '2031-03-11T05:00:00Z';

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  buyer = await app.ids('user:dien');
  const [c] = await app.ctx.db.execute(sql`select workspace_id from communities where id = ${kd}`).then((r) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows)) as Array<{ workspace_id: string }>;
  workspaceId = c!.workspace_id;
  const base = { workspaceId, communityId: kd, customerUserId: buyer, targetType: 'product' as const, targetId: 'thu-khoang-ngay', currency: 'VND' };
  await app.ctx.db.insert(orders).values([
    ...[A, B, C, D].map((o) => ({ ...base, subtotalMinor: o.amount, totalMinor: o.amount, status: 'paid' as const, reference: `HM RANGE${o.key.toUpperCase()}`, metadata: { title: `Đơn ${o.key}` }, paidAt: new Date(o.paidAt), createdAt: new Date(o.paidAt) })),
    { ...base, subtotalMinor: 50_000, totalMinor: 50_000, status: 'pending' as const, reference: 'HM RANGEP', metadata: { title: 'Đơn chờ' }, createdAt: new Date(PENDING_AT) },
  ]);
}, 180_000);
afterAll(async () => {
  await app.close();
});

const titles = (items: Array<{ title: string }>) => items.map((i) => i.title);

describe('chốt kỳ từ query', () => {
  const now = new Date(NOON_11);
  it('khoảng ngày chạy từ 00:00 giờ Việt Nam của ngày đầu tới hết ngày cuối', () => {
    const p = resolvePeriod({ from: '2031-03-10', to: '2031-03-10' }, now);
    expect(p.start?.toISOString()).toBe('2031-03-09T17:00:00.000Z');
    expect(p.end.toISOString()).toBe('2031-03-10T17:00:00.000Z');
    expect(p.days).toBe(1);
  });
  it('kỳ trước là khoảng liền trước có cùng số ngày', () => {
    const p = resolvePeriod({ from: '2031-03-05', to: '2031-03-11' }, now);
    expect(p.days).toBe(7);
    expect(p.prev?.start.toISOString()).toBe('2031-02-25T17:00:00.000Z'); // 00:00 ngày 26/02
    expect(p.prev?.end.toISOString()).toBe('2031-03-04T17:00:00.000Z'); // tới hết ngày 04/03
  });
  it('chỉ có `to` là từ trước đến nay: không có mốc đầu, không có kỳ trước', () => {
    const p = resolvePeriod({ to: '2031-03-11' }, now);
    expect(p).toMatchObject({ from: null, to: '2031-03-11', days: null, start: null, prev: null });
  });
  it('`days` cũ là N ngày lịch gần nhất tính cả hôm nay; không gửi gì là 30 ngày', () => {
    expect(resolvePeriod({ days: 1 }, now)).toMatchObject({ from: '2031-03-11', to: '2031-03-11', days: 1 });
    expect(resolvePeriod({ days: 7 }, now)).toMatchObject({ from: '2031-03-05', to: '2031-03-11', days: 7 });
    expect(resolvePeriod({}, now)).toMatchObject({ from: '2031-02-10', to: '2031-03-11', days: 30 });
  });
  it('ngay sau nửa đêm giờ Việt Nam đã là ngày mới dù giờ UTC còn ở ngày cũ', () => {
    expect(resolvePeriod({ days: 1 }, new Date('2031-03-10T17:00:01Z'))).toMatchObject({ from: '2031-03-11', to: '2031-03-11' });
    expect(resolvePeriod({ days: 1 }, new Date('2031-03-10T16:59:59Z'))).toMatchObject({ from: '2031-03-10', to: '2031-03-10' });
  });
  it('`from`/`to` thắng `days` khi gửi cả hai', () => {
    expect(resolvePeriod({ from: '2031-03-01', to: '2031-03-02', days: 90 }, now)).toMatchObject({ from: '2031-03-01', to: '2031-03-02', days: 2 });
  });
});

describe('kiểm đầu vào', () => {
  it('nhận from/to dạng YYYY-MM-DD, days dạng chuỗi số, và query trống', () => {
    expect(dateRangeQuerySchema.parse({ from: '2026-10-08', to: '2026-11-20' })).toEqual({ from: '2026-10-08', to: '2026-11-20' });
    expect(dateRangeQuerySchema.parse({ days: '30' })).toEqual({ days: 30 });
    expect(dateRangeQuerySchema.parse({})).toEqual({});
    expect(revenueQuerySchema.parse({ to: '2026-11-20', limit: '5000' })).toEqual({ to: '2026-11-20', limit: 5000 });
  });
  it('từ chối ngày sai dạng, ngày không có thật, khoảng ngược và days ngoài giới hạn', () => {
    for (const bad of [{ from: '08/10/2026' }, { to: '2026-02-30' }, { from: '2026-13-01' }, { from: '2026-11-21', to: '2026-11-20' }, { days: '0' }, { days: 'abc' }, { days: '1.5' }]) {
      expect(dateRangeQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(revenueQuerySchema.safeParse({ limit: '5001' }).success).toBe(false);
  });
});

describe('Doanh thu theo khoảng ngày', () => {
  it('lọc đúng giao dịch ở hai đầu mút của một ngày', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const r = await revenue.revenue(ctx, kd, { from: '2031-03-10', to: '2031-03-10' });
    expect(r.range).toEqual({ from: '2031-03-10', to: '2031-03-10' });
    expect(r.stats.grossMinor).toBe(B.amount + C.amount);
    expect(r.stats.netMinor).toBe(B.amount + C.amount);
    expect(r.stats.txCount).toBe(2);
    // Mới nhất trước; đơn chờ thuộc ngày nó được tạo nhưng không tính vào tiền.
    expect(titles(r.items)).toEqual(['Đơn c', 'Đơn chờ', 'Đơn b']);
  });
  it('khoảng nhiều ngày tính cả ngày đầu và ngày cuối', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const all = await revenue.revenue(ctx, kd, { from: '2031-03-09', to: '2031-03-11' });
    expect(all.stats.grossMinor).toBe(A.amount + B.amount + C.amount + D.amount);
    expect(all.stats.txCount).toBe(4);
    const firstTwo = await revenue.revenue(ctx, kd, { from: '2031-03-09', to: '2031-03-10' });
    expect(firstTwo.stats.grossMinor).toBe(A.amount + B.amount + C.amount);
    const lastTwo = await revenue.revenue(ctx, kd, { from: '2031-03-10', to: '2031-03-11' });
    expect(lastTwo.stats.grossMinor).toBe(B.amount + C.amount + D.amount);
  });
  it('từ trước đến nay lấy hết, kể cả đơn cũ của dữ liệu seed', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const [sum] = await app.ctx.db.select({ total: sql<string>`coalesce(sum(${orders.totalMinor}),0)`, n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.communityId, kd), inArray(orders.status, ['paid', 'refunded'])));
    const [every] = await app.ctx.db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.communityId, kd));
    const r = await revenue.revenue(ctx, kd, { to: '2031-03-15', limit: 5000 });
    expect(r.range).toEqual({ from: null, to: '2031-03-15' });
    expect(r.stats.grossMinor).toBe(Number(sum!.total));
    expect(r.stats.grossMinor).toBeGreaterThan(A.amount + B.amount + C.amount + D.amount);
    expect(r.stats.txCount).toBe(sum!.n);
    expect(r.items.length).toBe(every!.n);
    // Ngày cuối vẫn là mốc chặn: lấy tới hết 10/03 thì chưa có đơn của 11/03.
    const until10 = await revenue.revenue(ctx, kd, { to: '2031-03-10', limit: 5000 });
    expect(until10.stats.grossMinor).toBe(Number(sum!.total) - D.amount);
    expect(titles(until10.items)).not.toContain('Đơn d');
  });
  it('`days` cũ vẫn chạy và tính theo ngày lịch, không theo 24 giờ gần nhất', async () => {
    const ctx = at(await app.as('minhquy'), NOON_11);
    // Đơn c trả 12 giờ trước nhưng thuộc ngày hôm qua: "hôm nay" (days = 1) không tính.
    const today = await revenue.revenue(ctx, kd, { days: 1 });
    expect(today.range).toEqual({ from: '2031-03-11', to: '2031-03-11' });
    expect(today.stats.grossMinor).toBe(D.amount);
    const two = await revenue.revenue(ctx, kd, { days: 2 });
    expect(two.stats.grossMinor).toBe(B.amount + C.amount + D.amount);
    const fallback = await revenue.revenue(ctx, kd, {});
    expect(fallback.range).toEqual({ from: '2031-02-10', to: '2031-03-11' });
    expect(fallback.stats.grossMinor).toBe(A.amount + B.amount + C.amount + D.amount);
  });
  it('số dòng giao dịch mặc định là 50, xin thêm bằng limit', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const one = await revenue.revenue(ctx, kd, { from: '2031-03-09', to: '2031-03-11', limit: 1 });
    expect(titles(one.items)).toEqual(['Đơn d']);
    expect(one.stats.txCount).toBe(4);
  });
});

describe('Tổng quan của hội theo khoảng ngày', () => {
  it('doanh thu của kỳ, so với kỳ liền trước cùng số ngày, gom theo ngày giờ Việt Nam', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const r = await revenue.settingsOverview(ctx, kd, { from: '2031-03-10', to: '2031-03-10' });
    expect(r.range).toEqual({ from: '2031-03-10', to: '2031-03-10', days: 1 });
    expect(r.stats.revenueMinor).toBe(B.amount + C.amount);
    // Kỳ trước là ngày 09/03, chỉ có đơn a: (600 - 100) / 100 = +500%.
    expect(r.stats.revenueDeltaPct).toBe(500);
    // Đơn b trả lúc 17:00 UTC ngày 09/03 là 00:00 ngày 10/03 giờ Việt Nam.
    expect(r.daily).toEqual([{ date: '2031-03-10', amountMinor: B.amount + C.amount }]);
    const three = await revenue.settingsOverview(ctx, kd, { from: '2031-03-09', to: '2031-03-11' });
    expect(three.daily).toEqual([{ date: '2031-03-09', amountMinor: A.amount }, { date: '2031-03-10', amountMinor: B.amount + C.amount }, { date: '2031-03-11', amountMinor: D.amount }]);
    // Kỳ trước (06 đến 08/03) không có đơn nào: không có gì để so.
    expect(three.stats.revenueDeltaPct).toBeNull();
  });
  it('từ trước đến nay: lấy hết và không có số tăng giảm', async () => {
    const ctx = at(await app.as('minhquy'), NOON_15);
    const [sum] = await app.ctx.db.select({ total: sql<string>`coalesce(sum(${orders.totalMinor}),0)` }).from(orders).where(and(eq(orders.communityId, kd), eq(orders.status, 'paid')));
    const r = await revenue.settingsOverview(ctx, kd, { to: '2031-03-15' });
    expect(r.range).toEqual({ from: null, to: '2031-03-15', days: null });
    expect(r.stats.revenueMinor).toBe(Number(sum!.total));
    expect(r.stats.revenueDeltaPct).toBeNull();
    expect(r.stats.newMembersDeltaPct).toBeNull();
    expect(r.daily.reduce((n, d) => n + d.amountMinor, 0)).toBe(Number(sum!.total));
  });
  it('`days` cũ vẫn chạy', async () => {
    const ctx = at(await app.as('minhquy'), NOON_11);
    const r = await revenue.settingsOverview(ctx, kd, { days: 2 });
    expect(r.range).toEqual({ from: '2031-03-10', to: '2031-03-11', days: 2 });
    expect(r.stats.revenueMinor).toBe(B.amount + C.amount + D.amount);
    // Kỳ trước là 08 và 09/03: chỉ có đơn a.
    expect(r.stats.revenueDeltaPct).toBe(1300);
  });
});

describe('Tổng quan hệ thống theo khoảng ngày', () => {
  it('GMV của kỳ lọc đúng hai đầu mút, từ trước đến nay lấy hết, `days` cũ vẫn chạy', async () => {
    const ctx = at(await app.as('admin'), NOON_11);
    const day = await admin.overview(ctx, { from: '2031-03-10', to: '2031-03-10' });
    expect(day.range).toEqual({ from: '2031-03-10', to: '2031-03-10', days: 1 });
    expect(day.totals.gmvMinor).toBe(B.amount + C.amount);
    expect(day.daily).toEqual([{ date: '2031-03-10', amountMinor: B.amount + C.amount }]);

    const [sum] = await app.ctx.db.select({ total: sql<string>`coalesce(sum(${orders.totalMinor}),0)` }).from(orders).where(and(eq(orders.status, 'paid'), sql`${orders.targetType} <> 'platform'`));
    const [users] = (await app.ctx.db.execute(sql`select count(*)::int as n from users`).then((r) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows))) as Array<{ n: number }>;
    const all = await admin.overview(ctx, { to: '2031-03-11' });
    expect(all.range).toEqual({ from: null, to: '2031-03-11', days: null });
    expect(all.totals.gmvMinor).toBe(Number(sum!.total));
    expect(all.totals.usersNew).toBe(users!.n);

    const today = await admin.overview(ctx, { days: 1 });
    expect(today.totals.gmvMinor).toBe(D.amount);
    const fallback = await admin.overview(ctx);
    expect(fallback.range).toEqual({ from: '2031-02-10', to: '2031-03-11', days: 30 });
    expect(fallback.totals.gmvMinor).toBe(A.amount + B.amount + C.amount + D.amount);
  });
});
