// Mảnh Khu học tập: thẻ khóa học có tiến độ, thẻ sản phẩm số tải về, lời mời vào hội.
import { Button, CommunityMark, T } from '@hoiminh/ui';
import { Download, FileText, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { fmtDate } from '@/lib/format';

export interface CommunityLite { id: string; name: string; slug: string; logoMark: string; logoColor: string; pricingMode: string; doorsOpen: boolean }
export type LibrarySource = 'purchase' | 'bundle' | 'subscription' | 'granted';
export interface LibraryCourse {
  id: string; title: string; coverUrl: string | null; coverColor: string; lessonCount: number;
  community: CommunityLite | null; source: LibrarySource;
  progress: { completedLessons: number; totalLessons: number; percent: number; completedAt: string | null } | null;
  lastAccessedAt: string | null; resumeLessonId: string | null;
}
export interface LibraryDigital { id: string; title: string; slug: string; coverUrl: string | null; fileCount: number; community: CommunityLite | null; source: LibrarySource }
export interface Library {
  courses: LibraryCourse[]; digital: LibraryDigital[];
  suggestedCommunities: CommunityLite[]; memberCommunityIds: string[];
  counts: { courses: number; inProgress: number; completed: number; digital: number };
}

const SOURCE_LABEL: Record<LibrarySource, string> = { purchase: 'Đã mua', bundle: 'Trong combo', subscription: 'Theo gói', granted: 'Được tặng' };

export function SourceTag({ source }: { source: LibrarySource }) {
  const gold = source === 'purchase' || source === 'bundle';
  return <span className="tag" style={{ background: gold ? T.goldSoft : T.tealSoft, color: gold ? T.goldText : T.tealText, height: 20 }}>{SOURCE_LABEL[source]}</span>;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: T.line }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: T.teal }} />
    </div>
  );
}

export function CourseCard({ c }: { c: LibraryCourse }) {
  const percent = c.progress?.percent ?? 0;
  const done = Boolean(c.progress?.completedAt);
  const started = percent > 0;
  const to = c.resumeLessonId ? `/hoc/bai/${c.resumeLessonId}` : null;
  return (
    <article className="card overflow-hidden flex flex-col">
      <div className="relative" style={{ aspectRatio: '16 / 9', background: c.coverColor }}>
        {c.coverUrl && <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />}
        <span className="absolute top-2.5 left-2.5"><SourceTag source={c.source} /></span>
      </div>
      <div className="flex flex-col gap-2.5 flex-grow" style={{ padding: '14px 16px 16px' }}>
        <h3 className="serif m-0 text-[17px] font-bold leading-[1.35]">{c.title}</h3>
        {c.community && <div className="muted text-[12.5px] flex items-center gap-1.5"><CommunityMark mark={c.community.logoMark} color={c.community.logoColor} size={18} radius={5} />{c.community.name}</div>}
        <div className="flex flex-col gap-1.5 mt-auto pt-1">
          <ProgressBar percent={percent} />
          <div className="muted text-[12.5px]">
            {done ? `Hoàn thành ${c.progress?.completedAt ? fmtDate(c.progress.completedAt) : ''}` : started ? `${c.progress?.completedLessons}/${c.progress?.totalLessons} bài · ${percent}%` : `${c.lessonCount} bài · chưa bắt đầu`}
          </div>
        </div>
        {to ? (
          <Link to={to} className="btn btn-primary btn-sm justify-center">{done ? <><RotateCcw size={15} />Học lại</> : started ? <><Play size={15} />Học tiếp</> : <><Play size={15} />Bắt đầu học</>}</Link>
        ) : (
          <span className="muted text-[12.5px]">Khóa học chưa có bài nào</span>
        )}
      </div>
    </article>
  );
}

interface DownloadFile { id: string; name: string; sizeBytes: number; url: string }

export function DigitalCard({ p }: { p: LibraryDigital }) {
  const [files, setFiles] = useState<DownloadFile[] | null>(null);
  const load = useMutation({ mutationFn: () => api.get<DownloadFile[]>(`/v1/products/${p.id}/downloads`), onSuccess: setFiles });
  return (
    <article className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center rounded-[10px] flex-shrink-0" style={{ width: 40, height: 40, background: T.goldSoft, color: T.goldText }}><FileText size={20} /></span>
        <div className="flex-grow min-w-0">
          <div className="font-semibold">{p.title}</div>
          <div className="muted text-[12.5px]">{p.fileCount} tệp{p.community ? ` · ${p.community.name}` : ''}</div>
        </div>
        <SourceTag source={p.source} />
      </div>
      {files ? (
        <ul className="flex flex-col gap-1.5 m-0 p-0" style={{ listStyle: 'none' }}>
          {files.length === 0 && <li className="muted text-[13px]">Chủ hội chưa tải tệp nào lên.</li>}
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-[13px]">
              <Download size={15} style={{ color: T.ink3 }} />
              <a href={f.url} download className="font-semibold flex-grow truncate" style={{ color: T.teal }}>{f.name}</a>
              <span className="muted text-[12px] flex-shrink-0">{(f.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            </li>
          ))}
        </ul>
      ) : (
        <Button variant="ghost" size="sm" loading={load.isPending} onClick={() => load.mutate()}><Download size={15} />Xem tệp tải về</Button>
      )}
      {load.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(load.error)}</div>}
    </article>
  );
}

/** Lời mời vào hội: chỉ gợi ý, người mua lẻ không bị tự thêm vào hội nữa (mục 153). */
export function JoinSuggestion({ c }: { c: CommunityLite }) {
  return (
    <div className="card flex items-center gap-3.5 flex-wrap" style={{ padding: '14px 18px' }}>
      <CommunityMark mark={c.logoMark} color={c.logoColor} size={40} radius={11} />
      <div className="flex-grow min-w-0">
        <div className="font-semibold">{c.name}</div>
        <div className="muted text-[13px]">Bạn đang học nội dung của hội này. Vào hội miễn phí để hỏi đáp và nhận thông báo.</div>
      </div>
      <Link to={`/${c.slug}`} className="btn btn-ghost btn-sm">Xem hội</Link>
    </div>
  );
}
