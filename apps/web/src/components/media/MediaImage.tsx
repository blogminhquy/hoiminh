// Ảnh đính kèm của bình luận hay tin nhắn: nhãn dán (không khung, cỡ vừa), GIF (có nhãn nhỏ "GIF"), hoặc ảnh tải lên.
import type { MediaKind } from './types';

export function MediaImage({ url, kind, onLoad, className = '' }: { url: string; kind: MediaKind | null | undefined; onLoad?: () => void; className?: string }) {
  if (kind === 'sticker') return <img src={url} alt="Nhãn dán" className={`media-sticker ${className}`} loading="lazy" draggable={false} onLoad={onLoad} />;
  if (kind === 'gif') {
    return (
      <span className={`media-gif ${className}`}>
        <img src={url} alt="Ảnh động GIF" loading="lazy" onLoad={onLoad} />
        <span className="media-gif-tag" aria-hidden>GIF</span>
      </span>
    );
  }
  return <img src={url} alt="" className={`media-photo ${className}`} loading="lazy" onLoad={onLoad} />;
}
