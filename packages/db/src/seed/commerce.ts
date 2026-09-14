// Sản phẩm cửa hàng (6), offer/giá, đơn hàng, thanh toán, subscription, entitlement, hóa đơn khớp màn Doanh thu.
import type { Database } from '../client';
import { bundleItems, entitlements, invoices, offers, orderItems, orders, payments, prices, productPages, products, refunds, subscriptions } from '../schema';
import type { SeedCommunity } from './community';
import type { SeedCourses } from './courses';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

export interface SeedCommerce {
  productIds: Record<string, string>;
  orderIds: Record<string, string>;
}

/** Chèn sản phẩm và các giao dịch mẫu. */
export async function seedCommerce(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity, cs: SeedCourses): Promise<SeedCommerce> {
  const P: Record<string, string> = {};
  const specs = [
    { key: 'combo', kind: 'bundle' as const, name: 'Combo Kinh doanh AI trọn bộ', slug: 'combo-kinh-doanh-ai', short: 'Sở hữu toàn bộ khóa học hiện có và các khóa ra mắt trong 12 tháng tới.', color: '#1F1B17', price: 5_000_000, compare: 9_000_000, sales: 12 },
    { key: 'fmm', kind: 'course' as const, name: 'Funnel Money Model 2026', slug: 'funnel-money-model-2026', short: 'Thiết kế offer, lead magnet và tripwire để hoàn vốn quảng cáo sớm.', color: '#D4593A', price: 1_000_000, compare: 1_686_000, course: 'fmm', sales: 128, launch: daysFrom(base, 2, 14) },
    { key: 'fbads', kind: 'course' as const, name: 'Facebook Ads chuyển đổi 2026', slug: 'facebook-ads-2026', short: 'Chạy quảng cáo về trang giới thiệu, retarget và đo lường đăng ký.', color: '#0E8E96', price: 1_500_000, course: 'fbads', sales: 96 },
    { key: 'affiliate', kind: 'course' as const, name: 'Kiếm tiền với Funnel Affiliate', slug: 'kiem-tien-voi-funnel-affiliate', short: 'Chương trình cộng sự: nhận link, chia sẻ, nhận hoa hồng định kỳ.', color: '#7A5C3E', price: 490_000, course: 'affiliate', sales: 41 },
    { key: 'aiagent', kind: 'course' as const, name: 'AI Agent cho người bán hàng', slug: 'ai-agent-cho-nguoi-ban-hang', short: 'Dựng trợ lý trả lời khách, chốt đơn và chăm sóc sau bán.', color: '#3E5C7A', price: 1_200_000, compare: 1_900_000, course: 'aiagent', sales: 37 },
    { key: 'prompts', kind: 'digital' as const, name: '120 prompt viết bài bán hàng', slug: '120-prompt-viet-bai-ban-hang', short: 'Dùng ngay với ChatGPT, Claude hoặc Gemini. Cập nhật miễn phí.', color: '#C89B3C', price: 199_000, sales: 210 },
  ];
  for (const s of specs) {
    const id = await sid(`product:${s.key}`);
    P[s.key] = id;
    await db
      .insert(products)
      .values({ id, workspaceId: c.workspaceId, communityId: c.id, kind: s.kind, name: s.name, slug: s.slug, shortDescription: s.short, coverColor: s.color, courseId: s.course ? cs.courseIds[s.course]! : null, priceMinor: s.price, compareAtMinor: s.compare ?? null, salesCount: s.sales, ratingAvg: 49, ratingCount: s.key === 'fmm' ? 38 : 5, launchDiscountEndsAt: s.launch ?? null, createdAt: daysFrom(base, -90) })
      .onConflictDoNothing();
    await db
      .insert(productPages)
      .values({
        id: await sid(`ppage:${s.key}`), workspaceId: c.workspaceId, productId: id, headline: s.name, subheadline: s.short,
        benefits: s.key === 'fmm' ? ['Viết một offer bằng công thức giá trị trong 1 buổi', 'Dựng lead magnet một trang kéo email với chi phí thấp', 'Đặt giá tripwire để hoàn vốn ads ngay đơn đầu', 'Đọc 3 con số quyết định lãi của funnel', 'Thiết kế hoa hồng cộng sự 50% mà vẫn có lãi', 'Có bộ template: Offer Canvas, kịch bản tin nhắn chào, bảng theo dõi'] : [s.short],
        faq: [
          { q: 'Mình là thành viên Premium thì có phải mua không?', a: 'Không. Premium mở khóa toàn bộ khóa học trong hội, kể cả khóa này và các khóa ra mắt sau.' },
          { q: 'Mua lẻ thì học được bao lâu?', a: 'Trọn đời, kể cả khi bạn rời hội. Cập nhật mới của khóa cũng được nhận.' },
          { q: 'Chưa hợp thì sao?', a: 'Hoàn tiền trong 7 ngày nếu bạn xem chưa quá 20% nội dung, gửi yêu cầu ngay trong Gói và thanh toán.' },
        ],
        instructor: { name: 'Minh Quý', bio: 'Làm MMO từ 2016, điều hành hai hội với 290 thành viên. Khóa này đúc từ 12 buổi Q&A gỡ offer thật cho thành viên.' },
        guarantee: 'Hoàn tiền trong 7 ngày nếu bạn xem chưa quá 20% nội dung.',
      })
      .onConflictDoNothing();
    const offerId = await sid(`offer:product:${s.key}`);
    await db.insert(offers).values({ id: offerId, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'product', resourceId: id, name: s.name, cycle: 'one_time' }).onConflictDoNothing();
    await db.insert(prices).values({ id: await sid(`price:product:${s.key}`), offerId, amountMinor: s.price, compareAtMinor: s.compare ?? null }).onConflictDoNothing();
  }
  for (const k of ['fmm', 'fbads', 'affiliate', 'aiagent']) {
    await db.insert(bundleItems).values({ id: await sid(`bundle:combo:${k}`), bundleProductId: P.combo!, itemProductId: P[k]! }).onConflictDoNothing();
  }
  // Offer + giá cho tier Premium (tháng/năm) và VIP.
  for (const [cycle, amount] of [['monthly', 249_000], ['yearly', 2_490_000]] as const) {
    const offerId = await sid(`offer:tier:premium:${cycle}`);
    await db.insert(offers).values({ id: offerId, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'tier', resourceId: c.tiers.premium, name: `Premium · ${cycle === 'monthly' ? 'tháng' : 'năm'}`, cycle }).onConflictDoNothing();
    await db.insert(prices).values({ id: await sid(`price:tier:premium:${cycle}`), offerId, amountMinor: amount }).onConflictDoNothing();
  }

  // Giao dịch khớp màn Doanh thu.
  const hv = await sid('affiliate:kd:hoangvu');
  const tx: Array<{ key: string; who: string; days: number; hour: number; item: string; type: 'tier' | 'product'; target: string; provider: 'sepay' | 'momo' | 'vnpay' | 'paypal'; amount: number; status: 'paid' | 'pending' | 'refunded'; aff?: string; cycle?: 'monthly' | 'yearly' }> = [
    { key: 'dien', who: 'dien', days: 0, hour: 9, item: 'Premium · tháng', type: 'tier', target: c.tiers.premium, provider: 'sepay', amount: 249_000, status: 'paid', aff: hv, cycle: 'monthly' },
    { key: 'thulan', who: 'thulan', days: 0, hour: 8, item: 'Combo Kinh doanh AI trọn bộ', type: 'product', target: P.combo!, provider: 'momo', amount: 5_000_000, status: 'paid' },
    { key: 'hongkim', who: 'hongkim', days: -1, hour: 10, item: 'Premium · năm', type: 'tier', target: c.tiers.premium, provider: 'vnpay', amount: 2_490_000, status: 'paid', aff: hv, cycle: 'yearly' },
    { key: 'kienbui', who: 'kienbui', days: -1, hour: 16, item: 'Funnel Money Model 2026', type: 'product', target: P.fmm!, provider: 'sepay', amount: 1_000_000, status: 'pending', aff: hv },
    { key: 'duy', who: 'duy', days: -2, hour: 11, item: 'Premium · tháng', type: 'tier', target: c.tiers.premium, provider: 'momo', amount: 249_000, status: 'paid', cycle: 'monthly' },
    { key: 'cong', who: 'cong', days: -3, hour: 9, item: 'Premium · tháng', type: 'tier', target: c.tiers.premium, provider: 'sepay', amount: 249_000, status: 'refunded', aff: hv, cycle: 'monthly' },
    { key: 'hoangvu', who: 'hoangvu', days: -4, hour: 14, item: '120 prompt viết bài bán hàng', type: 'product', target: P.prompts!, provider: 'paypal', amount: 199_000, status: 'paid' },
    { key: 'hoangvu-fmm', who: 'hoangvu', days: -25, hour: 14, item: 'Funnel Money Model 2026', type: 'product', target: P.fmm!, provider: 'sepay', amount: 1_000_000, status: 'paid' },
    { key: 'hv-premium', who: 'hoangvu', days: -43, hour: 9, item: 'Premium · năm', type: 'tier', target: c.tiers.premium, provider: 'sepay', amount: 2_490_000, status: 'paid', cycle: 'yearly' },
  ];
  const orderIds: Record<string, string> = {};
  let n = 0;
  for (const t of tx) {
    n++;
    const orderId = await sid(`order:${t.key}`);
    const paymentId = await sid(`payment:${t.key}`);
    orderIds[t.key] = orderId;
    const at = daysFrom(base, t.days, t.hour, 3);
    const reference = `HM ${['8K2QX', 'M7ZP3', '5QW1D', '4TT9A', 'B2N8C', 'C9K4M', 'D7P2R', 'E3W6T', 'F8H1Q'][n - 1]}`;
    await db
      .insert(orders)
      .values({ id: orderId, workspaceId: c.workspaceId, communityId: c.id, customerUserId: U[t.who]!.id, targetType: t.type, targetId: t.target, subtotalMinor: t.amount, totalMinor: t.amount, status: t.status, reference, affiliateAccountId: t.aff ?? null, metadata: { cycle: t.cycle ?? 'one_time', title: t.item }, paidAt: t.status === 'pending' ? null : at, refundedAt: t.status === 'refunded' ? daysFrom(base, t.days + 1, 12) : null, createdAt: at })
      .onConflictDoNothing();
    await db.insert(orderItems).values({ id: await sid(`orderitem:${t.key}`), orderId, resourceType: t.type, resourceId: t.target, name: t.item, unitMinor: t.amount, totalMinor: t.amount }).onConflictDoNothing();
    await db
      .insert(payments)
      .values({ id: paymentId, workspaceId: c.workspaceId, communityId: c.id, orderId, customerUserId: U[t.who]!.id, provider: t.provider, providerPaymentId: `${t.provider}-${n}${t.key}`, amountMinor: t.amount, status: t.status === 'paid' ? 'succeeded' : t.status === 'refunded' ? 'refunded' : 'pending', paymentMethod: t.provider === 'sepay' ? 'bank_transfer' : t.provider, refundedMinor: t.status === 'refunded' ? t.amount : 0, reference, paidAt: t.status === 'pending' ? null : at, createdAt: at })
      .onConflictDoNothing();
    if (t.status !== 'pending') {
      await db.insert(invoices).values({ id: await sid(`invoice:${t.key}`), workspaceId: c.workspaceId, orderId, userId: U[t.who]!.id, number: `HM-2026-${String(1000 + n)}`, amountMinor: t.amount, description: `${t.item} · ${c.name}`, issuedAt: at }).onConflictDoNothing();
    }
    if (t.status === 'refunded') {
      await db.insert(refunds).values({ id: await sid(`refund:${t.key}`), paymentId, orderId, amountMinor: t.amount, reason: 'Thành viên yêu cầu trong 7 ngày', requestedByUserId: U[t.who]!.id, createdAt: daysFrom(base, t.days + 1, 12) }).onConflictDoNothing();
    }
    if (t.status === 'paid' && t.type === 'tier' && t.cycle) {
      const subId = await sid(`sub:${t.key}`);
      const end = t.cycle === 'monthly' ? daysFrom(at, 30) : daysFrom(at, 365);
      await db.insert(subscriptions).values({ id: subId, workspaceId: c.workspaceId, communityId: c.id, userId: U[t.who]!.id, tierId: c.tiers.premium, status: 'active', billingCycle: t.cycle, amountMinor: t.amount, currentPeriodStart: at, currentPeriodEnd: end, provider: t.provider, lastOrderId: orderId, createdAt: at }).onConflictDoNothing();
      await db.insert(entitlements).values({ id: await sid(`ent:${t.key}`), userId: U[t.who]!.id, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'tier', resourceId: c.tiers.premium, sourceType: 'subscription', sourceId: subId, expiresAt: end, createdAt: at }).onConflictDoNothing();
    }
    if (t.status === 'paid' && t.type === 'product') {
      await db.insert(entitlements).values({ id: await sid(`ent:${t.key}`), userId: U[t.who]!.id, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'product', resourceId: t.target, sourceType: 'purchase', sourceId: orderId, createdAt: at }).onConflictDoNothing();
      if (t.target === P.combo) {
        for (const k of ['fmm', 'fbads', 'affiliate', 'aiagent']) await db.insert(entitlements).values({ id: await sid(`ent:${t.key}:${k}`), userId: U[t.who]!.id, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'product', resourceId: P[k]!, sourceType: 'community_bundle', sourceId: orderId, createdAt: at }).onConflictDoNothing();
      }
    }
  }
  // Thành viên Premium khác: entitlement tier từ subscription (không có đơn hiển thị).
  for (let i = 5; i <= 25; i += 5) {
    const u = U[`member${i}`]!;
    await db.insert(entitlements).values({ id: await sid(`ent:member${i}:premium`), userId: u.id, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'tier', resourceId: c.tiers.premium, sourceType: 'subscription', expiresAt: daysFrom(base, 12 + i) }).onConflictDoNothing();
  }
  return { productIds: P, orderIds };
}
