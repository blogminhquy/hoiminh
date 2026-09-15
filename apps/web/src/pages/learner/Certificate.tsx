// Chứng nhận hoàn thành khóa học: một mẫu cố định, xem công khai theo mã, in ra được (Ctrl+P).
import { useQuery } from '@tanstack/react-query';
import { Logo, T } from '@hoiminh/ui';
import { BadgeCheck, Printer, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { ErrorBox } from '@hoiminh/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface Certificate {
  code: string;
  recipientName: string;
  courseTitle: string;
  issuerName: string;
  lessonCount: number;
  issuedAt: string;
  revokedAt: string | null;
  communitySlug: string | null;
  courseId: string;
}

/** Tờ chứng nhận. Tách riêng để trang in chỉ còn đúng khối này. */
function Sheet({ c }: { c: Certificate }) {
  return (
    <article className="cert-sheet" aria-label={`Chứng nhận ${c.code}`}>
      <div className="cert-inner">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <Logo size={28} />
          <span className="text-[12px] tracking-[0.18em] uppercase" style={{ color: T.ink3 }}>Chứng nhận hoàn thành</span>
        </header>

        <div className="flex flex-col items-center text-center gap-1 flex-grow justify-center" style={{ padding: '8px 0' }}>
          <span className="inline-flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: T.goldSoft, color: T.goldText }}><BadgeCheck size={32} /></span>
          <p className="m-0 mt-3 text-[14px]" style={{ color: T.ink2 }}>Chứng nhận rằng</p>
          <h1 className="serif m-0 font-extrabold leading-[1.15] cert-name">{c.recipientName}</h1>
          <p className="m-0 text-[14px]" style={{ color: T.ink2 }}>đã hoàn thành khóa học</p>
          <h2 className="serif m-0 font-bold leading-[1.25] cert-course">{c.courseTitle}</h2>
          {c.lessonCount > 0 && <p className="m-0 text-[13px]" style={{ color: T.ink3 }}>{c.lessonCount} bài học</p>}
        </div>

        <footer className="flex items-end justify-between gap-6 flex-wrap" style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px]" style={{ color: T.ink3 }}>Cấp bởi</span>
            <span className="serif text-[16px] font-bold">{c.issuerName}</span>
            <span className="text-[12px]" style={{ color: T.ink3 }}>Ngày {fmtDate(c.issuedAt)}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-[12px]" style={{ color: T.ink3 }}>Mã tra cứu</span>
            <span className="font-bold tracking-[0.06em]" style={{ fontSize: 17, color: T.ink }}>{c.code}</span>
            <span className="text-[11px]" style={{ color: T.ink3 }}>Kiểm tra tại hoiminh.vn/chung-nhan</span>
          </div>
        </footer>
      </div>
    </article>
  );
}

export default function Page() {
  const { code = '' } = useParams();
  const q = useQuery({ queryKey: ['certificate', code], queryFn: () => api.get<Certificate>(`/v1/certificates/${encodeURIComponent(code)}`), retry: false });
  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: T.bg, padding: '32px 16px 56px' }}>
      <div className="w-full flex flex-col gap-4" style={{ maxWidth: 860 }}>
        {q.isLoading && <div className="card p-8"><LoadingBlock /></div>}
        {q.isError && (
          <div className="card flex flex-col items-center text-center gap-3 no-print" style={{ padding: '40px 24px' }}>
            <ErrorBox message={errorMessage(q.error)} />
            <p className="muted text-[13px] m-0">Kiểm tra lại mã in trên chứng nhận, mã có dạng <strong>HM-CN-XXXXX</strong>.</p>
            <Link to="/" className="btn btn-ghost btn-sm">Về trang chủ</Link>
          </div>
        )}
        {q.data && (
          <>
            {q.data.revokedAt && (
              <div className="card no-print flex items-center gap-3 text-[13px]" style={{ padding: '14px 18px', background: T.accentSoft, borderColor: T.accentSoft, color: T.accentText }}>
                <ShieldCheck size={18} />
                <span>Chứng nhận này đã bị thu hồi ngày {fmtDate(q.data.revokedAt)}, không còn giá trị.</span>
              </div>
            )}
            <Sheet c={q.data} />
            <div className="flex items-center gap-2.5 justify-center flex-wrap no-print">
              <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} />In hoặc lưu PDF</button>
              {q.data.communitySlug && <Link to={`/${q.data.communitySlug}/khoa-hoc/${q.data.courseId}`} className="btn btn-ghost">Xem khóa học</Link>}
            </div>
            <p className="muted text-[12.5px] text-center m-0 no-print">
              Trang này công khai: ai có mã <strong>{q.data.code}</strong> đều xem được để đối chiếu.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
