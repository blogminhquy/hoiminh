// Hợp đồng khóa học, module, bài học, tiến độ.
import { z } from 'zod';
import { amountMinorSchema, idSchema, videoProviderSchema } from './common';

export const courseStatusSchema = z.enum(['draft', 'published', 'archived']);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

/** 4 lựa chọn "Ai được học" trong màn Tạo khóa học. */
export const courseAccessModeSchema = z.enum(['all_members', 'premium', 'store_only', 'premium_and_store']);
export type CourseAccessMode = z.infer<typeof courseAccessModeSchema>;

export const lessonKindSchema = z.enum(['video', 'text', 'task', 'file']);

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(80),
  shortDescription: z.string().trim().max(200).default(''),
  descriptionMd: z.string().trim().max(20_000).default(''),
  coverFileId: idSchema.nullable().optional(),
  coverColor: z.string().max(16).optional(),
  introVideoUrl: z.string().url().nullable().optional(),
  accessMode: courseAccessModeSchema.default('premium_and_store'),
  priceMinor: amountMinorSchema.nullable().optional(),
  compareAtMinor: amountMinorSchema.nullable().optional(),
  previewFirstModule: z.boolean().default(true),
  affiliateEnabled: z.boolean().default(true),
  dripEnabled: z.boolean().default(false),
  certificateEnabled: z.boolean().default(true),
  sequential: z.boolean().default(false),
  hiddenFromStore: z.boolean().default(false),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export const updateCourseSchema = createCourseSchema.partial().extend({ status: courseStatusSchema.optional() });

export const moduleInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().optional(),
});

export const lessonInputSchema = z.object({
  moduleId: idSchema,
  title: z.string().trim().min(1).max(160),
  kind: lessonKindSchema.default('video'),
  videoUrl: z.string().url().nullable().optional(),
  contentMd: z.string().max(50_000).default(''),
  isPreview: z.boolean().default(false),
  dripDays: z.number().int().min(0).max(365).default(0),
  requireComplete: z.boolean().default(false),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
  resourceFileIds: z.array(idSchema).max(20).optional(),
});
export const updateLessonSchema = lessonInputSchema.partial().omit({ moduleId: true });

export const reorderSchema = z.object({
  modules: z.array(z.object({ id: idSchema, sortOrder: z.number().int(), lessonIds: z.array(idSchema) })),
});

export const embedSchema = z.object({
  provider: videoProviderSchema,
  externalId: z.string(),
  embedUrl: z.string(),
  originalUrl: z.string(),
});
export type VideoEmbed = z.infer<typeof embedSchema>;

/** Nhận diện provider và id video từ URL dán vào. */
export function parseVideoUrl(raw: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const path = url.pathname;
  if (host === 'youtu.be') return yt(path.slice(1).split('/')[0] ?? '', raw);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v) return yt(v, raw);
    const m = path.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
    if (m?.[1]) return yt(m[1], raw);
  }
  if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
    const m = path.match(/\/video\/(\d+)/);
    if (m?.[1]) return { provider: 'tiktok', externalId: m[1], embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, originalUrl: raw };
  }
  if (host === 'facebook.com' || host === 'fb.watch' || host === 'fb.com') {
    return { provider: 'facebook', externalId: raw, embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false`, originalUrl: raw };
  }
  if (host === 'loom.com') {
    const m = path.match(/\/(?:share|embed)\/([a-f0-9]{16,})/);
    if (m?.[1]) return { provider: 'loom', externalId: m[1], embedUrl: `https://www.loom.com/embed/${m[1]}`, originalUrl: raw };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = path.match(/\/(?:video\/)?(\d{6,})/);
    if (m?.[1]) return { provider: 'vimeo', externalId: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}`, originalUrl: raw };
  }
  if (host.endsWith('mediadelivery.net') || host.endsWith('b-cdn.net') || host === 'iframe.mediadelivery.net') {
    const m = path.match(/\/(?:embed|play)\/(\d+)\/([a-f0-9-]{20,})/);
    if (m?.[1] && m[2]) return { provider: 'bunny', externalId: `${m[1]}/${m[2]}`, embedUrl: `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}`, originalUrl: raw };
  }
  return null;
}

function yt(id: string, raw: string): VideoEmbed | null {
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
  return { provider: 'youtube', externalId: id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, originalUrl: raw };
}
