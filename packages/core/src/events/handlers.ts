// Đăng ký handler nghiệp vụ cho event bus: entitlement, hoa hồng, thông báo, email, webhook gửi đi, tin nhắn chào.
import { formatMoney } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import { and, eq, sql } from 'drizzle-orm';
import { communities, communityMembers, messages, orders, posts, products, scheduledJobs, users, workspaces } from '@hoiminh/db';
import { systemCtx, type AppContext, type Ctx } from '../context';
import { raw } from '../lib/db';
import { createCommissionForPayment, reverseCommissionForPayment, attachAttribution } from '../services/affiliate';
import { grant } from '../services/entitlements';
import { notify } from '../services/notifications';
import { activatePlatformPurchase } from '../services/platform-billing';
import { activateTierPurchase } from '../services/subscriptions';
import { dispatch } from '../services/webhooks-out';

async function userOf(ctx: Ctx, id: string) {
  return ctx.db.query.users.findFirst({ where: eq(users.id, id) });
}
async function communityOf(ctx: Ctx, id: string | null) {
  return id ? ctx.db.query.communities.findFirst({ where: eq(communities.id, id) }) : null;
}

/** Gắn toàn bộ handler vào bus. Gọi một lần khi khởi động. */
export function registerHandlers(app: AppContext): void {
  const bus = app.events;
  const ctx = () => systemCtx(app);

  bus.on('user.registered', async (p) => {
    const c = ctx();
    await attachAttribution(c, p.userId, null, p.ref);
  });

  bus.on('member.joined', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    const user = await userOf(c, p.userId);
    if (!community || !user) return;
    const plugin = await raw(c.db, sql`select enabled, config from community_plugins where community_id = ${p.communityId} and plugin_key = 'welcome_dm'`);
    const row = plugin[0] as { enabled: boolean; config: { delayMinutes?: number } } | undefined;
    if (row?.enabled) {
      const delay = Number(row.config?.delayMinutes ?? 2);
      await c.db.insert(scheduledJobs).values({ kind: 'welcome_dm.send', payload: { communityId: p.communityId, userId: p.userId }, dedupeKey: `welcome_dm:${p.communityId}:${p.userId}`, runAt: new Date(c.now().getTime() + delay * 60_000) }).onConflictDoNothing();
    }
    await c.email.send(templates.welcomeMember(user.email, user.name, community.name, `${c.env.APP_URL}/${community.slug}/bang-tin`));
    const owner = await c.db.query.workspaces.findFirst({ where: eq(workspaces.id, community.workspaceId), columns: { ownerUserId: true } });
    if (owner && owner.ownerUserId !== p.userId) await notify(c, { userId: owner.ownerUserId, communityId: p.communityId, kind: 'member.joined', category: 'all', title: `${user.name} vừa tham gia ${community.name}`, body: p.referredByAffiliateId ? 'qua link cộng sự' : '', actorUserId: p.userId, link: `/${community.slug}/thanh-vien` });
    await dispatch(c, community.workspaceId, 'member.joined', { communityId: p.communityId, userId: p.userId, memberId: p.memberId, email: user.email, name: user.name, source: p.source });
  });

  bus.on('member.tier_changed', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    if (!community) return;
    await dispatch(c, community.workspaceId, 'member.tier_changed', { communityId: p.communityId, userId: p.userId, fromTierId: p.fromTierId, toTierId: p.toTierId, reason: p.reason });
  });

  bus.on('payment.succeeded', async (p) => {
    const c = ctx();
    const order = await c.db.query.orders.findFirst({ where: eq(orders.id, p.orderId) });
    const user = await userOf(c, p.userId);
    if (!order || !user) return;
    const meta = order.metadata as { cycle?: 'monthly' | 'yearly' | 'one_time'; title?: string; communitySlug?: string; productSlug?: string; kind?: string };
    const paidAt = order.paidAt ?? c.now();
    if (p.targetType === 'tier' && p.communityId) {
      await activateTierPurchase(c, { orderId: order.id, userId: p.userId, communityId: p.communityId, tierId: p.targetId, cycle: meta.cycle ?? 'monthly', amountMinor: p.amountMinor, provider: p.provider, affiliateAccountId: p.affiliateAccountId, paidAt });
    } else if (p.targetType === 'product' && p.communityId) {
      const product = await c.db.query.products.findFirst({ where: eq(products.id, p.targetId) });
      await grant(c, { userId: p.userId, workspaceId: p.workspaceId, communityId: p.communityId, resourceType: 'product', resourceId: p.targetId, sourceType: 'purchase', sourceId: order.id });
      if (product?.kind === 'bundle') {
        const items = await raw(c.db, sql`select item_product_id from bundle_items where bundle_product_id = ${product.id}`);
        for (const r of items as Array<{ item_product_id: string }>) await grant(c, { userId: p.userId, workspaceId: p.workspaceId, communityId: p.communityId, resourceType: 'product', resourceId: r.item_product_id, sourceType: 'community_bundle', sourceId: order.id });
      }
      const m = await c.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, p.communityId), eq(communityMembers.userId, p.userId)) });
      if (!m) {
        // Người ngoài hội mua lẻ: tạo thành viên Tiêu chuẩn để vào học (mục 153 cho phép học không cần hội; V1 gắn vào hội để có dashboard).
        const { joinCommunity } = await import('../services/members');
        const community = await communityOf(c, p.communityId);
        if (community && (community.pricingMode === 'free' || community.pricingMode === 'freemium')) await joinCommunity({ ...c, actor: { type: 'user', userId: p.userId, isSuperAdmin: false, email: user.email } }, community.slug, {}).catch(() => null);
      }
    } else if (p.targetType === 'platform' && p.workspaceId) {
      await activatePlatformPurchase(c, { workspaceId: p.workspaceId, orderId: order.id, cycle: (meta.cycle as 'monthly' | 'yearly') ?? 'monthly', paidAt, provider: p.provider, userId: p.userId });
    }
    await createCommissionForPayment(c, { paymentId: p.paymentId, orderId: p.orderId, userId: p.userId, communityId: p.communityId, workspaceId: p.workspaceId, amountMinor: p.amountMinor, targetType: p.targetType, affiliateAccountId: p.affiliateAccountId });
    const community = await communityOf(c, p.communityId);
    const link = p.targetType === 'platform' ? `${c.env.APP_URL}/admin` : p.targetType === 'product' ? `${c.env.APP_URL}/${community?.slug}/cua-hang/${meta.productSlug ?? ''}` : `${c.env.APP_URL}/${community?.slug}/khoa-hoc`;
    await c.email.send(templates.paymentSucceeded(user.email, user.name, meta.title ?? 'đơn hàng', formatMoney(p.amountMinor, p.currency as 'VND'), link));
    await notify(c, { userId: p.userId, communityId: p.communityId, kind: 'payment.succeeded', category: 'payment', title: `Thanh toán ${formatMoney(p.amountMinor, p.currency as 'VND')} thành công · ${meta.title ?? ''}`, body: 'Quyền truy cập đã được mở', link: link.replace(c.env.APP_URL, ''), actionLabel: 'Vào học' });
    if (community) {
      const owner = await c.db.query.workspaces.findFirst({ where: eq(workspaces.id, community.workspaceId), columns: { ownerUserId: true } });
      if (owner && owner.ownerUserId !== p.userId) await notify(c, { userId: owner.ownerUserId, communityId: p.communityId, kind: 'member.paid', category: 'payment', title: `${user.name} đã thanh toán ${formatMoney(p.amountMinor)} · ${meta.title ?? ''}`, body: p.affiliateAccountId ? 'qua link cộng sự' : '', actorUserId: p.userId, link: `/${community.slug}/doanh-thu` });
    }
    await dispatch(c, p.workspaceId, 'payment.succeeded', { paymentId: p.paymentId, orderId: p.orderId, userId: p.userId, email: user.email, amountMinor: p.amountMinor, currency: p.currency, provider: p.provider, targetType: p.targetType, targetId: p.targetId, title: meta.title });
  });

  bus.on('payment.refunded', async (p) => {
    const c = ctx();
    await reverseCommissionForPayment(c, p.paymentId);
    const order = await c.db.query.orders.findFirst({ where: eq(orders.id, p.orderId) });
    await notify(c, { userId: p.userId, communityId: p.communityId, kind: 'payment.refunded', category: 'payment', title: `Đã hoàn ${formatMoney(p.amountMinor)} cho ${(order?.metadata as { title?: string } | undefined)?.title ?? 'đơn hàng'}`, body: 'Tiền về theo phương thức đã trả trong 3–7 ngày làm việc' });
    await dispatch(c, order?.workspaceId ?? null, 'payment.refunded', { paymentId: p.paymentId, orderId: p.orderId, userId: p.userId, amountMinor: p.amountMinor });
  });

  bus.on('subscription.cancelled', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    await dispatch(c, community?.workspaceId ?? null, 'subscription.cancelled', { subscriptionId: p.subscriptionId, userId: p.userId, communityId: p.communityId, periodEnd: p.periodEnd });
  });

  bus.on('lesson.completed', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    await dispatch(c, community?.workspaceId ?? null, 'lesson.completed', { userId: p.userId, lessonId: p.lessonId, courseId: p.courseId, percent: p.percent });
  });
  bus.on('course.completed', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    await notify(c, { userId: p.userId, communityId: p.communityId, kind: 'course.completed', category: 'system', title: 'Chúc mừng, bạn đã hoàn thành khóa học', body: 'Chứng nhận có tên bạn đã sẵn sàng', link: community ? `/${community.slug}/khoa-hoc/${p.courseId}` : null, actionLabel: 'Xem' });
    await dispatch(c, community?.workspaceId ?? null, 'course.completed', { userId: p.userId, courseId: p.courseId });
  });

  bus.on('post.created', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    if (!community) return;
    await dispatch(c, community.workspaceId, 'post.created', { postId: p.postId, communityId: p.communityId, authorUserId: p.authorUserId, title: p.title });
    const post = await c.db.query.posts.findFirst({ where: eq(posts.id, p.postId), columns: { contentMd: true } });
    const handles = post ? [...post.contentMd.matchAll(/(^|\s)@([a-z0-9][a-z0-9-]{2,31})/g)].map((m) => m[2]!) : [];
    const author = await userOf(c, p.authorUserId);
    for (const h of new Set(handles)) {
      const u = await c.db.query.users.findFirst({ where: eq(users.handle, h) });
      if (u && u.id !== p.authorUserId) await notify(c, { userId: u.id, communityId: p.communityId, kind: 'mention', category: 'mention', title: `${author?.name ?? 'Ai đó'} đã nhắc đến bạn trong “${p.title}”`, actorUserId: p.authorUserId, link: `/${community.slug}/bai-viet/${p.postId}`, actionLabel: 'Xem' });
    }
  });

  bus.on('comment.created', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    const author = await userOf(c, p.authorUserId);
    if (!community || !author) return;
    const post = p.targetType === 'post' ? await c.db.query.posts.findFirst({ where: eq(posts.id, p.targetId) }) : null;
    const link = p.targetType === 'post' ? `/${community.slug}/bai-viet/${p.targetId}` : p.targetType === 'event' ? `/${community.slug}/su-kien/${p.targetId}` : `/${community.slug}/khoa-hoc`;
    if (post && post.authorUserId !== p.authorUserId) await notify(c, { userId: post.authorUserId, communityId: p.communityId, kind: 'comment', category: 'comment', title: `${author.name} đã bình luận về bài của bạn`, actorUserId: p.authorUserId, link, actionLabel: 'Trả lời' });
    if (p.parentCommentId) {
      const parent = await raw(c.db, sql`select author_user_id from comments where id = ${p.parentCommentId}`);
      const pid = (parent[0] as { author_user_id: string } | undefined)?.author_user_id;
      if (pid && pid !== p.authorUserId && pid !== post?.authorUserId) await notify(c, { userId: pid, communityId: p.communityId, kind: 'reply', category: 'comment', title: `${author.name} đã trả lời bình luận của bạn`, actorUserId: p.authorUserId, link, actionLabel: 'Xem' });
    }
    for (const h of p.mentionedHandles) {
      const u = await c.db.query.users.findFirst({ where: eq(users.handle, h) });
      if (u && u.id !== p.authorUserId) await notify(c, { userId: u.id, communityId: p.communityId, kind: 'mention', category: 'mention', title: `${author.name} đã nhắc đến bạn trong một bình luận`, actorUserId: p.authorUserId, link, actionLabel: 'Xem' });
    }
  });

  bus.on('event.registered', async (p) => {
    const c = ctx();
    const community = await communityOf(c, p.communityId);
    await dispatch(c, community?.workspaceId ?? null, 'event.registered', { eventId: p.eventId, communityId: p.communityId, userId: p.userId });
  });

  bus.on('affiliate.commission_available', async (p) => {
    const c = ctx();
    const user = await userOf(c, p.userId);
    if (!user) return;
    const program = await raw(c.db, sql`select community_id, workspace_id from affiliate_programs where id = ${p.programId}`);
    const pr = program[0] as { community_id: string | null; workspace_id: string | null } | undefined;
    await notify(c, { userId: p.userId, communityId: pr?.community_id ?? null, kind: 'affiliate.commission_available', category: 'affiliate', title: `Hoa hồng ${formatMoney(p.amountMinor)} từ giới thiệu của bạn đã được duyệt sau thời gian giữ`, link: '/tai-khoan/cong-su', actionLabel: 'Xem ví' });
    await c.email.send(templates.commissionAvailable(user.email, user.name, formatMoney(p.amountMinor), `${c.env.APP_URL}/tai-khoan/cong-su`));
    await dispatch(c, pr?.workspace_id ?? null, 'affiliate.commission_available', { commissionId: p.commissionId, affiliateAccountId: p.affiliateAccountId, userId: p.userId, amountMinor: p.amountMinor });
  });

  bus.on('affiliate.withdrawal_requested', async (p) => {
    const c = ctx();
    const program = await raw(c.db, sql`select payer_user_id, community_id, name from affiliate_programs where id = ${p.programId}`);
    const pr = program[0] as { payer_user_id: string | null; community_id: string | null; name: string } | undefined;
    if (pr?.payer_user_id) await notify(c, { userId: pr.payer_user_id, communityId: pr.community_id, kind: 'affiliate.withdrawal_requested', category: 'affiliate', title: `Yêu cầu rút ${formatMoney(p.amountMinor)} mới từ cộng sự`, link: pr.community_id ? `/${(await communityOf(c, pr.community_id))?.slug}/cai-dat/cong-su/rut-tien` : '/he-thong/cong-su', actionLabel: 'Xử lý' });
  });

  bus.on('affiliate.withdrawal_paid', async (p) => {
    const c = ctx();
    const user = await userOf(c, p.userId);
    if (!user) return;
    await c.email.send(templates.withdrawalPaid(user.email, user.name, formatMoney(p.amountMinor), p.transferReference));
    await notify(c, { userId: p.userId, kind: 'affiliate.withdrawal_paid', category: 'affiliate', title: `Đã chuyển ${formatMoney(p.amountMinor)} cho bạn · mã ${p.transferReference}`, link: '/tai-khoan/cong-su' });
    const program = await raw(c.db, sql`select workspace_id from affiliate_programs where id = ${p.programId}`);
    await dispatch(c, (program[0] as { workspace_id: string | null } | undefined)?.workspace_id ?? null, 'affiliate.withdrawal_paid', { withdrawalId: p.withdrawalId, userId: p.userId, amountMinor: p.amountMinor, transferReference: p.transferReference });
  });

  bus.on('affiliate.withdrawal_rejected', async (p) => {
    const c = ctx();
    const user = await userOf(c, p.userId);
    if (!user) return;
    await c.email.send(templates.withdrawalRejected(user.email, user.name, formatMoney(p.amountMinor), p.reason));
    await notify(c, { userId: p.userId, kind: 'affiliate.withdrawal_rejected', category: 'affiliate', title: `Yêu cầu rút ${formatMoney(p.amountMinor)} bị từ chối: ${p.reason}`, link: '/tai-khoan/cong-su' });
  });

  bus.on('message.sent', async (p) => {
    const c = ctx();
    const sender = await userOf(c, p.senderUserId);
    // Thời gian thực: đẩy tin ngay cho người nhận đang mở luồng, và cho chính người gửi ở tab/thiết bị khác.
    const msg = await c.db.query.messages.findFirst({ where: eq(messages.id, p.messageId) });
    if (msg) {
      c.realtime.publish([...p.recipientUserIds, p.senderUserId], {
        type: 'message.new',
        conversationId: p.conversationId,
        message: { id: msg.id, conversationId: msg.conversationId, senderUserId: msg.senderUserId, body: msg.body, imageUrl: msg.imageUrl, automated: msg.automated, readAt: msg.readAt?.toISOString() ?? null, createdAt: msg.createdAt.toISOString() },
        senderName: sender?.name ?? 'Ai đó',
        preview: msg.body.slice(0, 120),
      });
      c.realtime.publish(p.recipientUserIds, { type: 'badges.changed' });
    }
    for (const rid of p.recipientUserIds) {
      const r = await userOf(c, rid);
      if (!r) continue;
      const online = r.lastSeenAt && c.now().getTime() - r.lastSeenAt.getTime() < 15 * 60_000;
      if (!online && !p.automated) await c.email.send(templates.newMessage(r.email, sender?.name ?? 'Ai đó', 'Bạn có tin nhắn mới trên Hội Mình', `${c.env.APP_URL}/tin-nhan?c=${p.conversationId}`));
      if (p.automated && !online) await c.email.send(templates.newMessage(r.email, sender?.name ?? 'Chủ hội', 'Chủ hội vừa gửi lời chào cho bạn', `${c.env.APP_URL}/tin-nhan?c=${p.conversationId}`));
    }
  });
}
