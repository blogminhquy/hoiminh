// Kích hoạt quyền truy cập (/kich-hoat?token=...): khách bấm nút trong email sau khi đặt mua ở landing. Chưa có tài khoản
// thì đặt mật khẩu một lần là vào được ngay; đã có tài khoản thì quyền vào thẳng tài khoản đó rồi mời đăng nhập.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { AuthShell } from '@/layouts/AuthShell';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthInput, FormError, StrengthBars } from './AuthParts';

interface Info { email: string; name: string; sender: string; hasAccount: boolean; used: boolean; items: string[] }
interface Result { session: AuthSession | null; needsLogin: boolean; redirect: string; email: string; granted: string[] }

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const token = params.get('token') ?? '';
  const info = useQuery({ queryKey: ['activation', token], queryFn: () => api.get<Info>(`/v1/activation/${encodeURIComponent(token)}`), enabled: Boolean(token), retry: false });
  // null: chưa gõ gì, ô tên hiện sẵn tên khách đã điền ở landing.
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: (body: { name?: string; password?: string }) => api.post<Result>(`/v1/activation/${encodeURIComponent(token)}`, body),
    onSuccess: (r) => {
      if (r.session) { setSession(r.session); navigate(r.redirect, { replace: true }); return; }
      navigate(`/dang-nhap?next=${encodeURIComponent(r.redirect)}&email=${encodeURIComponent(r.email)}`, { replace: true });
    },
  });
  const d = info.data;
  const ready = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && !m.isPending) m.mutate({ name: (name ?? d?.name ?? '').trim() || undefined, password });
  };

  const items = d && d.items.length > 0 && (
    <div className="rounded-[12px] px-4 py-3 flex flex-col gap-1.5 text-[16px]" style={{ background: T.bg }}>
      {d.items.map((i) => <div key={i} className="flex items-start gap-2"><Check size={18} className="flex-shrink-0 mt-1" style={{ color: T.teal }} /><span>{i}</span></div>)}
    </div>
  );

  return (
    <AuthShell>
      {!token || info.isError ? (
        <div className="flex flex-col gap-4">
          <h2 className="serif m-0 text-[28px] font-extrabold">Link kích hoạt không còn dùng được</h2>
          <div className="text-[16px]" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>{info.isError ? errorMessage(info.error) : 'Link thiếu mã kích hoạt.'} Nếu bạn đã kích hoạt rồi thì chỉ cần đăng nhập. Chưa thì nhắn người bán gửi lại link mới.</div>
          <Link to="/dang-nhap" className="btn btn-primary" style={{ height: 48, borderRadius: 12 }}>Đăng nhập</Link>
        </div>
      ) : info.isLoading || !d ? <LoadingBlock rows={1} /> : d.hasAccount ? (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="serif m-0 mb-1.5 text-[28px] font-extrabold">{d.items.length > 0 ? 'Nhận quyền truy cập' : 'Bạn đã kích hoạt rồi'}</h2>
            <div className="text-[16px]" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>Email <strong style={{ color: T.ink }}>{d.email}</strong> đã có tài khoản Hội Mình. {d.items.length > 0 ? `${d.sender} mở cho bạn:` : 'Đăng nhập để vào xem.'}</div>
          </div>
          {items}
          <FormError error={m.error} />
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate({})} style={{ height: 48, fontSize: 16, borderRadius: 12 }}>{d.items.length > 0 ? 'Nhận quyền và đăng nhập' : 'Đăng nhập'}</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <h2 className="serif m-0 mb-1.5 text-[28px] font-extrabold">Kích hoạt quyền truy cập</h2>
            <div className="text-[16px]" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>{d.sender} mở cho <strong style={{ color: T.ink }}>{d.email}</strong>:</div>
          </div>
          {items}
          <AuthInput label="Tên của bạn" autoComplete="name" maxLength={80} value={name ?? d.name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị" />
          <AuthInput label="Đặt mật khẩu" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự, có chữ và số" />
          <StrengthBars password={password} className="-mt-2" />
          <FormError error={m.error} />
          <Button type="submit" variant="primary" loading={m.isPending} disabled={!ready} style={{ height: 48, fontSize: 16, borderRadius: 12 }}>Kích hoạt và vào xem</Button>
          <div className="muted text-[14px]">Lần sau bạn đăng nhập bằng email này và mật khẩu vừa đặt.</div>
        </form>
      )}
    </AuthShell>
  );
}
