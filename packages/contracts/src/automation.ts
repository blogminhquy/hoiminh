// Thẻ và quy tắc tự động: schema cho nguồn đồng bộ, liên hệ, quy tắc "KHI gắn thẻ X THÌ ..." và trang kích hoạt.
import { z } from 'zod';
import { emailSchema } from './common';

/** Tên thẻ người dùng gõ vào; máy chủ chuẩn hóa về chữ thường không dấu (ví dụ `paid`, `order_placed`). */
export const tagNameSchema = z.string().trim().min(1, 'Nhập tên thẻ').max(60);

export const automationActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('grant_membership'), communityId: z.string().uuid(), tierKey: z.enum(['standard', 'premium', 'vip']), durationDays: z.number().int().min(1).max(3650).nullable().default(null) }),
  z.object({ type: z.literal('grant_course'), courseId: z.string().uuid() }),
  z.object({ type: z.literal('send_email'), subject: z.string().trim().min(1, 'Nhập tiêu đề email').max(150), body: z.string().trim().min(1, 'Nhập nội dung email').max(5000) }),
]);
export type AutomationActionInput = z.infer<typeof automationActionSchema>;

export const automationRuleSchema = z.object({
  name: z.string().trim().min(1, 'Đặt tên cho quy tắc').max(120),
  tag: tagNameSchema,
  actions: z.array(automationActionSchema).min(1, 'Quy tắc cần ít nhất một việc để làm').max(6),
  enabled: z.boolean().default(true),
  revokeOnTagRemoved: z.boolean().default(true),
});

export const inboundSourceSchema = z.object({ name: z.string().trim().min(1, 'Đặt tên cho nguồn').max(80) });

const pathSchema = z.string().trim().max(120);
export const inboundSourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['active', 'paused']).optional(),
  mapping: z
    .object({ emailPath: pathSchema, namePath: pathSchema, phonePath: pathSchema, tagPath: pathSchema, removeTagPath: pathSchema, defaultTags: z.array(tagNameSchema).max(10) })
    .partial()
    .optional(),
});

export const contactCreateSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  tags: z.array(tagNameSchema).max(10).default([]),
});

export const contactFilterSchema = z.object({
  q: z.string().max(80).optional(),
  tag: z.string().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const activateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự').max(200).optional(),
});
