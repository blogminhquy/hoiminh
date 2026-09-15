// Tạo tài khoản (registerBody trong build.mjs): khối giới thiệu, Google, tên/email/mật khẩu, vạch độ mạnh, điều khoản.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthInput, CheckBox, FormError, GoogleButton, OrDivider, readCookie, StrengthBars } from './AuthParts';

interface AboutLite {
  community: { name: string; slug: string };
  referrer: { name: string } | null;
}

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const ref = params.get('ref') ?? readCookie('hm_ref');
  const hoi = params.get('hoi');
  const next = params.get('next') ?? (hoi ? `/${hoi}` : null);

  const about = useQuery({
    queryKey: ['about-lite', hoi, ref],
    queryFn: () => api.get<AboutLite>(`/v1/communities/by-slug/${hoi}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`),
    enabled: Boolean(hoi),
    staleTime: 60_000,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);

  const m = useMutation({
    mutationFn: () => api.post<AuthSession>('/v1/auth/register', { name, email, password, ref: ref ?? undefined, communitySlug: hoi ?? undefined, acceptTerms: true }),
    onSuccess: (session) => {
      setSession(session);
      navigate(`/xac-minh-email${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!accept || m.isPending) return;
    m.mutate();
  };

  let referral = null;
  if (about.data) {
    const who = about.data.referrer?.name;
    referral = who
      ? <>Bạn được <strong>{who}</strong> giới thiệu vào <strong>{about.data.community.name}</strong></>
      : <>Bạn đang đăng ký để tham gia <strong>{about.data.community.name}</strong></>;
  } else if (ref && !hoi) {
    referral = <>Bạn đến từ link giới thiệu của một cộng sự</>;
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <div>
          <h2 className="serif m-0 mb-1.5 text-[30px] font-extrabold">Tạo tài khoản</h2>
          <div className="muted">Đã có tài khoản? <Link to={`/dang-nhap${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold">Đăng nhập</Link></div>
        </div>
        {referral && (
          <div className="flex items-center gap-2.5 rounded-[10px] text-[13px]" style={{ padding: '10px 14px', background: T.goldSoft, color: T.goldDark }}>
            <Users size={16} />
            <span className="flex-grow">{referral}</span>
          </div>
        )}
        <GoogleButton />
        <OrDivider />
        <AuthInput label="Tên hiển thị" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Minh Quý" />
        <AuthInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
        <AuthInput label="Mật khẩu" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" />
        <StrengthBars password={password} />
        <CheckBox on={accept} onChange={setAccept}>
          Tôi đồng ý với <a href="/dieu-khoan" className="font-semibold">Điều khoản</a> và <a href="/quyen-rieng-tu" className="font-semibold">Chính sách quyền riêng tư</a> của Hội Mình
        </CheckBox>
        <FormError error={m.error} />
        <Button type="submit" variant="primary" loading={m.isPending} disabled={!accept} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>Tạo tài khoản</Button>
        <div className="muted text-[12px] text-center">Chúng tôi sẽ gửi email xác minh. Bạn vẫn vào được hội ngay, xác minh trong 7 ngày.</div>
      </form>
    </AuthShell>
  );
}
