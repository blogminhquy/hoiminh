// Quản lý đơn hàng của hội: quyền xem, lọc theo trạng thái, affiliate, khoảng ngày đặt và ô tìm, tổng của kết quả
// đang lọc, phân trang không lặp không sót, và số đơn theo trạng thái ở phần Thống kê.
import { ordersQuerySchema, type OrdersQuery } from '@hoiminh/contracts';
import { affiliateCommissions, orders, payments } from '@hoiminh/db';
import { and, eq, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import * as revenue from '../services/revenue';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let owner: Ctx;

// Đơn thử nằm ở tháng 3/2031, cách xa dữ liệu seed, và đồng hồ đứng ở 12:00 trưa 15/03/2031 giờ Việt Nam.
const NOW = '2031-03-15T05:00:00Z';
const at = (ctx: Ctx, iso: string): Ctx => ({ ...ctx, now: () => new Date(iso) });
/** Đủ bộ lọc mặc định như API (limit 30) từ một phần query. */
const query = (q: Record<string, unknown>): OrdersQuery => ordersQuerySchema.parse(q);
const MARCH = { from: '2031-03-01', to: '2031-03-15' };

interface Spec {
  key: string; title: string; buyer: string; amount: number; status: 'paid' | 'pending' | 'refunded' | 'expired'; createdAt: string; affiliate?: boolean;
  expiresAt?: string; payment: { provider: string; status: string; owner?: boolean } | null;
}
const SPECS: Spec[] = [
  // Đã trả, có người giới thiệu. Đặt lúc 00:00:00 ngày 10/03 giờ Việt Nam (đúng đầu mút của ngày).
  { key: 'PAIDAFF', title: 'Khóa Lọc Đơn A', buyer: 'dien', amount: 1_000_000, status: 'paid', createdAt: '2031-03-09T17:00:00Z', affiliate: true, payment: { provider: 'sepay', status: 'succeeded', owner: true } },
  // Đã trả, không có người giới thiệu. Đặt lúc 23:59:59 ngày 10/03 giờ Việt Nam (đầu mút bên kia).
  { key: 'PAIDNO', title: 'Gói Lọc Đơn B', buyer: 'thulan', amount: 2_000_000, status: 'paid', createdAt: '2031-03-10T16:59:59Z', payment: { provider: 'momo', status: 'succeeded' } },
  // Chuyển khoản vào tài khoản chủ hội, người mua báo đã chuyển: chờ chủ hội xác nhận.
  { key: 'CONFIRM', title: 'Khóa Lọc Đơn A', buyer: 'duy', amount: 400_000, status: 'pending', createdAt: '2031-03-14T03:00:00Z', expiresAt: '2031-03-16T03:00:00Z', payment: { provider: 'sepay', status: 'processing', owner: true } },
  // Chuyển khoản vào tài khoản chủ hội, đã quá hạn giữ chỗ nhưng còn trong 7 ngày: vẫn chờ xác nhận như khối "Đơn chờ bạn xác nhận".
  { key: 'CONFIRMX', title: 'Khóa 100% thực chiến', buyer: 'cong', amount: 300_000, status: 'expired', createdAt: '2031-03-11T03:00:00Z', expiresAt: '2031-03-12T03:00:00Z', affiliate: true, payment: { provider: 'sepay', status: 'expired', owner: true } },
  // Qua cổng, chưa trả, còn hạn: chờ thanh toán.
  { key: 'WAIT', title: 'Gói Lọc Đơn B', buyer: 'dien', amount: 500_000, status: 'pending', createdAt: '2031-03-15T03:00:00Z', expiresAt: '2031-03-15T06:00:00Z', payment: { provider: 'momo', status: 'pending' } },
  // Qua cổng, chưa trả, đã quá hạn giữ chỗ mà bộ quét chưa chạy: coi là hết hạn ngay.
  { key: 'LATE', title: 'Gói Lọc Đơn B', buyer: 'thulan', amount: 600_000, status: 'pending', createdAt: '2031-03-12T03:00:00Z', expiresAt: '2031-03-12T03:30:00Z', payment: { provider: 'vnpay', status: 'pending' } },
  // Chuyển khoản vào tài khoản chủ hội nhưng đã quá 7 ngày: hết hạn, không còn xác nhận được.
  { key: 'OLD', title: 'Khóa Lọc Đơn A', buyer: 'duy', amount: 700_000, status: 'expired', createdAt: '2031-03-02T03:00:00Z', expiresAt: '2031-03-03T03:00:00Z', payment: { provider: 'sepay', status: 'expired', owner: true } },
  // Đã hoàn tiền, có người giới thiệu.
  { key: 'REFUND', title: 'Khóa Lọc Đơn A', buyer: 'cong', amount: 800_000, status: 'refunded', createdAt: '2031-03-05T03:00:00Z', affiliate: true, payment: { provider: 'sepay', status: 'refunded', owner: true } },
];
const amountOf = (...keys: string[]) => SPECS.filter((s) => keys.includes(s.key)).reduce((n, s) => n + s.amount, 0);
const refs = (items: Array<{ reference: string }>) => items.map((i) => i.reference.replace('HM OL', ''));

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  owner = at(await app.as('minhquy'), NOW);
  const [c] = (await app.ctx.db.execute(sql`select workspace_id from communities where id = ${kd}`).then((r) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows))) as Array<{ workspace_id: string }>;
  const workspaceId = c!.workspace_id;
  const affiliate = await app.ids('affiliate:kd:hoangvu');
  for (const s of SPECS) {
    const buyer = await app.ids(`user:${s.buyer}`);
    const created = new Date(s.createdAt);
    const [o] = await app.ctx.db.insert(orders).values({ workspaceId, communityId: kd, customerUserId: buyer, targetType: 'product', targetId: 'thu-loc-don', subtotalMinor: s.amount, totalMinor: s.amount, status: s.status, reference: `HM OL${s.key}`, affiliateAccountId: s.affiliate ? affiliate : null, metadata: { title: s.title }, paidAt: s.status === 'paid' || s.status === 'refunded' ? created : null, expiresAt: s.expiresAt ? new Date(s.expiresAt) : null, createdAt: created }).returning();
    if (s.payment) await app.ctx.db.insert(payments).values({ workspaceId, communityId: kd, orderId: o!.id, customerUserId: buyer, provider: s.payment.provider, amountMinor: s.amount, status: s.payment.status as 'pending', paymentMethod: s.payment.provider, reference: `HM OL${s.key}`, instruction: s.payment.owner ? { kind: 'bank_qr', payee: 'owner' } : {}, createdAt: created });
  }
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('quyền xem đơn hàng', () => {
  it('thành viên thường và khách chưa đăng nhập bị từ chối; chủ hội xem được', async () => {
    await expect(revenue.listOrders(at(await app.as('cong'), NOW), kd, query(MARCH))).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revenue.listOrders(at(await app.as('member1'), NOW), kd, query(MARCH))).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revenue.listOrders(at(app.anon(), NOW), kd, query(MARCH))).rejects.toMatchObject({ code: expect.stringMatching(/unauthorized|forbidden/) });
    // Màn Doanh thu dùng cùng quyền đó.
    await expect(revenue.revenue(at(await app.as('cong'), NOW), kd, MARCH)).rejects.toMatchObject({ code: 'forbidden' });
    const r = await revenue.listOrders(owner, kd, query(MARCH));
    expect(r.total).toBe(SPECS.length);
  });
  it('chủ hội của hội khác không xem được đơn của hội này', async () => {
    const yt = await app.ids('community:yt');
    await expect(revenue.listOrders(owner, yt, query(MARCH))).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('danh sách đơn hàng', () => {
  it('mới đặt nhất trước, kèm trạng thái, người mua, phương thức và tổng của cả kết quả', async () => {
    const r = await revenue.listOrders(owner, kd, query(MARCH));
    expect(refs(r.items)).toEqual(['WAIT', 'CONFIRM', 'LATE', 'CONFIRMX', 'PAIDNO', 'PAIDAFF', 'REFUND', 'OLD']);
    expect(r.total).toBe(8);
    expect(r.totalMinor).toBe(SPECS.reduce((n, s) => n + s.amount, 0));
    expect(r.nextCursor).toBeNull();
    const paid = r.items.find((i) => i.reference === 'HM OLPAIDAFF')!;
    expect(paid).toMatchObject({ title: 'Khóa Lọc Đơn A', amountMinor: 1_000_000, status: 'paid', provider: 'sepay', method: 'sepay', hasAffiliate: true, affiliateName: 'Hoàng Vũ', canConfirm: false, customer: { name: 'Điền Phạm Ngọc' } });
    expect(new Date(paid.createdAt).toISOString()).toBe('2031-03-09T17:00:00.000Z');
    expect(new Date(paid.paidAt!).toISOString()).toBe('2031-03-09T17:00:00.000Z');
    expect(r.items.find((i) => i.reference === 'HM OLPAIDNO')).toMatchObject({ hasAffiliate: false, affiliateName: null, commissionMinor: 0, paidAt: expect.anything() });
    expect(r.items.find((i) => i.reference === 'HM OLWAIT')).toMatchObject({ status: 'awaiting_payment', paidAt: null, canConfirm: false });
  });

  it('lọc theo trạng thái: lấy đúng từ trạng thái đơn và trạng thái thanh toán', async () => {
    const by = async (status: string) => refs((await revenue.listOrders(owner, kd, query({ ...MARCH, status }))).items);
    expect(await by('paid')).toEqual(['PAIDNO', 'PAIDAFF']);
    expect(await by('refunded')).toEqual(['REFUND']);
    expect(await by('awaiting_payment')).toEqual(['WAIT']);
    // Đơn chuyển khoản vào tài khoản chủ hội còn trong 7 ngày, kể cả đã quá hạn giữ chỗ.
    expect(await by('awaiting_confirmation')).toEqual(['CONFIRM', 'CONFIRMX']);
    // Đơn qua cổng quá hạn giữ chỗ (dù bộ quét chưa chạy) và đơn chuyển khoản đã quá 7 ngày.
    expect(await by('expired')).toEqual(['LATE', 'OLD']);
    expect(await by('cancelled')).toEqual([]);
  });

  it('đơn chờ xác nhận bấm được "Đã nhận tiền", có cờ người mua báo đã chuyển', async () => {
    const r = await revenue.listOrders(owner, kd, query({ ...MARCH, status: 'awaiting_confirmation' }));
    expect(r.items.map((i) => [i.reference, i.canConfirm, i.buyerSaysPaid])).toEqual([['HM OLCONFIRM', true, true], ['HM OLCONFIRMX', true, false]]);
    expect(r.total).toBe(2);
    expect(r.totalMinor).toBe(amountOf('CONFIRM', 'CONFIRMX'));
  });

  it('lọc theo affiliate dùng đúng cột người giới thiệu của đơn', async () => {
    const withAff = await revenue.listOrders(owner, kd, query({ ...MARCH, affiliate: 'with' }));
    expect(refs(withAff.items)).toEqual(['CONFIRMX', 'PAIDAFF', 'REFUND']);
    expect(withAff.items.every((i) => i.hasAffiliate && i.affiliateName === 'Hoàng Vũ')).toBe(true);
    expect(withAff.totalMinor).toBe(amountOf('CONFIRMX', 'PAIDAFF', 'REFUND'));
    const without = await revenue.listOrders(owner, kd, query({ ...MARCH, affiliate: 'without' }));
    expect(refs(without.items)).toEqual(['WAIT', 'CONFIRM', 'LATE', 'PAIDNO', 'OLD']);
    expect(without.items.every((i) => !i.hasAffiliate && i.affiliateName === null)).toBe(true);
    expect(withAff.total + without.total).toBe(8);
  });

  it('lọc theo khoảng ngày đặt: tính cả hai đầu mút theo giờ Việt Nam', async () => {
    const day10 = await revenue.listOrders(owner, kd, query({ from: '2031-03-10', to: '2031-03-10' }));
    expect(refs(day10.items)).toEqual(['PAIDNO', 'PAIDAFF']);
    expect(refs((await revenue.listOrders(owner, kd, query({ from: '2031-03-09', to: '2031-03-09' }))).items)).toEqual([]);
    expect(refs((await revenue.listOrders(owner, kd, query({ from: '2031-03-11', to: '2031-03-12' }))).items)).toEqual(['LATE', 'CONFIRMX']);
    expect(day10.range).toEqual({ from: '2031-03-10', to: '2031-03-10' });
  });

  it('từ trước đến nay lấy cả đơn cũ của dữ liệu seed; `days` cũ vẫn chạy', async () => {
    const [every] = await app.ctx.db.select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.totalMinor}),0)` }).from(orders).where(eq(orders.communityId, kd));
    const all = await revenue.listOrders(owner, kd, query({ to: '2031-03-15', limit: 5000 }));
    expect(all.range).toEqual({ from: null, to: '2031-03-15' });
    expect(all.total).toBe(every!.n);
    expect(all.totalMinor).toBe(Number(every!.total));
    expect(all.items).toHaveLength(every!.n);
    expect(all.total).toBeGreaterThan(SPECS.length);
    // 2 ngày gần nhất tính cả hôm nay: 14 và 15/03.
    expect(refs((await revenue.listOrders(owner, kd, query({ days: 2 }))).items)).toEqual(['WAIT', 'CONFIRM']);
  });

  it('đơn seed có hoa hồng: hiện tên người giới thiệu và đúng số hoa hồng phải trả', async () => {
    const orderId = await app.ids('order:dien');
    const [sum] = await app.ctx.db.select({ v: sql<string>`coalesce(sum(${affiliateCommissions.amountMinor}),0)` }).from(affiliateCommissions).where(and(eq(affiliateCommissions.orderId, orderId), ne(affiliateCommissions.status, 'reversed')));
    const r = await revenue.listOrders(owner, kd, query({ to: '2031-03-15', q: 'HM 8K2QX' }));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ orderId, hasAffiliate: true, affiliateName: 'Hoàng Vũ', commissionMinor: Number(sum!.v), status: 'paid' });
  });

  it('ô tìm: theo tên người mua, tên sản phẩm, mã đơn; không phân biệt hoa thường; ký tự % là chữ thường', async () => {
    const find = async (q: string) => refs((await revenue.listOrders(owner, kd, query({ ...MARCH, q }))).items);
    expect(await find('Thu Lan')).toEqual(['LATE', 'PAIDNO']);
    expect(await find('thu lan')).toEqual(['LATE', 'PAIDNO']);
    expect(await find('lọc đơn b')).toEqual(['WAIT', 'LATE', 'PAIDNO']);
    expect(await find('olrefund')).toEqual(['REFUND']);
    expect(await find('  HM OLWAIT  ')).toEqual(['WAIT']);
    expect(await find('không có đơn nào tên này')).toEqual([]);
    // "%" và "_" không phải ký tự đại diện: chỉ khớp đơn có đúng chữ đó trong tên.
    expect(await find('100%')).toEqual(['CONFIRMX']);
    expect(await find('%')).toEqual(['CONFIRMX']);
    expect(await find('_')).toEqual([]);
  });

  it('các bộ lọc ghép với nhau, tổng tính trên kết quả đang lọc', async () => {
    const r = await revenue.listOrders(owner, kd, query({ ...MARCH, status: 'paid', affiliate: 'with', q: 'khóa' }));
    expect(refs(r.items)).toEqual(['PAIDAFF']);
    expect(r).toMatchObject({ total: 1, totalMinor: 1_000_000 });
  });
});

describe('phân trang', () => {
  it('đi hết các trang không lặp, không sót, đúng thứ tự; tổng không đổi theo trang', async () => {
    const whole = refs((await revenue.listOrders(owner, kd, query({ ...MARCH, limit: 5000 }))).items);
    for (const limit of [1, 3, 7]) {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await revenue.listOrders(owner, kd, query({ ...MARCH, limit, ...(cursor ? { cursor } : {}) }));
        expect(page.items.length).toBeLessThanOrEqual(limit);
        expect(page.total).toBe(8);
        seen.push(...refs(page.items));
        cursor = page.nextCursor ?? undefined;
        pages++;
      } while (cursor && pages < 50);
      expect(seen, `limit ${limit}`).toEqual(whole);
      expect(new Set(seen).size).toBe(seen.length);
      expect(pages).toBe(Math.ceil(8 / limit));
    }
  });

  it('nhiều đơn tạo trong cùng một phần nghìn giây vẫn không lặp, không sót', async () => {
    // Database giữ tới phần triệu giây; nếu con trỏ chỉ giữ phần nghìn giây thì các đơn này sẽ bị lặp hoặc bỏ sót.
    const buyer = await app.ids('user:dien');
    const [c] = (await app.ctx.db.execute(sql`select workspace_id from communities where id = ${kd}`).then((r) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows))) as Array<{ workspace_id: string }>;
    for (let i = 1; i <= 6; i++) {
      await app.ctx.db.execute(sql`insert into orders (workspace_id, community_id, customer_user_id, target_type, target_id, subtotal_minor, total_minor, status, reference, metadata, created_at)
        values (${c!.workspace_id}, ${kd}, ${buyer}, 'product', 'thu-cung-mili-giay', 1000, 1000, 'pending', ${`HM OLSAME${i}`}, '{"title":"Đơn cùng mili giây"}'::jsonb, ${`2031-04-01T03:00:00.000${i}00Z`}::timestamptz)`);
    }
    const april = { from: '2031-04-01', to: '2031-04-01' };
    const ctx = at(await app.as('minhquy'), '2031-04-02T05:00:00Z');
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await revenue.listOrders(ctx, kd, query({ ...april, limit: 2, ...(cursor ? { cursor } : {}) }));
      seen.push(...page.items.map((i) => i.reference));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && seen.length < 20);
    expect(seen).toEqual(['HM OLSAME6', 'HM OLSAME5', 'HM OLSAME4', 'HM OLSAME3', 'HM OLSAME2', 'HM OLSAME1']);
  });

  it('con trỏ hỏng thì báo lỗi rõ ràng, không trả nhầm trang đầu', async () => {
    for (const bad of ['abc', 'khong-phai-base64!!', btoa('2031-03-10|x')]) {
      await expect(revenue.listOrders(owner, kd, query({ ...MARCH, cursor: bad }))).rejects.toMatchObject({ code: 'validation_error' });
    }
  });
});

describe('kiểm đầu vào của danh sách đơn', () => {
  it('mặc định 30 dòng mỗi trang; từ chối trạng thái lạ, bộ lọc affiliate lạ, ô tìm quá dài, khoảng ngày ngược', () => {
    expect(ordersQuerySchema.parse({})).toEqual({ limit: 30 });
    expect(ordersQuerySchema.parse({ status: 'paid', affiliate: 'with', q: '  dien  ', limit: '50', to: '2031-03-15' })).toEqual({ status: 'paid', affiliate: 'with', q: 'dien', limit: 50, to: '2031-03-15' });
    for (const bad of [{ status: 'succeeded' }, { affiliate: 'yes' }, { q: 'x'.repeat(101) }, { limit: '0' }, { limit: '5001' }, { from: '2031-03-15', to: '2031-03-01' }, { from: '15/03/2031' }]) {
      expect(ordersQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('Thống kê: số đơn theo trạng thái và doanh thu qua affiliate', () => {
  it('đếm đơn đặt trong kỳ theo đúng các trạng thái của danh sách đơn', async () => {
    const r = await revenue.revenue(owner, kd, MARCH);
    expect(r.ordersByStatus).toEqual({ awaiting_payment: 1, awaiting_confirmation: 2, paid: 2, expired: 2, refunded: 1, cancelled: 0 });
    // Tổng các trạng thái bằng tổng số đơn của danh sách cùng kỳ.
    const list = await revenue.listOrders(owner, kd, query(MARCH));
    expect(Object.values(r.ordersByStatus).reduce((a, b) => a + b, 0)).toBe(list.total);
  });
  it('tách doanh thu đã thu qua affiliate khỏi phần còn lại', async () => {
    const r = await revenue.revenue(owner, kd, MARCH);
    expect(r.stats.netMinor).toBe(amountOf('PAIDAFF', 'PAIDNO'));
    expect(r.stats.referredMinor).toBe(amountOf('PAIDAFF'));
    expect(r.stats.referredCount).toBe(1);
  });
});
