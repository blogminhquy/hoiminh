// Mảnh của Composer: dải chọn nền status, ảnh đính kèm, video, bình chọn, link.
import { useMutation } from '@tanstack/react-query';
import { Button, Input, STATUS_BGS, T } from '@hoiminh/ui';
import { Ban, Check, Link as LinkIcon, Plus, Video, X } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { api, errorMessage } from '@/lib/api';

export const STATUS_MAX = 130;

export interface PickedImage { fileId: string; url: string; width: number | null; height: number | null }
export interface PollDraft { question: string; options: string[]; multipleChoice: boolean }

const BG_LABELS: Record<string, string> = { dat: 'Đỏ đất', ngoc: 'Xanh ngọc', nau: 'Nâu đậm', vang: 'Vàng cam', tim: 'Tím', la: 'Xanh lá', giay: 'Giấy chấm', hoang: 'Hoàng hôn' };

/**
 * Dải chọn nền cho bài ngắn: ô đầu là "Không nền", sau đó 8 màu. Mỗi ô là vùng chạm 40px, chấm màu 30px nằm giữa.
 * Vòng chọn (4px quanh chấm) nằm gọn trong vùng chạm, nên không bao giờ bị mép khung cắt. Hẹp thì tự xuống dòng,
 * không cuộn ngang. Dải nằm trên nền T.bg của khung "Thêm", nên khe giữa chấm và vòng chọn cũng dùng T.bg.
 */
