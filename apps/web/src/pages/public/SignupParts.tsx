// Mảnh dùng chung cho luồng Tạo hội (nền tối): header signupHeader và khung trang.
import { Logo, T } from '@hoiminh/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function SignupHeader() {
  const { user } = useAuth();
  return (
    <header className="flex items-center gap-2 px-4 md:px-16" style={{ height: 64 }}>
      <Link to="/kham-pha"><Logo size={28} light /></Link>
      <span className="flex-grow" />
      <Link to="/kham-pha" className="text-[14px] font-medium" style={{ color: T.sideText }}>Khám phá</Link>
      {user ? (
        <Link to="/admin" className="text-[14px] font-medium ml-6" style={{ color: T.sideText }}>Hội của tôi</Link>
      ) : (
        <Link to="/dang-nhap" className="text-[14px] font-medium ml-6" style={{ color: T.sideText }}>Đăng nhập</Link>
      )}
    </header>
  );
}

export function SignupPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.side, color: T.invertInk }}>
      <SignupHeader />
      {children}
    </div>
  );
}

/** Giữ ?ref= khi chuyển sang trang tiếp theo của luồng. */
export function withRef(path: string, ref: string | null): string {
  if (!ref) return path;
  return `${path}${path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}
