// Quên mật khẩu (forgotBody trong build.mjs): nhập email → gửi link đặt lại.
import { useMutation } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api } from '@/lib/api';
import { AuthInput, FormError } from './AuthParts';

export default function Page() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/v1/auth/forgot-password', { email }),
    onSuccess: () => navigate(`/quen-mat-khau/da-gui?email=${encodeURIComponent(email)}`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!m.isPending) m.mutate();
  };
  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Link to="/dang-nhap" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} />Về đăng nhập</Link>
        <div>
          <h2 className="serif m-0 mb-1.5 text-[30px] font-extrabold">Quên mật khẩu</h2>
          <div className="muted">Nhập email đã đăng ký, chúng tôi gửi link đặt lại mật khẩu. Link dùng được trong 30 phút.</div>
        </div>
        <AuthInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
        <FormError error={m.error} />
        <Button type="submit" variant="primary" loading={m.isPending} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>Gửi link đặt lại</Button>
        <div className="rounded-[12px] text-[13px] flex gap-2.5 items-start" style={{ padding: '14px 16px', background: T.bg, color: T.ink2 }}>
          <span className="flex-shrink-0" style={{ color: T.ink3 }}><ShieldCheck size={16} /></span>
          <span>Nếu đăng nhập bằng Google, bạn không có mật khẩu ở Hội Mình. Hãy bấm "Tiếp tục với Google" ở màn Đăng nhập.</span>
        </div>
      </form>
    </AuthShell>
  );
}
