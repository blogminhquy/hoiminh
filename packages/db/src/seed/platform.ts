// Gói nền tảng, subscription nền tảng, cổng thanh toán, đối soát, feature flag, onboarding, audit, tin nhắn, thông báo.
import type { Database } from '../client';
import {
  auditLogs, conversationParticipants, conversations, featureFlags, messages, notificationPrefs, notifications, onboardingProgress, plans,
  platformSubscriptions, providerAccounts, reconciliationItems, webhookEvents,
} from '../schema';
import type { SeedCommunity } from './community';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

/** Gói duy nhất "hoiminh" và các cấu hình nền tảng. */
export async function seedPlatform(db: Database, base: Date, U: Record<string, SeedUser>, main: SeedCommunity, others: SeedCommunity[]): Promise<void> {
  await db
    .insert(plans)
    .values({ key: 'hoiminh', name: 'Hội Mình', description: 'Một gói duy nhất, đầy đủ tính năng, không thu phí giao dịch.', monthlyMinor: 499_000, yearlyMinor: 4_990_000, trialDays: 14, quotas: { communities: null, members: null, courses: null, events: null, broadcasts_per_month: null }, features: ['affiliate', 'store', 'custom_domain', 'plugins', 'api', 'webhooks', 'mcp'] })
    .onConflictDoNothing();
  const subs: Array<[SeedCommunity, 'active' | 'trialing', 'monthly' | 'yearly', number]> = [
    [main, 'active', 'monthly', 17], [others[2]!, 'active', 'yearly', 200], [others[3]!, 'active', 'yearly', 150], [others[4]!, 'active', 'yearly', 300], [others[5]!, 'trialing', 'monthly', 3], [others[6]!, 'trialing', 'monthly', 9],
  ];
  for (const [c, status, cycle, daysLeft] of subs) {
    await db.insert(platformSubscriptions).values({ id: await sid(`platsub:${c.workspaceId}`), workspaceId: c.workspaceId, planKey: 'hoiminh', status, billingCycle: cycle, currentPeriodStart: daysFrom(base, daysLeft - (cycle === 'monthly' ? 30 : 365)), currentPeriodEnd: daysFrom(base, daysLeft), provider: status === 'active' ? 'sepay' : null }).onConflictDoNothing();
  }
  await db
    .insert(providerAccounts)
    .values([
      { id: await sid('provider:sepay'), provider: 'sepay', mode: 'production', enabled: true, lastHealthStatus: 'OK · 1.2s', lastHealthAt: daysFrom(base, 0, 9), configuration: { webhooksThisMonth: 2310, errors: 0 } },
      { id: await sid('provider:momo'), provider: 'momo', mode: 'production', enabled: true, lastHealthStatus: 'Lỗi · 2 lần', lastHealthAt: daysFrom(base, 0, 9, 43), consecutiveFailures: 2, configuration: { note: 'Webhook thất bại lúc 09:41 và 09:43 · đang retry' } },
      { id: await sid('provider:vnpay'), provider: 'vnpay', mode: 'production', enabled: true, lastHealthStatus: 'OK · 0.8s', lastHealthAt: daysFrom(base, 0, 9), configuration: { note: 'IPN ổn định · chữ ký hợp lệ 100%' } },
      { id: await sid('provider:paypal'), provider: 'paypal', mode: 'sandbox', enabled: false, lastHealthStatus: 'Chưa bật', configuration: { note: 'Đang thử nghiệm · chưa nhận tiền thật' } },
    ])
    .onConflictDoNothing();
  const recon: Array<[string, string, string, number, number | null, 'wrong_content' | 'missing_code' | 'amount_mismatch' | 'matched', string]> = [
    ['09:12', 'HM 8K2QX', 'NGUYEN VAN A ck HM8K2Q', 249_000, 249_000, 'wrong_content', 'sepay-tx-90121'],
    ['08:55', 'HM 7ZP3M', 'TRAN THI B chuyen tien', 2_490_000, 2_490_000, 'missing_code', 'sepay-tx-90118'],
    ['08:31', 'HM 5QW1D', 'LE C HM 5QW1D', 200_000, 249_000, 'amount_mismatch', 'sepay-tx-90112'],
    ['08:20', 'HM 4TT9A', 'PHAM D HM 4TT9A', 249_000, 249_000, 'matched', 'sepay-tx-90108'],
  ];
  for (const [time, ref, content, amount, expected, status, txid] of recon) {
    const [h, m] = time.split(':').map(Number);
    await db.insert(reconciliationItems).values({ id: await sid(`recon:${txid}`), provider: 'sepay', providerTransactionId: txid, bankContent: content, bankAccount: '0071000123456', referenceCode: ref, amountMinor: amount, expectedMinor: expected, status, transactionAt: daysFrom(base, 0, h, m), matchedAt: status === 'matched' ? daysFrom(base, 0, h, (m ?? 0) + 1) : null }).onConflictDoNothing();
  }
  await db
    .insert(webhookEvents)
    .values([
      { id: await sid('whe:momo:fail1'), provider: 'momo', providerEventId: 'momo-ipn-77101', eventType: 'ipn', payload: { resultCode: 0, orderId: 'HM-B2N8C' }, signatureVerified: false, processingStatus: 'failed', error: 'Chữ ký không hợp lệ', createdAt: daysFrom(base, 0, 9, 41) },
      { id: await sid('whe:momo:fail2'), provider: 'momo', providerEventId: 'momo-ipn-77102', eventType: 'ipn', payload: { resultCode: 0, orderId: 'HM-B2N8C' }, signatureVerified: false, processingStatus: 'failed', error: 'Chữ ký không hợp lệ', createdAt: daysFrom(base, 0, 9, 43) },
      { id: await sid('whe:sepay:ok'), provider: 'sepay', providerEventId: 'sepay-tx-90108', eventType: 'transfer_in', payload: { content: 'PHAM D HM 4TT9A', transferAmount: 249000 }, signatureVerified: true, processingStatus: 'processed', processedAt: daysFrom(base, 0, 8, 21), createdAt: daysFrom(base, 0, 8, 20) },
    ])
    .onConflictDoNothing();
  await db
    .insert(featureFlags)
    .values([
      { key: 'realtime_chat', description: 'Tin nhắn thời gian thực', enabled: false },
      { key: 'go_live', description: 'Phát trực tiếp trong hội', enabled: false },
      { key: 'affiliate_leaderboard', description: 'Bảng xếp hạng cộng sự', enabled: true },
      { key: 'store', description: 'Cửa hàng trong hội', enabled: true },
      { key: 'mcp', description: 'MCP cho AI', enabled: true },
      { key: 'gamification', description: 'Điểm và cấp độ hoạt động (mục 65, để sau)', enabled: false },
      { key: 'paypal', description: 'Cổng PayPal', enabled: false },
    ])
    .onConflictDoNothing();
  for (const step of ['logo', 'first_post', 'first_course', 'payout_connected']) {
    await db.insert(onboardingProgress).values({ id: await sid(`onb:kd:${step}`), workspaceId: main.workspaceId, communityId: main.id, stepKey: step }).onConflictDoNothing();
  }
  await db
    .insert(auditLogs)
    .values([
      { id: await sid('audit:1'), workspaceId: main.workspaceId, communityId: main.id, actorUserId: U.minhquy!.id, action: 'withdrawal.reveal_account', resourceType: 'affiliate_withdrawal_request', resourceId: await sid('wd:hk:rev'), metadata: { maskedAccount: 'Techcombank ••••3305' }, createdAt: daysFrom(base, 0, 8, 30) },
      { id: await sid('audit:2'), actorUserId: U.admin!.id, action: 'community.lock', resourceType: 'community', resourceId: others[7]!.id, metadata: { reason: 'Vi phạm điều khoản' }, createdAt: daysFrom(base, -2, 15) },
      { id: await sid('audit:3'), actorUserId: U.admin!.id, action: 'provider.toggle', resourceType: 'provider_account', resourceId: 'paypal', metadata: { enabled: false }, createdAt: daysFrom(base, -5, 10) },
    ])
    .onConflictDoNothing();
  await seedMessaging(db, base, U, main);
}

