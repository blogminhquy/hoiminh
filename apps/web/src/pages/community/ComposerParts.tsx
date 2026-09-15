// Mảnh của Composer: dải chọn nền status, ảnh đính kèm, video, bình chọn, link.
import { useMutation } from '@tanstack/react-query';
import { Button, Input, STATUS_BGS, T } from '@hoiminh/ui';
import { Check, Image as ImageIcon, Link as LinkIcon, Plus, Video, X } from 'lucide-react';
import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { api, errorMessage } from '@/lib/api';

export const STATUS_MAX = 130;

export interface PickedImage { fileId: string; url: string; width: number | null; height: number | null }
export interface PollDraft { question: string; options: string[]; multipleChoice: boolean }

const Sq = ({ children, onClick, label, style }: { children: ReactNode; onClick?: () => void; label: string; style?: CSSProperties }) => (
  <button type="button" aria-label={label} onClick={onClick} className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={style}>{children}</button>
);

/** Dải chọn nền: Aa bật/tắt, X bỏ nền, 8 swatch, nút ảnh. */
export function BgStrip({ bgKey, onPick, onToggle, onClear, onImage, overlay }: { bgKey: string | null; onPick: (k: string) => void; onToggle: () => void; onClear: () => void; onImage: () => void; overlay?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-xl ${overlay ? 'absolute left-3 right-3 bottom-3' : ''}`} style={{ background: overlay ? 'rgba(255,253,249,0.92)' : T.bg }}>
      <Sq label="Bật/tắt nền" onClick={onToggle} style={{ background: bgKey ? T.ink : T.surface, color: bgKey ? T.surface : T.ink, border: bgKey ? 'none' : `1px solid ${T.line2}` }}>
        <span className="serif font-extrabold text-[14px]">Aa</span>
      </Sq>
      <Sq label="Bỏ nền" onClick={onClear} style={{ border: `1px solid ${T.line2}`, color: T.ink3 }}><X size={18} /></Sq>
      <span className="w-px h-7" style={{ background: T.line2 }} />
      <div className="flex gap-2 flex-grow overflow-x-auto">
        {STATUS_BGS.map((b) => (
          <button key={b.key} type="button" aria-label={`Nền ${b.key}`} onClick={() => onPick(b.key)} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ background: b.css, outline: bgKey === b.key ? `2.5px solid ${T.ink}` : 'none', outlineOffset: 2, border: bgKey === b.key ? 'none' : '1px solid rgba(31,27,23,0.08)' }} />
        ))}
      </div>
      <Sq label="Thêm ảnh" onClick={onImage} style={{ border: `1px solid ${T.line2}`, color: T.ink2 }}><ImageIcon size={18} /></Sq>
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
              <button type="button" aria-label="Xóa ảnh" onClick={() => onChange(images.filter((x) => x.fileId !== im.fileId))} className="absolute top-1 right-1 w-6 h-6 rounded-full inline-flex items-center justify-center" style={{ background: 'rgba(31,27,23,0.7)', color: T.surface }}><X size={14} /></button>
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
