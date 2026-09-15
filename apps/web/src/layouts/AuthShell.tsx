// Khung đăng nhập/đăng ký (authShell trong build.mjs): panel trái nâu tối 560px, form bên phải 440px.
import { Avatar, Logo, T } from '@hoiminh/ui';
import { BookOpen, QrCode, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthShell({ children }: { children: ReactNode }) {
  const points = [[<BookOpen size={18} key="b" />, 'Học theo lộ trình, hỏi là có người trả lời'], [<QrCode size={18} key="q" />, 'Trả bằng chuyển khoản, MoMo hay VNPAY, mở khóa tự động'], [<Trophy size={18} key="t" />, 'Giới thiệu bạn bè, nhận hoa hồng mỗi kỳ']] as const;
  return (
    <div className="min-h-screen flex" style={{ background: T.bg }}>
      <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 560, background: T.side, color: T.surface, padding: '40px 56px' }}>
        <Link to="/kham-pha"><Logo size={28} light /></Link>
        <div className="flex-grow flex flex-col justify-center gap-7">
          <h1 className="serif m-0 text-[40px] leading-[1.15] font-extrabold">Hội của mình,<br />do mình dựng.</h1>
          <div className="flex flex-col gap-3.5 text-[15px]" style={{ color: T.sideText }}>
            {points.map(([ic, t], i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,253,249,0.08)', color: T.gold }}>{ic}</span>
                {t}
              </div>
            ))}
          </div>
          <div className="rounded-[14px] flex flex-col gap-2.5" style={{ padding: '18px 20px', background: 'rgba(255,253,249,0.06)' }}>
            <div className="text-[14px] leading-[1.6]">“Mình tham gia hội qua link của một người bạn, ba tháng sau đã có đơn đầu tiên từ funnel affiliate.”</div>
            <div className="flex items-center gap-2.5"><Avatar name="Điền Phạm Ngọc" color={T.teal} size={32} /><div><div className="text-[13px] font-semibold">Điền Phạm Ngọc</div><div className="text-[12px]" style={{ color: T.sideMuted }}>Thành viên Kinh Doanh Online Cùng AI</div></div></div>
          </div>
        </div>
        <div className="text-[12px]" style={{ color: T.sideMuted }}>© 2026 Hội Mình · Điều khoản · Quyền riêng tư</div>
      </aside>
      <div className="flex-grow flex items-center justify-center p-6 md:p-10">
        <div className="w-full flex flex-col gap-5" style={{ maxWidth: 440 }}>
          <div className="lg:hidden"><Logo size={26} /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
