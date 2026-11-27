// Kiểu dữ liệu dùng chung của khung chọn nhãn dán, emoji, GIF.
export interface Sticker { id: string; url: string; keywords: string[]; width?: number | null; height?: number | null }
export interface StickerPack { id: string; name: string; stickers: Sticker[] }
export interface StickerList { packs: StickerPack[]; gifEnabled: boolean }
export interface GifItem { id: string; title: string; url: string; previewUrl: string; width: number; height: number }
export type MediaKind = 'sticker' | 'gif';

/** Thứ người dùng vừa chọn để gửi ngay: nhãn dán hoặc GIF. */
export type PickedMedia = { kind: 'sticker'; sticker: Sticker } | { kind: 'gif'; gif: GifItem };

/** Phần gửi lên API cho thứ vừa chọn, kèm link ảnh để hiện ngay trong lúc chờ máy chủ trả lời. */
export function mediaPayload(m: PickedMedia): { body: { stickerId?: string; giphyStickerId?: string; gifId?: string }; imageUrl: string; mediaKind: MediaKind } {
  if (m.kind === 'gif') return { body: { gifId: m.gif.id }, imageUrl: m.gif.url, mediaKind: 'gif' };
  const id = m.sticker.id;
  return { body: id.startsWith('giphy:') ? { giphyStickerId: id.slice(6) } : { stickerId: id }, imageUrl: m.sticker.url, mediaKind: 'sticker' };
}
