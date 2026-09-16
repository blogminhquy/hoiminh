// Event bus nội bộ có kiểu: module nghiệp vụ chỉ phát sự kiện, handler khác lắng nghe (mục 18, 34E).
export interface DomainEvents {
  'member.joined': { communityId: string; userId: string; memberId: string; source: string; referredByAffiliateId: string | null };
  'member.tier_changed': { communityId: string; userId: string; memberId: string; fromTierId: string | null; toTierId: string | null; reason: string };
  'member.banned': { communityId: string; userId: string; memberId: string };
  'member.removed': { communityId: string; userId: string; memberId: string };
  'payment.succeeded': { paymentId: string; orderId: string; userId: string; workspaceId: string | null; communityId: string | null; amountMinor: number; currency: string; provider: string; targetType: 'tier' | 'product' | 'platform'; targetId: string; affiliateAccountId: string | null };
  'payment.failed': { paymentId: string; orderId: string; userId: string; reason: string };
  'payment.refunded': { paymentId: string; orderId: string; userId: string; communityId: string | null; amountMinor: number; refundId: string };
  'subscription.cancelled': { subscriptionId: string; userId: string; communityId: string | null; periodEnd: string };
  'subscription.expired': { subscriptionId: string; userId: string; communityId: string | null };
  'lesson.completed': { userId: string; lessonId: string; courseId: string; communityId: string | null; percent: number };
  'course.completed': { userId: string; courseId: string; communityId: string | null };
  'post.created': { postId: string; communityId: string; authorUserId: string; spaceId: string; broadcast: boolean; title: string };
  'comment.created': { commentId: string; communityId: string; authorUserId: string; targetType: string; targetId: string; parentCommentId: string | null; mentionedHandles: string[] };
  'event.registered': { eventId: string; communityId: string; userId: string };
  'event.created': { eventId: string; communityId: string; announce: boolean; broadcast: boolean };
  'affiliate.clicked': { affiliateAccountId: string; visitorId: string };
  'affiliate.commission_created': { commissionId: string; affiliateAccountId: string; amountMinor: number };
  'affiliate.commission_available': { commissionId: string; affiliateAccountId: string; amountMinor: number; userId: string; programId: string };
  'affiliate.withdrawal_requested': { withdrawalId: string; programId: string; affiliateAccountId: string; amountMinor: number };
  'affiliate.withdrawal_paid': { withdrawalId: string; programId: string; affiliateAccountId: string; amountMinor: number; userId: string; transferReference: string };
  'affiliate.withdrawal_rejected': { withdrawalId: string; affiliateAccountId: string; amountMinor: number; userId: string; reason: string };
  'message.sent': { messageId: string; conversationId: string; senderUserId: string; recipientUserIds: string[]; automated: boolean };
  'platform.trial_started': { workspaceId: string; ownerUserId: string; trialEndsAt: string };
  'platform.subscription_activated': { workspaceId: string; cycle: 'monthly' | 'yearly'; periodEnd: string };
  'platform.locked': { workspaceId: string };
  'user.registered': { userId: string; email: string; ref: string | null; communitySlug: string | null };
}

export type EventName = keyof DomainEvents;
/**
 * `meta.ctx` là ngữ cảnh của bên phát: handler phải dùng `meta.ctx.db` để chạy chung
 * transaction (và chung biến phiên RLS) với request đã phát ra sự kiện. Không có thì
 * handler rơi về ngữ cảnh hệ thống lúc đăng ký.
 */
export type EventMeta = { eventId: string; at: Date; ctx?: EmitterCtx };
/** Chỉ cần phần Ctx mà handler dùng; khai báo lỏng để tránh vòng phụ thuộc kiểu. */
export type EmitterCtx = { db: unknown };
export type Handler<K extends EventName> = (payload: DomainEvents[K], meta: EventMeta) => Promise<void> | void;

export interface EventBus {
  emit<K extends EventName>(name: K, payload: DomainEvents[K], ctx?: EmitterCtx): Promise<void>;
  on<K extends EventName>(name: K, handler: Handler<K>): void;
}

/** Bus trong tiến trình: handler chạy tuần tự, lỗi một handler không chặn handler khác. */
export function createEventBus(onError: (name: string, err: unknown) => void = (n, e) => console.error('[event]', n, e)): EventBus {
  const handlers = new Map<EventName, Array<Handler<EventName>>>();
  return {
    on(name, handler) {
      const list = handlers.get(name) ?? [];
      list.push(handler as Handler<EventName>);
      handlers.set(name, list);
    },
    async emit(name, payload, ctx) {
      const meta: EventMeta = { eventId: crypto.randomUUID(), at: new Date(), ctx };
      for (const h of handlers.get(name) ?? []) {
        try {
          await h(payload, meta);
        } catch (err) {
          onError(name, err);
        }
      }
    },
  };
}
