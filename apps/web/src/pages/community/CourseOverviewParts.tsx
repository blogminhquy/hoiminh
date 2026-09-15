// Rail của trang khóa học: vòng tiến độ, chứng nhận, tài liệu, giảng viên, người đang học.
import { Avatar, Button, T } from '@hoiminh/ui';
import { BadgeCheck, Download, FileText, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar, UserName, type UserLite } from '@/components/UserLink';
import { fmtDuration, timeAgo } from '@/lib/format';
import { MessageModal } from './MessageModal';

export interface Resource { id: string; name: string; url: string; lessonId: string; sizeBytes: number | null }
export interface Owner extends UserLite { id: string; bio: string | null }

export function ProgressRing({ percent, doneLessons, watchedSeconds, lastAccessedAt, certificate }: { percent: number; doneLessons: number; watchedSeconds: number; lastAccessedAt: string | null; certificate: boolean }) {
  return (
    <div className="card p-[18px] flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `conic-gradient(${T.teal} ${percent}%, ${T.line} 0)` }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center serif font-extrabold" style={{ background: T.surface }}>{percent}%</div>
        </div>
        <div className="flex flex-col gap-0.5 text-[13px]">
          <span><strong>{doneLessons}</strong> <span className="muted">bài đã học</span></span>
          <span><strong>{fmtDuration(watchedSeconds, true) || '0 phút'}</strong> <span className="muted">đã xem</span></span>
          <span><strong>{lastAccessedAt ? timeAgo(lastAccessedAt) : 'Chưa bắt đầu'}</strong> <span className="muted">{lastAccessedAt ? 'học lần cuối' : ''}</span></span>
        </div>
      </div>
      {certificate && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[12px]" style={{ background: T.goldSoft, color: T.goldDark }}>
          <BadgeCheck size={16} /><span>Hoàn thành 100% để nhận <strong>chứng nhận</strong> có tên bạn và link kiểm tra.</span>
        </div>
      )}
    </div>
  );
}

export function ResourceList({ resources, title = 'Tài liệu khóa học' }: { resources: Resource[]; title?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="font-semibold text-[13px]">{title}</div>
      {resources.length === 0 && <span className="muted text-[12px]">Chưa có tài liệu</span>}
      {resources.map((r) => (
        <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px]" style={{ color: T.ink }}>
          <FileText size={14} style={{ color: T.ink3 }} /><span className="flex-grow truncate">{r.name}</span><Download size={14} style={{ color: T.ink3 }} />
        </a>
      ))}
    </div>
  );
}

export function InstructorCard({ owner, communityId, sub = 'Giảng viên' }: { owner: Owner | null; communityId: string; sub?: string }) {
  const [open, setOpen] = useState(false);
  if (!owner) return null;
  return (
    <div className="card p-4 flex items-center gap-3">
      <UserAvatar user={owner} size={44} />
      <div className="flex-grow min-w-0"><div className="font-semibold truncate"><UserName user={owner} /></div><div className="muted text-[12px]">{sub}</div></div>
      <Button size="sm" aria-label="Nhắn tin" icon={<MessageCircle size={14} />} onClick={() => setOpen(true)} />
      <MessageModal open={open} onClose={() => setOpen(false)} recipient={owner} communityId={communityId} />
    </div>
  );
}

export function Learners({ total, completed, sample }: { total: number; completed: number; sample: UserLite[] }) {
  const rest = Math.max(0, total - sample.length);
  return (
    <div className="card p-4 flex flex-col gap-2.5">
      <div className="flex items-center"><span className="font-semibold text-[13px]">Đang học cùng bạn</span><span className="muted text-[12px] ml-auto">{total} người</span></div>
      <div className="flex">
        {sample.map((u, k) => <span key={u.handle ?? k} className="inline-flex rounded-full" style={{ marginLeft: k ? -8 : 0, border: `2px solid ${T.surface}` }}><Avatar name={u.name} src={u.avatarUrl} color={u.coverColor} size={32} /></span>)}
        {rest > 0 && <span className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[11px] font-bold" style={{ marginLeft: sample.length ? -8 : 0, background: T.bg, border: `2px solid ${T.surface}`, color: T.ink2 }}>+{rest}</span>}
      </div>
      <div className="muted text-[12px]">{completed} người đã hoàn thành</div>
    </div>
  );
}
