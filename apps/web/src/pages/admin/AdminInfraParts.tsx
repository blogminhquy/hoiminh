// Thành phần của Hệ thống · Hạ tầng: ô bí mật (chỉ hiện 4 ký tự cuối), nhãn nguồn giá trị, khung mỗi phần, hướng dẫn thu gọn.
import { T } from '@hoiminh/ui';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export type InfraSource = 'saved' | 'worker' | 'default' | 'none';
export interface InfraField { source: InfraSource; value: string | null; hint: string | null }
export interface InfraSection { fields: Record<string, InfraField>; updatedAt: string | null }
export interface Infra {
  env: string;
  email: InfraSection & { provider: string };
  release: InfraSection & { configured: boolean };
  gif: InfraSection & { configured: boolean };
  storage: { label: string; kind: 'r2' | 'local'; bucket: string; publicBaseUrl: string | null };
  secrets: { authJwtSecret: boolean; encryptionKey: boolean; database: 'postgres' | 'pglite' };
}

const SOURCE: Record<InfraSource, [string, string, string]> = {
  saved: ['Nhập ở trang này', T.tealSoft, T.tealText],
  worker: ['Secret trên Cloudflare', T.bg, T.ink2],
  default: ['Mặc định', T.bg, T.ink3],
  none: ['Chưa có', T.goldSoft, T.goldText],
};

/** Giá trị đang dùng lấy từ đâu: giúp biết lưu ở đây sẽ thay cái gì. */
export function SourceTag({ source }: { source: InfraSource }) {
  const [label, bg, fg] = SOURCE[source];
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[16px] font-semibold whitespace-nowrap" style={{ background: bg, color: fg }}>{label}</span>;
}

/** Nhãn trạng thái lớn ở đầu mỗi phần. */
export function StatusPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[16px] font-semibold" style={{ background: ok ? T.tealSoft : T.goldSoft, color: ok ? T.tealText : T.goldText }}>
      <span className="w-2 h-2 rounded-full" style={{ background: ok ? T.teal : T.gold }} />
      {children}
    </span>
  );
}

/** Khung một phần cấu hình: tiêu đề, trạng thái, nội dung. */
export function Panel({ icon, title, status, sub, children }: { icon: ReactNode; title: string; status?: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-5 p-5 md:p-6">
      <header className="flex items-start gap-3 flex-wrap">
        <span className="w-11 h-11 rounded-xl inline-flex items-center justify-center flex-shrink-0" style={{ background: T.bg, color: T.ink }}>{icon}</span>
        <div className="flex-grow min-w-[200px]">
          <h2 className="m-0 text-[20px] font-bold">{title}</h2>
          {sub && <div className="muted text-[16px] mt-0.5">{sub}</div>}
        </div>
        {status}
      </header>
      {children}
    </section>
  );
}

/** Nhãn + ô nhập + dòng gợi ý, cỡ chữ tối thiểu 16px. */
export function Row({ id, label, right, hint, error, children }: { id: string; label: string; right?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  // Nút ở `right` (bỏ giá trị đã lưu) nằm ngoài <label> để bấm vào không bị hiểu là bấm vào ô nhập.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap text-[16px] font-semibold"><label htmlFor={id} className="flex-grow">{label}</label>{right}</div>
      {children}
      {error ? <span role="alert" className="text-[16px]" style={{ color: T.accentText }}>{error}</span> : hint ? <span className="muted text-[16px]">{hint}</span> : null}
    </div>
  );
}

const inputStyle = { fontSize: 16, minHeight: 48 };

export function TextInput({ id, value, onChange, placeholder, mono }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <span className="input" style={inputStyle}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off" className="flex-grow min-w-0" style={{ fontSize: 16, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined }} />
    </span>
  );
}

/**
 * Ô bí mật: không bao giờ hiện giá trị đã lưu, chỉ 4 ký tự cuối ở nhãn. Để trống là giữ nguyên key đang dùng.
 * Có nút hiện/ẩn để kiểm tra lại chuỗi vừa dán trước khi lưu.
 */
export function SecretInput({ id, value, onChange, current, placeholder }: { id: string; value: string; onChange: (v: string) => void; current: InfraField; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="input" style={inputStyle}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={current.hint ? `Đang dùng ${current.hint}. Dán key mới để thay` : placeholder}
        spellCheck={false}
        autoComplete="new-password"
        className="flex-grow min-w-0"
        style={{ fontSize: 16, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ẩn' : 'Hiện'} className="inline-flex items-center justify-center w-10 h-10 -mr-2" style={{ color: T.ink3 }}>
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </span>
  );
}

/** Hướng dẫn từng bước, thu gọn mặc định để trang không dài. */
export function Guide({ title, steps }: { title: string; steps: ReactNode[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl" style={{ background: T.bg }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left text-[16px] font-semibold" aria-expanded={open}>
        <span className="flex-grow">{title}</span>
        <ChevronDown size={20} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>
      {open && (
        <ol className="m-0 px-4 pb-4 pl-9 flex flex-col gap-2 text-[16px] leading-relaxed" style={{ listStyle: 'decimal' }}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  );
}

/** Một dòng trạng thái chỉ xem (bí mật hệ thống, R2). `warn` dùng ở máy dev, nơi thiếu vài thứ là bình thường. */
export function CheckLine({ tone, title, detail }: { tone: 'ok' | 'warn' | 'error'; title: string; detail: ReactNode }) {
  const [bg, fg, mark] = tone === 'ok' ? [T.tealSoft, T.tealText, '✓'] : tone === 'warn' ? [T.goldSoft, T.goldText, '!'] : [T.accentSoft, T.accentText, '!'];
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderTop: `1px solid ${T.line}` }}>
      <span className="w-7 h-7 rounded-full inline-flex items-center justify-center flex-shrink-0 text-[16px] font-bold" style={{ background: bg, color: fg }}>{mark}</span>
      <div className="flex-grow min-w-0">
        <div className="text-[16px] font-semibold">{title}</div>
        <div className="muted text-[16px]">{detail}</div>
      </div>
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: T.tealText }}>{children}</a>;
}