async function seedMessaging(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity): Promise<void> {
  const convs: Array<{ key: string; a: string; b: string; msgs: Array<[string, string, number, boolean?]>; unreadFor?: string }> = [
    { key: 'mq-dien', a: 'minhquy', b: 'dien', msgs: [['minhquy', 'Chào Điền, chào mừng bạn đến với Kinh Doanh Online Cùng AI. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', -33, true], ['dien', 'Mình không vào xem được các bài học. Đã thanh toán gói tháng lúc sáng rồi ạ.', -22], ['minhquy', 'Mình kiểm tra thấy giao dịch 249.000đ đã về lúc 09:03 và gói Premium đã mở. Bạn tải lại trang Khóa học giúp mình nhé, nếu vẫn khóa thì gửi ảnh chụp màn hình.', -1]], unreadFor: 'minhquy' },
    { key: 'mq-cong', a: 'minhquy', b: 'cong', msgs: [['minhquy', 'Chào Công, chào mừng bạn đến với Kinh Doanh Online Cùng AI. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', -15, true]] },
    { key: 'mq-duy', a: 'minhquy', b: 'duy', msgs: [['minhquy', 'Chào Duy, chào mừng bạn đến với Kinh Doanh Online Cùng AI. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', -15, true]] },
    { key: 'mq-hv', a: 'minhquy', b: 'hoangvu', msgs: [['hoangvu', 'Tháng này em lên 23 người trả phí rồi anh', -26], ['hoangvu', 'Em gửi yêu cầu rút 1.5 triệu, anh duyệt giúp em nhé', -25]], unreadFor: 'minhquy' },
    { key: 'mq-hk', a: 'minhquy', b: 'hongkim', msgs: [['hongkim', 'Anh ơi bản ghi buổi Q&A tuần này có chưa ạ?', -74], ['minhquy', 'Mai mình gửi bản ghi buổi Q&A nhé', -72]] },
    { key: 'mq-tl', a: 'minhquy', b: 'thulan', msgs: [['thulan', 'Cảm ơn anh, em đã nhận được link', -96]] },
  ];
  for (const cv of convs) {
    const id = await sid(`conv:${cv.key}`);
    const ua = U[cv.a]!.id;
    const ub = U[cv.b]!.id;
    const pair = [ua, ub].sort().join(':');
    const last = cv.msgs[cv.msgs.length - 1]!;
    const lastAt = new Date(base.getTime() + 9 * 3_600_000 + last[2] * 3_600_000);
    await db.insert(conversations).values({ id, communityId: c.id, pairKey: pair, lastMessageAt: lastAt, lastMessagePreview: last[1].slice(0, 80), lastMessageAutomated: last[3] ?? false, createdAt: daysFrom(base, -2) }).onConflictDoNothing();
    await db.insert(conversationParticipants).values([
      { id: await sid(`cp:${cv.key}:a`), conversationId: id, userId: ua, unreadCount: cv.unreadFor === cv.a ? 1 : 0, lastReadAt: lastAt },
      { id: await sid(`cp:${cv.key}:b`), conversationId: id, userId: ub, unreadCount: cv.unreadFor === cv.b ? 1 : 0, lastReadAt: lastAt },
    ]).onConflictDoNothing();
    for (const [i, [who, body, hours, auto]] of cv.msgs.entries()) {
      await db.insert(messages).values({ id: await sid(`msg:${cv.key}:${i}`), conversationId: id, senderUserId: U[who]!.id, body, automated: auto ?? false, readAt: i < cv.msgs.length - 1 ? lastAt : null, createdAt: new Date(base.getTime() + 9 * 3_600_000 + hours * 3_600_000) }).onConflictDoNothing();
    }
  }
  const mq = U.minhquy!.id;
  const notifs: Array<[string, string, string, string, string, number, boolean, string | null, string]> = [
    ['n1', 'comment', 'comment', 'Công Trần đã bình luận về bài của bạn: “Cảm ơn anh, em đã vào học được rồi ạ”', 'Kinh Doanh Online Cùng AI · Hỏi đáp', -0.4, true, 'Trả lời', 'cong'],
    ['n2', 'affiliate.commission_available', 'affiliate', 'Hoa hồng 124.500đ từ giới thiệu của bạn đã được duyệt sau 14 ngày giữ', 'Cộng sự · Kinh Doanh Online Cùng AI', -2, true, null, 'hoangvu'],
    ['n3', 'mention', 'mention', 'Hồng Kim đã nhắc đến bạn trong “Ngày 3: đơn đầu tiên từ funnel affiliate”', 'Kinh Doanh Online Cùng AI · Nhật ký', -3, true, 'Xem', 'hongkim'],
    ['n4', 'event.reminder', 'event', 'Sự kiện Q&A tuần: Funnel Money Model bắt đầu sau 1 giờ', 'Kinh Doanh Online Cùng AI · Sự kiện', -5, true, 'Vào phòng', 'minhquy'],
    ['n5', 'member.tier_changed', 'payment', 'Điền Phạm Ngọc đã nâng cấp lên Premium qua link của Hoàng Vũ', 'Chủ cộng đồng · Kinh Doanh Online Cùng AI', -24, true, null, 'dien'],
    ['n6', 'post.created', 'post', 'Thu Lan đăng bài mới: “Quy trình viết kịch bản bằng AI trong 20 phút”', 'Faceless YouTube Foundation · Chia sẻ', -40, false, null, 'thulan'],
    ['n7', 'billing.renewal', 'system', 'Gói Premium tại Faceless YouTube Foundation sẽ gia hạn vào 20/09, 199.000đ qua MoMo', 'Hệ thống', -49, false, null, 'admin'],
    ['n8', 'like', 'like', 'Duy Nguyễn và 11 người khác đã thích bài “Lộ trình Funnel Money Model 2026”', 'Kinh Doanh Online Cùng AI · Thông báo', -96, false, null, 'duy'],
  ];
  for (const [key, kind, category, title, body, hours, unread, action, actor] of notifs) {
    await db.insert(notifications).values({ id: await sid(`notif:${key}`), userId: mq, communityId: c.id, kind, category: category as 'comment', title, body, actorUserId: U[actor]!.id, actionLabel: action, link: `/${c.slug}/bang-tin`, readAt: unread ? null : daysFrom(base, -1), createdAt: new Date(base.getTime() + 9 * 3_600_000 + hours * 3_600_000) }).onConflictDoNothing();
  }
  await db.insert(notificationPrefs).values({ userId: mq, emailDigest: true, push: true, likes: false, perCommunity: { [c.id]: 'all' } }).onConflictDoNothing();
}
