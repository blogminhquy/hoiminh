// Tạo tài khoản sau khi mua (/tao-tai-khoan?token=...): khách bấm nút trong email "Tạo tài khoản và vào hội". Link chỉ
// nằm trong hộp thư đó nên email coi như đã xác minh. Đặt mật khẩu một lần là đăng nhập và vào thẳng chỗ vừa mua.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { AuthShell } from '@/layouts/AuthShell';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ClaimForm } from '@/pages/community/GuestParts';

interface Info { email: string; name: string; claimed: boolean; item: string | null; place: string | null; paid: boolean }

export default function Page() {
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const token = params.get('token') ?? '';
  const info = useQuery({ queryKey: ['account-claim', token], queryFn: () => api.get<Info>(`/v1/auth/claim?token=${encodeURIComponent(token)}`), enabled: Boolean(token), retry: false });
  const m = useMutation({
    mutationFn: (v: { name: string; password: string }) => api.post<{ session: AuthSession; redirect: string }>('/v1/auth/claim', { token, name: v.name || undefined, password: v.password }),
    onSuccess: (r) => { setSession(r.session); window.location.assign(r.redirect); },
  });
  const d = info.data;
  const place = d?.place ?? 'hội';

  return (
    <AuthShell>
      {!token || info.isError ? (
        <div className="flex flex-col gap-4">
          <h2 className="serif m-0 text-[28px] font-extrabold">Link tạo tài khoản không dùng được</h2>
          <div className="text-[16px] leading-snug" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>{info.isError ? errorMessage(info.error) : 'Link thiếu mã.'} Bạn mở lại đúng nút trong email, hoặc vào Quên mật khẩu và nhập email đã dùng lúc mua để nhận link mới.</div>
          <Link to="/quen-mat-khau" className="btn btn-primary" style={{ minHeight: 52, borderRadius: 12, fontSize: 16 }}>Nhận link mới</Link>
        </div>
      ) : info.isLoading || !d ? <LoadingBlock rows={1} /> : d.claimed ? (
        <div className="flex flex-col gap-4">
          <h2 className="serif m-0 text-[28px] font-extrabold">Bạn đã tạo tài khoản rồi</h2>
          <div className="text-[16px] leading-snug" style={{ color: T.ink2, overflowWrap: 'anywhere' }}>Đăng nhập bằng <strong style={{ color: T.ink }}>{d.email}</strong> và mật khẩu bạn đã đặt.</div>
          <Link to={`/dang-nhap?email=${encodeURIComponent(d.email)}`} className="btn btn-primary" style={{ minHeight: 52, borderRadius: 12, fontSize: 16 }}>Đăng nhập</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="serif m-0 mb-1.5 text-[28px] font-extrabold">Tạo tài khoản để vào {place}</h2>
            <div className="text-[16px] leading-snug" style={{ color: T.ink2 }}>{d.paid ? 'Bạn đã thanh toán xong, quyền truy cập đang chờ bạn.' : 'Đặt mật khẩu để hoàn tất tài khoản.'}</div>
          </div>
          {d.item && (
            <div className="rounded-[12px] px-4 py-3 flex items-start gap-2 text-[16px]" style={{ background: T.bg }}>
              <Check size={18} className="flex-shrink-0 mt-1" style={{ color: T.teal }} /><span>{d.item}{d.place ? ` · ${d.place}` : ''}</span>
            </div>
          )}
          <ClaimForm email={d.email} defaultName={d.name} cta="Tạo tài khoản và vào hội" pending={m.isPending} error={m.error} onSubmit={(v) => m.mutate(v)} />
        </div>
      )}
    </AuthShell>
  );
}
