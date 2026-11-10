// Chứng nhận hoàn thành khóa học: trang công khai, ai có link cũng kiểm tra được; in được.
import { useQuery } from '@tanstack/react-query';
import { CommunityMark, T } from '@hoiminh/ui';
import { BadgeCheck, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { PublicHeader } from '@/layouts/PublicHeader';
import { api } from '@/lib/api';
import { fmtDuration, fmtLongDate } from '@/lib/format';

interface Certificate {
  code: string;
  learner: { id: string; name: string; handle: string };
  course: { id: string; title: string; lessonCount: number; totalDurationSeconds: number };
  owner: string | null;
  community: { name: string; slug: string; logoMark: string; logoColor: string; logoUrl?: string | null } | null;
  completedAt: string;
  verifyUrl: string;
}

export default function Page() {
  const { courseId = '', userId = '' } = useParams();
  const q = useQuery({ queryKey: ['certificate', courseId, userId], queryFn: () => api.get<Certificate>(`/v1/courses/${courseId}/certificate/${userId}`), retry: false });
  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <PublicHeader />
      <main className="mx-auto px-4 py-8 flex flex-col gap-4" style={{ maxWidth: 760 }}>
        <QueryState q={q} rows={4}>
          {(c) => (
            <>
              <div className="card flex flex-col items-center text-center gap-4" style={{ padding: '40px 28px', borderWidth: 2, borderColor: T.gold }}>
                {c.community && <div className="flex items-center gap-2.5"><CommunityMark mark={c.community.logoMark} color={c.community.logoColor} url={c.community.logoUrl} size={40} radius={10} /><span className="font-semibold">{c.community.name}</span></div>}
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: T.goldText }}>Chứng nhận hoàn thành</div>
                <div className="serif text-[32px] font-extrabold leading-tight" style={{ color: T.ink }}>{c.learner.name}</div>
                <div className="text-[16px] leading-[1.6]" style={{ color: T.ink2 }}>đã hoàn thành toàn bộ <strong style={{ color: T.ink }}>{c.course.lessonCount} bài</strong>{c.course.totalDurationSeconds ? ` (${fmtDuration(c.course.totalDurationSeconds, true)})` : ''} của khóa học</div>
                <div className="serif text-[24px] font-bold" style={{ color: T.ink }}>{c.course.title}</div>
                <div className="text-[14px]" style={{ color: T.ink2 }}>ngày {fmtLongDate(c.completedAt)}{c.owner ? ` · giảng viên ${c.owner}` : ''}</div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: T.tealSoft, color: T.tealText }}><BadgeCheck size={16} />Đã kiểm tra · mã {c.code}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[13px] print:hidden" style={{ color: T.ink2 }}>
                <span className="flex-grow break-all">Link kiểm tra: {c.verifyUrl}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={14} />In / lưu PDF</button>
                {c.community && <Link to={`/${c.community.slug}/khoa-hoc/${c.course.id}`} className="btn btn-dark btn-sm">Xem khóa học</Link>}
              </div>
            </>
          )}
        </QueryState>
      </main>
    </div>
  );
}
