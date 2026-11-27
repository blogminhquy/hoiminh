// Phần giao diện cho người mua chưa đăng nhập (mua trước, tạo tài khoản sau): ô nhập chữ lớn dễ gõ trên điện thoại,
// và khung đặt mật khẩu dùng chung cho màn thanh toán xong và trang /tao-tai-khoan mở từ email.
import { Button, T } from '@hoiminh/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { passwordReady } from '@/lib/guest-order';
import { StrengthBars } from '@/pages/public/AuthParts';

/** Ô nhập cao 52px, chữ 16px (iPhone không tự phóng to khi gõ), nhãn 15px. type=password có nút hiện/ẩn. */
export function Field({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const [show, setShow] = useState(false);
  const isPw = rest.type === 'password';
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      <span className="input" style={{ height: 52, borderRadius: 12, width: 'auto' }}>
        <input {...rest} type={isPw ? (show ? 'text' : 'password') : rest.type} className="flex-grow min-w-0" style={{ fontSize: 16 }} />
        {isPw && (
          <button type="button" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow((v) => !v)} className="p-2 -mr-2" style={{ color: T.ink3 }}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </span>
      {hint && <span className="text-[14px] leading-snug" style={{ color: T.ink2 }}>{hint}</span>}
    </label>
  );
}

/** Đặt tên và mật khẩu để tài khoản chờ thành tài khoản thật. Tên điền sẵn tên lúc mua. */
export function ClaimForm({ email, defaultName, cta, pending, error, onSubmit }: { email: string; defaultName: string; cta: string; pending: boolean; error: unknown; onSubmit: (v: { name: string; password: string }) => void }) {
  // null: chưa gõ gì, ô tên hiện sẵn tên lúc mua.
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const ready = passwordReady(password);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && !pending) onSubmit({ name: (name ?? defaultName).trim(), password });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="text-[15px] leading-snug" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>Email đăng nhập: <strong style={{ color: T.ink }}>{email}</strong></div>
      <Field label="Tên của bạn" autoComplete="name" maxLength={80} value={name ?? defaultName} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị trong hội" />
      <div className="flex flex-col gap-2">
        <Field label="Đặt mật khẩu" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự, có chữ và số" />
        <StrengthBars password={password} />
      </div>
      {Boolean(error) && <div role="alert" className="text-[15px] leading-snug rounded-xl px-4 py-3" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(error)}</div>}
      <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!ready} className="w-full" style={{ minHeight: 56, height: 'auto', whiteSpace: 'normal', lineHeight: 1.25, padding: '10px 16px', fontSize: 17, textAlign: 'center' }}>{cta}</Button>
      <div className="text-[14px] leading-snug" style={{ color: T.ink2 }}>Lần sau bạn đăng nhập bằng email này và mật khẩu vừa đặt.</div>
    </form>
  );
}
