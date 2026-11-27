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
  /** Báo bài này cho tất cả thành viên bằng thông báo trong ứng dụng. Tên trường giữ từ thời còn gửi email, để API không đổi. */
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

/** Id ảnh động của GIPHY: chỉ chữ và số, để máy chủ tự dựng link GIF chứ không nhận link bất kỳ từ người dùng. */
export const gifIdSchema = z.string().regex(/^[A-Za-z0-9]{4,64}$/, 'GIF không hợp lệ');

/**
 * Bình luận: chữ, kèm tối đa một trong ba thứ: ảnh tải lên, nhãn dán, GIF. Được để trống chữ khi đã có một trong ba
 * (máy chủ kiểm, vì schema này còn được merge với target nên không dùng refine ở đây).
 */
export const createCommentSchema = z.object({
  contentMd: z.string().trim().max(5000).default(''),
  parentCommentId: idSchema.nullable().optional(),
  imageFileId: idSchema.nullable().optional(),
  stickerId: idSchema.nullable().optional(),
  gifId: gifIdSchema.nullable().optional(),
  /** Nhãn dán động lấy từ GIPHY (id của GIPHY). */
  giphyStickerId: gifIdSchema.nullable().optional(),
});
/** Sửa bình luận: chỉ đổi nội dung chữ, ảnh đính kèm và vị trí trong luồng giữ nguyên. */
export const updateCommentSchema = z.object({ contentMd: z.string().trim().max(5000) });

export const reactionTargetSchema = z.enum(['post', 'comment']);
/** Các loại cảm xúc cho bài viết và bình luận (giống thanh cảm xúc của Facebook). */
export const REACTION_KINDS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const toggleReactionSchema = z.object({
  targetType: reactionTargetSchema,
  targetId: idSchema,
  /** Bỏ trống: bật tắt kiểu cũ (chưa thả thì Thích, đã thả thì gỡ). Có giá trị: thả đúng loại đó, đổi loại, hoặc gỡ nếu trùng loại đang thả. */
  reaction: z.enum(REACTION_KINDS).optional(),
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

// ---- Nhãn dán (Hệ thống · Nhãn dán) ----
/** Từ khóa gợi ý của một nhãn: chữ thường, bỏ khoảng trắng thừa, bỏ trùng, tối đa 20 từ. */
export const stickerKeywordsSchema = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).transform((ks) => [...new Set(ks.map((k) => k.replace(/\s+/g, ' ')))]);
export const stickerPackSchema = z.object({ name: z.string().trim().min(1, 'Nhập tên bộ nhãn').max(60), active: z.boolean().optional() });
export const stickerPackUpdateSchema = stickerPackSchema.partial();
/** Thêm nhãn vào bộ: các ảnh đã tải lên (purpose `sticker`), mỗi lần tối đa 60 ảnh. */
export const addStickersSchema = z.object({ items: z.array(z.object({ fileId: idSchema, keywords: stickerKeywordsSchema.default([]) })).min(1).max(60) });
export const updateStickerSchema = z.object({ keywords: stickerKeywordsSchema });
/** Thứ tự mới: toàn bộ id theo đúng thứ tự hiển thị. */
export const stickerOrderSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });

