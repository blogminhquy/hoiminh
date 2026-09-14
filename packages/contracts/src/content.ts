// Hợp đồng nội dung: bài viết, bình luận, bình chọn, phản ứng.
import { z } from 'zod';
import { idSchema } from './common';

/** 8 nền màu mẫu cho status ngắn (STATUS_BGS trong design/build.mjs). */
export const STATUS_BG_KEYS = ['dat', 'ngoc', 'nau', 'vang', 'tim', 'la', 'giay', 'hoang'] as const;
export const statusBgKeySchema = z.enum(STATUS_BG_KEYS);
export type StatusBgKey = z.infer<typeof statusBgKeySchema>;

export const createPostSchema = z.object({
  spaceId: idSchema,
  title: z.string().trim().max(160).default(''),
  contentMd: z.string().trim().min(1).max(50_000),
  statusBgKey: statusBgKeySchema.nullable().optional(),
  imageFileIds: z.array(idSchema).max(20).default([]),
  videoUrl: z.string().url().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  broadcastEmail: z.boolean().default(false),
  poll: z
    .object({
      question: z.string().trim().min(1).max(200),
      options: z.array(z.string().trim().min(1).max(80)).min(2).max(8),
      multipleChoice: z.boolean().default(false),
      closesAt: z.string().datetime().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = createPostSchema.partial().extend({ pinned: z.boolean().optional() });

export const feedQuerySchema = z.object({
  spaceId: idSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createCommentSchema = z.object({
  contentMd: z.string().trim().min(1).max(5000),
  parentCommentId: idSchema.nullable().optional(),
  imageFileId: idSchema.nullable().optional(),
});

export const reactionTargetSchema = z.enum(['post', 'comment']);
export const toggleReactionSchema = z.object({
  targetType: reactionTargetSchema,
  targetId: idSchema,
  reaction: z.enum(['like']).default('like'),
});

export const voteSchema = z.object({ optionIds: z.array(idSchema).min(1).max(8) });

/** Ảnh trong bài viết. */
export const postImageSchema = z.object({
  id: idSchema,
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sortOrder: z.number(),
});
