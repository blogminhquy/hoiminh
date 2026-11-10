// Hợp đồng cấp nền tảng: API key, webhook gửi đi, quản trị hệ thống, tin nhắn, thông báo, hồ sơ.
import { z } from 'zod';
import { emailSchema, handleSchema, idSchema } from './common';

export const API_SCOPES = [
  'communities:read', 'communities:write', 'members:read', 'members:write', 'posts:write', 'courses:read',
  'courses:write', 'events:write', 'affiliates:read', 'affiliates:manage', 'messages:write', 'entitlements:write',
] as const;
export const apiScopeSchema = z.enum(API_SCOPES);
export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(apiScopeSchema).min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const WEBHOOK_EVENTS = [
  'member.joined', 'member.tier_changed', 'payment.succeeded', 'payment.refunded', 'subscription.cancelled',
  'lesson.completed', 'course.completed', 'post.created', 'event.registered', 'affiliate.commission_available',
  'affiliate.withdrawal_paid',
] as const;
export const webhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEventName = z.infer<typeof webhookEventSchema>;
export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventSchema).min(1),
  description: z.string().max(120).default(''),
});

/** Sáu cảm xúc thả được lên tin nhắn (bộ quen thuộc của Zalo). */
export const MESSAGE_REACTIONS = ['👍', '❤️', '😆', '😮', '😭', '😡'] as const;
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export const sendMessageSchema = z.object({
  conversationId: idSchema.optional(),
  recipientUserId: idSchema.optional(),
  communityId: idSchema.optional(),
  /** Được để trống khi tin chỉ có ảnh. */
  body: z.string().trim().max(4000).default(''),
  imageFileId: idSchema.nullable().optional(),
  replyToId: idSchema.nullable().optional(),
}).refine((v) => v.body.length > 0 || Boolean(v.imageFileId), { message: 'Tin nhắn chưa có nội dung', path: ['body'] });
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
