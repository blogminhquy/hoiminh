// Ô viết bình luận kiểu Facebook: ô gõ bo tròn tự cao lên khi gõ, dưới là thanh công cụ (emoji, ảnh, GIF, nhãn dán)
// và nút gửi. Enter để gửi, Shift Enter để xuống dòng (trên điện thoại Enter là xuống dòng, gửi bằng nút mũi tên).
// Ảnh: chọn tệp hoặc dán thẳng vào ô gõ, có xem trước và nút bỏ. Nhãn dán và GIF gửi ngay khi chọn. Gõ chữ trùng từ
// khóa của nhãn ("cảm ơn", "haha"...) thì hiện dải nhãn gợi ý phía trên ô, chạm là gửi nhãn thay cho chữ (như Zalo).
import { Avatar, T } from '@hoiminh/ui';
import { Camera, SendHorizontal, Smile, Sticker as StickerIcon, X } from 'lucide-react';
import { useRef, useState, type ClipboardEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOptionalShell } from '@/lib/community';
import { MediaPicker, type PickerTab } from './media/MediaPicker';
import { StickerSuggest } from './media/StickerSuggest';
import { useStickers } from './media/stickers';
import type { PickedMedia } from './media/types';

export interface ComposerSubmit { text: string; image?: { fileId: string; url: string }; media?: PickedMedia }

export function CommentComposer({ onSubmit, placeholder, loading, autoFocus, compact }: { onSubmit: (c: ComposerSubmit) => void; placeholder: string; loading?: boolean; autoFocus?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ fileId: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const shell = useOptionalShell();
  const [problem, setProblem] = useState('');
  const [picker, setPicker] = useState<PickerTab | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gifOn = Boolean(useStickers().data?.gifEnabled);
  const grow = () => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
  const reset = () => { setText(''); setImage(null); setProblem(''); requestAnimationFrame(grow); };

  const send = () => {
    const value = text.trim();
    if ((!value && !image) || loading || uploading) return;
    onSubmit({ text: value, ...(image ? { image } : {}) });
    reset();
  };
  const sendMedia = (media: PickedMedia, clearText = false) => {
    setPicker(null);
    onSubmit({ text: '', media });
    if (clearText) { setText(''); requestAnimationFrame(grow); }
  };
  const attach = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) { setProblem('Chỉ đính kèm được ảnh'); return; }
    setProblem(''); setUploading(true);
    try {
      // Gắn ảnh với hội đang mở để tính vào dung lượng tệp của hội (hạn mức theo gói).
      const r = await api.upload(file, 'comment_image', { communityId: shell?.community.id ?? null });
      if (image) void api.discardUpload(image.fileId);
      setImage({ fileId: r.fileId, url: r.url ?? URL.createObjectURL(file) });
      area.current?.focus();
    } catch (err) { setProblem(errorMessage(err)); }
    finally { setUploading(false); }
  };
  const removeImage = () => { if (image) void api.discardUpload(image.fileId); setImage(null); };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); void attach(f); } };
  const insertEmoji = (ch: string) => {
    const el = area.current;
    const at = el ? el.selectionStart : text.length;
    setText(text.slice(0, at) + ch + text.slice(el ? el.selectionEnd : at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + ch.length, at + ch.length); grow(); });
  };
  const open = (tab: PickerTab, el: HTMLElement) => { if (picker === tab) { setPicker(null); return; } setAnchor(el); setPicker(tab); };
  const sendLabel = compact ? 'Gửi trả lời' : 'Gửi bình luận';

  return (
    <div className="flex flex-col">
      <StickerSuggest text={text} onPick={(s) => sendMedia({ kind: 'sticker', sticker: s }, true)} />
      <div className="flex gap-2 items-end">
        <span className="flex-shrink-0 pb-1"><Avatar name={user?.name} src={user?.avatarUrl} size={compact ? 28 : 34} /></span>
        <div className="comment-box comment-box-rich">
          {image && (
            <div className="comment-attach">
              <img src={image.url} alt="Ảnh sẽ gửi kèm" />
              <button type="button" aria-label="Bỏ ảnh" onClick={removeImage}><X size={14} /></button>
            </div>
          )}
          <textarea
            ref={area}
            rows={1}
            value={text}
            autoFocus={autoFocus}
            placeholder={placeholder}
            onChange={(e) => { setText(e.target.value); grow(); }}
            onPaste={onPaste}
            onKeyDown={(e) => {
              // Bàn phím thật: Enter gửi. Màn cảm ứng không có Shift nên để Enter xuống dòng.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); }
            }}
          />
          <div className="comment-tools">
            <button type="button" className={`comment-tool${picker === 'emoji' ? ' on' : ''}`} aria-label="Chèn emoji" title="Emoji" aria-expanded={picker === 'emoji'} onClick={(e) => open('emoji', e.currentTarget)}><Smile size={19} /></button>
            <button type="button" className="comment-tool" aria-label="Đính kèm ảnh" title="Ảnh" disabled={uploading} onClick={() => fileRef.current?.click()}><Camera size={19} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ''; }} />
            {gifOn && <button type="button" className={`comment-tool${picker === 'gif' ? ' on' : ''}`} aria-label="Gửi GIF" title="GIF" aria-expanded={picker === 'gif'} onClick={(e) => open('gif', e.currentTarget)}><span className="comment-tool-gif">GIF</span></button>}
            <button type="button" className={`comment-tool${picker === 'sticker' ? ' on' : ''}`} aria-label="Gửi nhãn dán" title="Nhãn dán" aria-expanded={picker === 'sticker'} onClick={(e) => open('sticker', e.currentTarget)}><StickerIcon size={19} /></button>
            {(uploading || problem) && <span className="text-[13px] px-1" role="status" style={{ color: problem ? T.accentText : T.ink3 }}>{problem || 'Đang tải ảnh…'}</span>}
            <span className="flex-grow" />
            <button type="button" className="comment-send" aria-label={sendLabel} title={sendLabel} disabled={(!text.trim() && !image) || loading || uploading} onClick={send}><SendHorizontal size={18} /></button>
          </div>
        </div>
      </div>
      {picker && <MediaPicker tab={picker} onTab={setPicker} anchor={anchor} onEmoji={insertEmoji} onPick={(m) => sendMedia(m)} onClose={() => setPicker(null)} />}
    </div>
  );
}
