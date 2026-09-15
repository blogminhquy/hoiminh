// Mảnh dùng chung cho các màn xác thực: nút Google, ô nhập 46px, vạch độ mạnh mật khẩu, đếm ngược, dòng lỗi.
import { T } from '@hoiminh/ui';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useCallback, useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.1 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5z" />
    </svg>
  );
}

/** Nút "Tiếp tục với Google": xin URL từ API rồi chuyển hướng; 501 thì hiện thông báo nhỏ. */
export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.get<{ url: string }>('/v1/auth/google');
      window.location.href = r.url;
    } catch (err) {
      setNote(err instanceof ApiError && err.status === 501 ? 'Đăng nhập Google chưa được bật trên hệ thống này. Hãy dùng email.' : errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn btn-ghost" style={{ height: 46, borderRadius: 12, gap: 10 }} onClick={() => void go()} disabled={busy}>
        <GoogleIcon />
        Tiếp tục với Google
      </button>
      {note && <span className="text-[12px]" style={{ color: T.accentText }}>{note}</span>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[12px]" style={{ color: T.ink3 }}>
      <span className="flex-grow h-px" style={{ background: T.line }} />
      hoặc dùng email
      <span className="flex-grow h-px" style={{ background: T.line }} />
    </div>
  );
}

/** Ô nhập cao 46px bo 12px như authInput; type=password có nút hiện/ẩn. */
export function AuthInput({ label, right, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; right?: ReactNode }) {
  const [show, setShow] = useState(false);
  const isPw = rest.type === 'password';
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="input" style={{ height: 46, borderRadius: 12 }}>
        <input {...rest} type={isPw ? (show ? 'text' : 'password') : rest.type} />
        {isPw ? (
          <button type="button" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow((v) => !v)} style={{ color: T.ink3 }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : right}
      </span>
    </label>
  );
}

/** Điểm mạnh mật khẩu 0–4: độ dài, chữ + số, chữ hoa/thường, ký tự đặc biệt. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function StrengthBars({ password, className }: { password: string; className?: string }) {
  const score = passwordScore(password);
  return (
    <div className={`flex gap-1.5 ${className ?? ''}`} aria-label={`Độ mạnh mật khẩu ${score}/4`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex-1 rounded-full" style={{ height: 4, background: i < score ? T.teal : T.line2 }} />
      ))}
    </div>
  );
}

/** Ô đánh dấu 18px như trong thiết kế. */
export function CheckBox({ on, onChange, children, disabled }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="inline-flex items-start gap-2 text-left text-[13px]" style={{ color: T.ink2 }}>
      <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 18, borderRadius: 5, marginTop: 1, background: on ? T.ink : T.surface, color: T.surface, border: on ? 'none' : `1.5px solid ${T.line2}` }}>
        {on && <Check size={12} />}
      </span>
      <span>{children}</span>
    </button>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="text-[13px] rounded-[10px] px-3.5 py-2.5" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(error)}</div>;
}

/** Đếm ngược n giây; trả về số giây còn lại (0 = hết) và hàm khởi động lại. */
export function useCountdown(seconds: number, autoStart = true): { left: number; restart: () => void } {
  const [left, setLeft] = useState(autoStart ? seconds : 0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}

export function fmtCountdown(left: number): string {
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** Đọc cookie theo tên (dùng cho hm_ref). */
export function readCookie(name: string): string | null {
  try {
    const m = document.cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}
