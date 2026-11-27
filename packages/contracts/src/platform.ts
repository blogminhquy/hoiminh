// Hợp đồng cấp nền tảng: API key, webhook gửi đi, quản trị hệ thống, tin nhắn, thông báo, hồ sơ.
import { z } from 'zod';
import { emailSchema, handleSchema, idSchema } from './common';
import { gifIdSchema } from './content';

export const API_SCOPES = [
  'communities:read', 'communities:write', 'members:read', 'members:write', 'posts:write', 'posts:moderate', 'courses:read',
  'courses:write', 'events:write', 'store:write', 'revenue:read', 'billing:manage', 'affiliates:read', 'affiliates:manage',
  'automation:manage', 'messages:read', 'messages:write', 'webhooks:manage', 'entitlements:write',
] as const;
export const apiScopeSchema = z.enum(API_SCOPES);
export type ApiScope = (typeof API_SCOPES)[number];
/** Mỗi phạm vi mở những việc gì, viết cho chủ hội đọc ở màn Nhà phát triển và cho trợ lý AI đọc khi bị từ chối. */
export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  'communities:read': 'Xem hội, bảng tin, sự kiện, cửa hàng',
  'communities:write': 'Tạo hội, sửa thông tin, tiện ích, chuyên mục, câu hỏi tham gia, xem tổng quan',
  'members:read': 'Xem danh sách và hồ sơ thành viên',
  'members:write': 'Mời, duyệt, đổi vai trò, đổi gói, cấp và thu hồi khóa học, khóa, mời ra khỏi hội',
  'posts:write': 'Đăng bài, gửi thông báo, bình luận, thả cảm xúc',
  'posts:moderate': 'Duyệt, sửa, ghim, xóa bài và bình luận',
  'courses:read': 'Xem khóa học và bài học',
  'courses:write': 'Tạo, sửa, xóa khóa học, chương, bài học',
  'events:write': 'Tạo, sửa, hủy sự kiện, thêm và xóa bản ghi, xem người đăng ký',
  'store:write': 'Tạo, sửa, xóa sản phẩm trong cửa hàng',
  'revenue:read': 'Xem doanh thu và đơn hàng',
  'billing:manage': 'Đổi giá và gói thành viên, xác nhận đơn chuyển khoản, hoàn tiền',
  'affiliates:read': 'Xem doanh thu (tên cũ, giữ cho key đã tạo)',
  'affiliates:manage': 'Cài chương trình affiliate, quản lý từng affiliate, duyệt và đánh dấu đã trả hoa hồng',
  'automation:manage': 'Thẻ, liên hệ, nguồn đồng bộ, quy tắc tự động',
  'messages:read': 'Đọc tin nhắn và thông báo của chủ hội',
  'messages:write': 'Gửi và thu hồi tin nhắn dưới tên chủ hội, lưu trữ hội thoại, đánh dấu thông báo đã đọc',
  'webhooks:manage': 'Thêm, sửa, xóa, gửi thử webhook gửi đi',
  'entitlements:write': 'Cấp và thu hồi khóa học, đổi gói cho thành viên',
};
export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(apiScopeSchema).min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const WEBHOOK_EVENTS = [
  'member.joined', 'member.tier_changed', 'member.removed', 'member.banned', 'payment.succeeded', 'payment.refunded', 'subscription.cancelled',
  'lesson.completed', 'course.completed', 'post.created', 'comment.created', 'event.registered', 'affiliate.commission_available',
  'affiliate.withdrawal_requested', 'affiliate.withdrawal_paid',
] as const;
export const webhookEventSchema = z.enum(WEBHOOK_EVENTS);
/** Mỗi sự kiện xảy ra khi nào, viết cho chủ hội đọc lúc chọn sự kiện ở màn Nhà phát triển. */
export const WEBHOOK_EVENT_LABELS: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  'member.joined': 'Có thành viên mới vào hội',
  'member.tier_changed': 'Thành viên đổi gói',
  'member.removed': 'Thành viên bị mời ra khỏi hội',
  'member.banned': 'Thành viên bị khóa',
  'payment.succeeded': 'Có đơn thanh toán thành công',
  'payment.refunded': 'Một đơn được hoàn tiền',
  'subscription.cancelled': 'Thành viên hủy gia hạn gói',
  'lesson.completed': 'Thành viên học xong một bài',
  'course.completed': 'Thành viên học xong một khóa',
  'post.created': 'Có bài đăng mới trên bảng tin (kèm nội dung bài)',
  'comment.created': 'Có bình luận mới (kèm nội dung bình luận)',
  'event.registered': 'Có người đăng ký sự kiện',
  'affiliate.commission_available': 'Hoa hồng affiliate đến hạn rút',
  'affiliate.withdrawal_requested': 'Affiliate gửi yêu cầu rút hoa hồng',
  'affiliate.withdrawal_paid': 'Một yêu cầu rút hoa hồng đã được trả',
};
export type WebhookEventName = z.infer<typeof webhookEventSchema>;
export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventSchema).min(1),
  description: z.string().max(120).default(''),
});
/** Sửa webhook: chỉ gửi trường cần đổi. `status: 'active'` bật lại webhook đã tạm dừng và xóa bộ đếm lỗi. */
export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(webhookEventSchema).min(1).optional(),
  description: z.string().max(120).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

