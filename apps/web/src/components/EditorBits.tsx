// Mảnh dùng chung cho màn soạn thảo: thanh công cụ Markdown, dòng bật/tắt, checklist "Trước khi đăng", breadcrumb, chọn ảnh bìa.
import { Button, HEX, T, Toggle } from '@hoiminh/ui';
import { Check, ChevronLeft, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type MdTool = 'b' | 'i' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'link' | 'img' | 'code';
const LINE_PREFIX: Partial<Record<MdTool, string>> = { h2: '## ', h3: '### ', ul: '- ', ol: '1. ', quote: '> ' };

/** Ô Markdown có thanh công cụ chèn cú pháp vào vị trí con trỏ. */
export function MdEditor({ value, onChange, minHeight = 120, placeholder, note = 'Markdown', tools = ['b', 'i', 'h2', 'h3', 'ul', 'ol', 'quote', 'link', 'img'] }: { value: string; onChange: (v: string) => void; minHeight?: number; placeholder?: string; note?: string; tools?: MdTool[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const apply = (tool: MdTool) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = value.slice(s, e);
    let next: string;
    let caret: number;
    const prefix = LINE_PREFIX[tool];
    if (prefix) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      caret = e + prefix.length;
    } else {
      const ins = tool === 'b' ? `**${sel || 'chữ đậm'}**` : tool === 'i' ? `*${sel || 'chữ nghiêng'}*` : tool === 'link' ? `[${sel || 'tên link'}](https://)` : tool === 'img' ? `![${sel || 'mô tả ảnh'}](https://)` : `\`${sel || 'mã'}\``;
      next = value.slice(0, s) + ins + value.slice(e);
      caret = s + ins.length;
    }
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  };
  const labels: Record<MdTool, ReactNode> = { b: 'B', i: <i>I</i>, h2: 'H2', h3: 'H3', ul: '• —', ol: '1.', quote: '“ ”', link: <LinkIcon size={14} />, img: <ImageIcon size={14} />, code: '</>' };
  return (
    <div className="rounded-[12px] overflow-hidden" style={{ border: `1px solid ${T.line2}` }}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap" style={{ borderBottom: `1px solid ${T.line}`, background: T.bg }}>
        {tools.map((t) => (
          <button key={t} type="button" onClick={() => apply(t)} className="inline-flex items-center justify-center rounded-[6px] text-[12px] font-bold hover:bg-white" style={{ minWidth: 30, height: 28, padding: '0 8px', color: T.ink2 }} aria-label={t}>{labels[t]}</button>
        ))}
        <span className="flex-grow" />
        <span className="muted text-[11px]">{note}</span>
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="block w-full outline-none resize-y text-[14px] leading-[1.7] px-4 py-3.5" style={{ minHeight, background: T.surface, border: 0, color: T.ink }} />
    </div>
  );
}

/** Dòng nhãn + toggle bên phải (hoặc control tùy ý). */
export function ToggleRow({ label, on, onChange, children, className, size = 13 }: { label: ReactNode; on?: boolean; onChange?: (v: boolean) => void; children?: ReactNode; className?: string; size?: number }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`} style={{ fontSize: size }}>
      <span className="flex-grow">{label}</span>
      {children ?? <Toggle on={Boolean(on)} onChange={onChange} />}
    </div>
  );
}

/** Danh sách kiểm "Trước khi đăng". */
export function Checklist({ items, size = 18 }: { items: Array<{ label: string; done: boolean }>; size?: number }) {
  return (
    <>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-[13px]" style={{ color: it.done ? T.ink3 : T.ink }}>
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: size, height: size, ...(it.done ? { background: T.teal, color: '#fff' } : { border: `1.5px solid ${T.line2}` }) }}>{it.done && <Check size={Math.round(size * 0.6)} />}</span>
          <span style={{ textDecoration: it.done ? 'line-through' : undefined }}>{it.label}</span>
        </div>
      ))}
    </>
  );
}

/** Đường dẫn quay lại + tiêu đề trang soạn thảo. */
export function Breadcrumb({ to, label, title, size = 26, children }: { to: string; label: string; title: ReactNode; size?: number; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Link to={to} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} />{label}</Link>
      <span style={{ color: T.line2 }}>/</span>
      <h1 className="serif m-0 font-extrabold leading-tight min-w-0 truncate" style={{ fontSize: size }}>{title}</h1>
      {children}
    </div>
  );
}

export const COVER_COLORS = [HEX.accent, HEX.teal, '#7A5C3E', '#3E5C7A', '#5C7A3E', '#5C3E7A', HEX.gold, HEX.ink];

/** Ảnh bìa 16:9: ảnh tải lên hoặc nền màu, tên đè lên. */
export function CoverPicker({ title, coverUrl, coverColor, onColor, onFile, uploading, fontSize = 20, extra }: { title: string; coverUrl: string | null; coverColor: string; onColor: (c: string) => void; onFile?: (f: File) => void; uploading?: boolean; fontSize?: number; extra?: ReactNode }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold">Ảnh bìa</span>
      <div className="rounded-[12px] flex items-end p-3.5 overflow-hidden" style={{ aspectRatio: '16 / 9', background: coverUrl ? `url(${coverUrl}) center/cover` : coverColor }}>
        {!coverUrl && <span className="serif font-extrabold leading-[1.1]" style={{ color: T.invertInk, fontSize }}>{title || 'Tên hiện ở đây'}</span>}
      </div>
      <div className="flex gap-1.5 flex-wrap items-center">
        {onFile && (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            <Button size="sm" icon={<ImageIcon size={14} />} loading={uploading} onClick={() => fileRef.current?.click()}>Đổi ảnh</Button>
          </>
        )}
        {extra}
        <span className="flex gap-1 ml-auto">
          {COVER_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Màu ${c}`} onClick={() => onColor(c)} className="rounded-full" style={{ width: 18, height: 18, background: c, outline: c === coverColor && !coverUrl ? `2px solid ${T.ink}` : 'none', outlineOffset: 2 }} />
          ))}
        </span>
      </div>
    </div>
  );
}
