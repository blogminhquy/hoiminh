// Đăng nhập (loginBody trong build.mjs): Google, email/mật khẩu, ghi nhớ, quên mật khẩu.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@hoiminh/ui';
import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api } from '@/lib/api';
import { useAuth, type MyCommunity } from '@/lib/auth';
import { AuthInput, CheckBox, FormError, GoogleButton, OrDivider } from './AuthParts';

/** Đích sau đăng nhập: ?next → /admin nếu là chủ hội → bảng tin hội đầu tiên → Khám phá. */
function landingFor(next: string | null, communities: MyCommunity[]): string {
  if (next && next.startsWith('/')) return next;
  if (communities.some((c) => c.role === 'owner')) return '/admin';
  const first = communities[0];
  if (first) return `/${first.slug}/bang-tin`;
  return '/kham-pha';
}

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const next = params.get('next');

  const m = useMutation({
    mutationFn: async () => {
      const session = await api.post<AuthSession>('/v1/auth/login', { email, password, remember });
      setSession(session);
      const me = await api.get<{ communities: MyCommunity[] }>('/v1/me');
      return landingFor(next, me.communities);
    },
    onSuccess: (to) => navigate(to, { replace: true }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!m.isPending) m.mutate();
  };

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <h2 className="serif m-0 mb-1.5 text-[30px] font-extrabold">Đăng nhập</h2>
          <div className="muted">Chưa có tài khoản? <Link to={`/dang-ky${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold">Đăng ký miễn phí</Link></div>
        </div>
        <GoogleButton />
        <OrDivider />
        <AuthInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
        <AuthInput label="Mật khẩu" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
        <div className="flex items-center justify-between text-[13px]">
          <CheckBox on={remember} onChange={setRemember}>Ghi nhớ đăng nhập</CheckBox>
          <Link to="/quen-mat-khau" className="font-semibold">Quên mật khẩu?</Link>
        </div>
        <FormError error={m.error} />
        <Button type="submit" variant="primary" loading={m.isPending} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>Đăng nhập</Button>
        <div className="muted text-[12px] text-center flex items-center justify-center gap-1.5"><ShieldCheck size={14} />Đăng nhập được bảo vệ, tùy chọn xác thực hai lớp trong Tài khoản</div>
      </form>
    </AuthShell>
  );
}