/** Sáu cảm xúc thả được lên tin nhắn (bộ quen thuộc của Zalo). */
/**
 * Ảnh và tệp người dùng tải lên trong tin nhắn riêng tự xóa sau 30 ngày (chủ dự án yêu cầu ngày 27/11/2026), để tin nhắn
 * không thành kho chứa tệp. Chữ của tin vẫn giữ. Nhãn dán và GIF không bị xóa. Ảnh, tệp trong hội thì giữ vĩnh viễn.
 */
export const MESSAGE_MEDIA_TTL_DAYS = 30;
/**
 * Ngày bắt đầu tính hạn: ảnh, tệp gửi trước ngày này được tính 30 ngày kể từ ngày này, để không ai mất đồ đột ngột khi
 * tính năng ra mắt. Tính năng ra sau ngày này thì đổi thành ngày ra mắt.
 */
export const MESSAGE_MEDIA_EXPIRY_START = '2026-12-01T00:00:00+07:00';

/** Thời điểm ảnh, tệp của một tin nhắn hết hạn. */
export function messageMediaExpiresAt(createdAt: Date | string): Date {
  const start = Date.parse(MESSAGE_MEDIA_EXPIRY_START);
  return new Date(Math.max(new Date(createdAt).getTime(), start) + MESSAGE_MEDIA_TTL_DAYS * 86_400_000);
}

/** Số ngày còn lại trước khi ảnh, tệp của tin nhắn tự xóa (làm tròn lên; 0 là trong hôm nay). */
export function messageMediaDaysLeft(createdAt: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((messageMediaExpiresAt(createdAt).getTime() - now.getTime()) / 86_400_000));
}

export const MESSAGE_REACTIONS = ['👍', '❤️', '😆', '😮', '😭', '😡'] as const;
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export const sendMessageSchema = z.object({
  conversationId: idSchema.optional(),
  recipientUserId: idSchema.optional(),
  communityId: idSchema.optional(),
  /** Được để trống khi tin chỉ có ảnh. */
  body: z.string().trim().max(4000).default(''),
  imageFileId: idSchema.nullable().optional(),
  /** Tệp đính kèm (đã tải lên với purpose `message_file`, tối đa 5MB). */
  fileId: idSchema.nullable().optional(),
  replyToId: idSchema.nullable().optional(),
  /** Nhãn dán (id trong bảng stickers). */
  stickerId: idSchema.nullable().optional(),
  /** Ảnh động GIPHY (id của GIPHY). */
  gifId: gifIdSchema.nullable().optional(),
  /** Nhãn dán động lấy từ GIPHY (id của GIPHY). */
  giphyStickerId: gifIdSchema.nullable().optional(),
}).refine((v) => v.body.length > 0 || Boolean(v.imageFileId) || Boolean(v.fileId) || Boolean(v.stickerId) || Boolean(v.gifId) || Boolean(v.giphyStickerId), { message: 'Tin nhắn chưa có nội dung', path: ['body'] });
export const archiveConversationSchema = z.object({ archived: z.boolean().default(true) });
export const USER_REPORT_REASONS = ['spam', 'harassment', 'scam', 'inappropriate', 'other'] as const;
export const reportUserSchema = z.object({ userId: idSchema, conversationId: idSchema.nullable().optional(), reason: z.enum(USER_REPORT_REASONS), detail: z.string().trim().max(1000).default('') });
export const reactMessageSchema = z.object({ emoji: z.enum(MESSAGE_REACTIONS).nullable() });
export const pinConversationSchema = z.object({ pinned: z.boolean() });

export const notificationPrefsSchema = z.object({
  emailDigest: z.boolean().optional(),
  push: z.boolean().optional(),
  likes: z.boolean().optional(),
  perCommunity: z.record(z.enum(['all', 'mentions', 'off'])).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  handle: handleSchema.optional(),
  bio: z.string().max(300).optional(),
  location: z.string().max(80).optional(),
  occupation: z.string().max(80).optional(),
  avatarFileId: idSchema.nullable().optional(),
  /** Ảnh bìa hồ sơ: id tệp vừa tải lên, hoặc null để gỡ ảnh và quay về nền màu. */
  coverFileId: idSchema.nullable().optional(),
  coverColor: z.string().max(16).optional(),
  links: z.array(z.object({ kind: z.string().max(20), label: z.string().max(40), url: z.string().max(200) })).max(6).optional(),
  privacy: z
    .object({ publicProfile: z.boolean(), showProgress: z.boolean(), showCommunities: z.boolean(), allowMessages: z.boolean() })
    .partial()
    .optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(['vi-VN', 'en-US']).optional(),
});

export const adminProviderUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(['sandbox', 'production']).optional(),
  credentials: z.record(z.string()).optional(),
  /** Đặt cổng này làm cách chọn sẵn khi chủ hội mua gói Hội Mình. */
  isDefault: z.literal(true).optional(),
});
export const adminMatchReconciliationSchema = z.object({ paymentReference: z.string().min(4) });
export const adminCommunityActionSchema = z.object({
  action: z.enum(['lock', 'unlock', 'archive']),
  reason: z.string().max(300).default(''),
});
export const adminUserActionSchema = z.object({
  action: z.enum(['suspend', 'activate', 'make_super_admin', 'remove_super_admin']),
  reason: z.string().max(300).default(''),
});
export const inviteSchema = z.object({ emails: z.array(emailSchema).min(1).max(50), role: z.enum(['member', 'admin']).default('member') });
export const workspaceTeamInviteSchema = z.object({ email: emailSchema, role: z.enum(['admin', 'editor']) });