export function BgStrip({ bgKey, onPick }: { bgKey: string | null; onPick: (k: string | null) => void }) {
  const ring = `0 0 0 2px ${T.bg}, 0 0 0 4px ${T.ink}`;
  const dot = 'w-[30px] h-[30px] rounded-full inline-flex items-center justify-center';
  return (
    <div role="radiogroup" aria-label="Nền màu" className="flex flex-wrap gap-0.5 -ml-[5px]">
      <button type="button" role="radio" aria-checked={!bgKey} aria-label="Không nền" title="Không nền" onClick={() => onPick(null)} className="bg-swatch">
        <span className={dot} style={{ background: T.surface, border: `1px solid ${T.line2}`, color: bgKey ? T.ink3 : T.ink, boxShadow: bgKey ? undefined : ring }}><Ban size={16} /></span>
      </button>
      {STATUS_BGS.map((b) => {
        const on = bgKey === b.key;
        const label = BG_LABELS[b.key] ?? b.key;
        return (
          <button key={b.key} type="button" role="radio" aria-checked={on} aria-label={`Nền ${label}`} title={label} onClick={() => onPick(b.key)} className="bg-swatch">
            <span className={dot} style={{ background: b.css, color: b.fg, boxShadow: on ? ring : `0 0 0 1px ${T.line2}` }}>{on && <Check size={16} strokeWidth={3} />}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Ảnh đính kèm: chọn nhiều tệp → upload → thumbnail + xóa. */
export function ImagePicker({ images, onChange, communityId, inputRef }: { images: PickedImage[]; onChange: (v: PickedImage[]) => void; communityId: string; inputRef: RefObject<HTMLInputElement> }) {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    setBusy(files.length);
    const added: PickedImage[] = [];
    for (const f of Array.from(files)) {
      try {
        const r = await api.upload(f, 'post_image', { communityId });
        if (r.url) added.push({ fileId: r.fileId, url: r.url, width: r.width, height: r.height });
      } catch (e) { setErr(errorMessage(e)); }
      setBusy((n) => n - 1);
    }
    onChange([...images, ...added]);
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
      {(images.length > 0 || busy > 0) && (
        <div className="flex gap-2 flex-wrap">
          {images.map((im) => (
            <span key={im.fileId} className="relative w-[88px] h-[88px] rounded-[10px] overflow-hidden" style={{ background: T.line }}>
              <img src={im.url} alt="" className="w-full h-full object-cover" />
              <button type="button" aria-label="Xóa ảnh" onClick={() => { onChange(images.filter((x) => x.fileId !== im.fileId)); void api.discardUpload(im.fileId); }} className="absolute top-1 right-1 w-6 h-6 rounded-full inline-flex items-center justify-center" style={{ background: 'rgba(31,27,23,0.7)', color: T.invertInk }}><X size={14} /></button>
            </span>
          ))}
          {Array.from({ length: busy }, (_, i) => <span key={i} className="skeleton w-[88px] h-[88px]" />)}
        </div>
      )}
      {err && <span className="text-[12px]" style={{ color: T.accentText }}>{err}</span>}
    </>
  );
}

/** Dán link video → POST /v1/video/parse để xác nhận provider. */
export function VideoInput({ value, onChange, onClose }: { value: string | null; onChange: (v: string | null) => void; onClose: () => void }) {
  const [url, setUrl] = useState(value ?? '');
  const parse = useMutation({
    mutationFn: (u: string) => api.post<{ embed: { provider: string; embedUrl: string } | null }>('/v1/video/parse', { url: u }),
    onSuccess: (d, u) => { if (d.embed) onChange(u); },
  });
  const ok = parse.data?.embed ?? null;
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ border: `1px solid ${T.line2}` }}>
      <div className="flex items-center gap-2 text-[13px] font-semibold"><Video size={16} /> Video<span className="flex-grow" /><button type="button" aria-label="Đóng" onClick={onClose} style={{ color: T.ink3 }}><X size={16} /></button></div>
      <div className="flex gap-2">
        <Input placeholder="Dán link YouTube, TikTok, Facebook, Loom, Vimeo…" value={url} onChange={(e) => { setUrl(e.target.value); onChange(null); parse.reset(); }} />
        <Button size="md" variant="dark" loading={parse.isPending} disabled={!url.trim()} onClick={() => parse.mutate(url.trim())}>Kiểm tra</Button>
      </div>
      {parse.isSuccess && (ok ? <span className="text-[12px] inline-flex items-center gap-1" style={{ color: T.tealText }}><Check size={14} /> Nhúng từ {ok.provider}</span> : <span className="text-[12px]" style={{ color: T.accentText }}>Link video không nhận diện được</span>)}
      {parse.isError && <span className="text-[12px]" style={{ color: T.accentText }}>{errorMessage(parse.error)}</span>}
    </div>
  );
}

/** Bình chọn: câu hỏi + 2–8 lựa chọn + nhiều lựa chọn. */
export function PollEditor({ poll, onChange, onClose }: { poll: PollDraft; onChange: (p: PollDraft) => void; onClose: () => void }) {
  const setOpt = (i: number, v: string) => onChange({ ...poll, options: poll.options.map((o, k) => (k === i ? v : o)) });
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ border: `1px solid ${T.line2}` }}>
      <div className="flex items-center gap-2 text-[13px] font-semibold">Bình chọn<span className="flex-grow" /><button type="button" aria-label="Bỏ bình chọn" onClick={onClose} style={{ color: T.ink3 }}><X size={16} /></button></div>
      <Input placeholder="Câu hỏi" value={poll.question} onChange={(e) => onChange({ ...poll, question: e.target.value })} />
      {poll.options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder={`Lựa chọn ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
          {poll.options.length > 2 && <button type="button" aria-label="Xóa lựa chọn" onClick={() => onChange({ ...poll, options: poll.options.filter((_, k) => k !== i) })} style={{ color: T.ink3 }}><X size={16} /></button>}
        </div>
      ))}
      <div className="flex items-center gap-3">
        {poll.options.length < 8 && <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...poll, options: [...poll.options, ''] })}>Thêm lựa chọn</Button>}
        <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: T.ink2 }}>
          <input type="checkbox" checked={poll.multipleChoice} onChange={(e) => onChange({ ...poll, multipleChoice: e.target.checked })} /> Cho chọn nhiều
        </label>
      </div>
    </div>
  );
}

export function LinkInput({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input left={<LinkIcon size={16} style={{ color: T.ink3 }} />} placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" aria-label="Bỏ link" onClick={onClose} style={{ color: T.ink3 }}><X size={16} /></button>
    </div>
  );
}

/** Mở hộp chọn tệp ảnh. */
export function useFilePicker() {
  const ref = useRef<HTMLInputElement>(null);
  return { ref, open: () => ref.current?.click() };
}
