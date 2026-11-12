// /vao?token=... : đích của link đăng nhập một lần. Người đang đăng nhập trong trình duyệt của Zalo, Facebook, Messenger
// sao chép link, dán vào Safari hoặc Chrome, và vào thẳng tài khoản ở đây, không phải gõ lại mật khẩu.
import type { AuthSession } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Logo, T } from '@hoiminh/ui';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { landingAfterAuth } from './Login';

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const token = params.get('token') ?? '';
  const m = useMutation({
    mutationFn: () => api.post<AuthSession>('/v1/auth/login-link/consume', { token }),
    onSuccess: async (session) => { setSession(session); navigate(await landingAfterAuth(), { replace: true }); },
  });
  // Link chỉ dùng được một lần: gọi đúng một lần dù React dựng trang hai lần ở chế độ phát triển.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    m.mutate();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const failed = !token || m.isError;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: T.bg }}>
      <Logo size={30} />
      {failed ? (
        <>
          <h1 className="serif m-0 text-[24px] font-extrabold">Link đăng nhập không dùng được</h1>
          <p className="m-0 text-[16px]" style={{ color: T.ink2, maxWidth: 420 }}>{token ? errorMessage(m.error) : 'Link thiếu mã đăng nhập. Mở lại Hội Mình ở nơi bạn đang đăng nhập để lấy link mới.'}</p>
          <Link to="/dang-nhap" className="btn btn-primary" style={{ minHeight: 48 }}>Đăng nhập bằng mật khẩu</Link>
        </>
      ) : (
        <p className="m-0 text-[17px]" style={{ color: T.ink2 }} aria-busy="true">Đang đưa bạn vào Hội Mình...</p>
      )}
    </div>
  );
}
