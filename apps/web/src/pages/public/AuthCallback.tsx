// Đích quay về sau Google (Supabase): đọc #access_token= trong hash, đổi lấy phiên Hội Mình rồi vào /admin.
import type { AuthSession } from '@hoiminh/contracts';
import { Button, T } from '@hoiminh/ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function tokenFromHash(hash: string): string | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return p.get('access_token');
}

export default function Page() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const accessToken = tokenFromHash(window.location.hash);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (!accessToken) {
      setError(hashParams.get('error_description') ?? 'Không nhận được mã đăng nhập từ Google. Hãy thử lại.');
      return;
    }
    api.post<AuthSession>('/v1/auth/google/callback', { accessToken })
      .then((session) => {
        setSession(session);
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/admin', { replace: true });
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [navigate, setSession]);

  return (
    <AuthShell>
      <div className="flex flex-col gap-4 items-center text-center">
        {error ? (
          <>
            <h2 className="serif m-0 text-[30px] font-extrabold">Đăng nhập Google thất bại</h2>
            <div className="text-[13px] rounded-[10px] px-3.5 py-2.5 w-full" style={{ background: T.accentSoft, color: T.accentText }}>{error}</div>
            <div className="flex gap-2">
              <Link to="/dang-nhap"><Button variant="primary">Về đăng nhập</Button></Link>
              <Link to="/kham-pha"><Button>Khám phá</Button></Link>
            </div>
          </>
        ) : (
          <>
            <span className="inline-block w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: T.accent }} />
            <h2 className="serif m-0 text-[24px] font-extrabold">Đang đăng nhập…</h2>
            <div className="muted text-[13px]">Đang xác nhận tài khoản Google của bạn với Hội Mình.</div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
