// Đặt mật khẩu mới (resetBody trong build.mjs): đọc ?token=, checklist điều kiện, nhập lại, đăng xuất thiết bị khác.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Check, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthInput, CheckBox, FormError, StrengthBars } from './AuthParts';

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const token = params.get('token') ?? '';
  const email = params.get('email');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [logoutOthers, setLogoutOthers] = useState(true);

  const checks: Array<[string, boolean]> = [
    ['Ít nhất 8 ký tự', password.length >= 8],
    ['Có chữ và số', /[a-zA-Z]/.test(password) && /\d/.test(password)],
    ['Hai lần nhập trùng nhau', password.length > 0 && password === confirm],
    ['Có ký tự đặc biệt (khuyến nghị)', /[^a-zA-Z0-9]/.test(password)],
  ];
  const ready = Boolean(token) && checks[0]![1] && checks[1]![1] && checks[2]![1];

  const m = useMutation({
    mutationFn: () => api.post<AuthSession>('/v1/auth/reset-password', { token, password, logoutOthers }),
    onSuccess: (session) => {
      setSession(session);
      navigate('/admin', { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && !m.isPending) m.mutate();
  };

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <h2 className="serif m-0 mb-1.5 text-[30px] font-extrabold">Đặt mật khẩu mới</h2>
          <div className="muted">{email ? <>Cho tài khoản <strong style={{ color: T.ink }}>{email}</strong></> : 'Chọn mật khẩu mới cho tài khoản của bạn.'}</div>
        </div>
        {!token && (
          <div className="text-[13px] rounded-[10px] px-3.5 py-2.5" style={{ background: T.accentSoft, color: T.accentText }}>
            Link đặt lại không hợp lệ hoặc đã hết hạn. <Link to="/quen-mat-khau" className="font-semibold">Gửi lại link mới</Link>
          </div>
        )}
        <AuthInput label="Mật khẩu mới" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" />
        <StrengthBars password={password} className="-mt-2" />
        <div className="flex flex-col gap-1.5 text-[12px] -mt-1.5" style={{ color: T.ink2 }}>
          {checks.map(([label, ok]) => (
            <div key={label} className="flex items-center gap-2" style={{ color: ok ? T.tealText : T.ink3 }}>
              {ok ? <Check size={14} /> : <X size={14} />}
              {label}
            </div>
          ))}
        </div>
        <AuthInput label="Nhập lại mật khẩu" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
        <CheckBox on={logoutOthers} onChange={setLogoutOthers}>Đăng xuất khỏi các thiết bị khác</CheckBox>
        <FormError error={m.error} />
        <Button type="submit" variant="primary" loading={m.isPending} disabled={!ready} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>Lưu mật khẩu và đăng nhập</Button>
      </form>
    </AuthShell>
  );
}
