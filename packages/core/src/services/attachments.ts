// Thứ đính kèm của một bình luận hay một tin nhắn ngoài chữ: ảnh tải lên, nhãn dán hoặc GIF (mỗi lần tối đa một thứ).
// Cả ba cùng lưu thành link ảnh ở cột image_url; cột media_kind cho biết là nhãn dán hay GIF để web vẽ cho đúng
// (nhãn không có bong bóng, GIF có nhãn nhỏ "GIF").
import type { MediaKind } from '@hoiminh/db';
import { files } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import type { Ctx } from '../context';
import { invalid, notFound } from '../errors';
import { gifEnabled, gifUrl } from './gifs';
import { resolveSticker } from './stickers';

/** `giphyStickerId`: nhãn dán động nền trong lấy từ GIPHY (cùng khóa với GIF), lưu như một nhãn dán. */
export interface AttachmentInput { imageFileId?: string | null; stickerId?: string | null; gifId?: string | null; giphyStickerId?: string | null }
export interface Attachment { imageUrl: string | null; mediaKind: MediaKind | null }

export async function resolveAttachment(ctx: Ctx, input: AttachmentInput): Promise<Attachment> {
  const picked = [input.imageFileId, input.stickerId, input.gifId, input.giphyStickerId].filter(Boolean).length;
  if (picked > 1) throw invalid('Mỗi lần chỉ gửi kèm một ảnh, một nhãn dán hoặc một GIF');
  if (input.stickerId) return { imageUrl: await resolveSticker(ctx, input.stickerId), mediaKind: 'sticker' };
  if (input.gifId || input.giphyStickerId) {
    if (!gifEnabled(ctx)) throw invalid('GIF chưa được bật trên hệ thống');
    return input.gifId ? { imageUrl: gifUrl(input.gifId), mediaKind: 'gif' } : { imageUrl: gifUrl(input.giphyStickerId!), mediaKind: 'sticker' };
  }
  if (input.imageFileId) {
    const url = (await ctx.db.query.files.findFirst({ where: eq(files.id, input.imageFileId) }))?.url ?? null;
    if (!url) throw notFound('Không tìm thấy ảnh đã tải lên');
    return { imageUrl: url, mediaKind: null };
  }
  return { imageUrl: null, mediaKind: null };
}
