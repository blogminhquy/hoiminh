// Bình luận lồng nhau (2 cấp) với ghim, thích, trả lời, dùng cho bài viết, bài học và sự kiện.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, T, Tag } from '@hoiminh/ui';
import { AtSign, ChevronDown, Image as ImageIcon, Paperclip, Pin } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { QueryState } from './QueryState';
import { UserAvatar, UserName, type UserLite } from './UserLink';

export interface CommentItem {
  id: string;
  contentMd: string;
  imageUrl: string | null;
  pinned: boolean;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  liked: boolean;
  parentCommentId: string | null;
  author: UserLite & { level: number; isAdmin: boolean };
  replies: CommentItem[];
}
export interface CommentList { items: CommentItem[]; total: number; canModerate: boolean }
export type CommentTarget = 'post' | 'lesson' | 'event';

export const commentsKey = (t: CommentTarget, id: string) => ['comments', t, id] as const;

function Composer({ onSubmit, placeholder, loading, autoFocus, compact }: { onSubmit: (text: string) => void; placeholder: string; loading?: boolean; autoFocus?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  return (
    <div className="flex gap-3 items-start">
      <Avatar name={user?.name} src={user?.avatarUrl} size={compact ? 28 : 36} />
      <div className="flex-grow flex flex-col gap-2">
        <span className="input textarea" style={{ borderRadius: 14 }}>
          <textarea value={text} autoFocus={autoFocus} placeholder={placeholder} onChange={(e) => setText(e.target.value)} rows={compact ? 1 : 2} />
        </span>
        <div className="flex items-center gap-1" style={{ color: T.ink2 }}>
          {!compact && (
            <>
              <span className="w-8 h-8 inline-flex items-center justify-center"><ImageIcon size={18} /></span>
              <span className="w-8 h-8 inline-flex items-center justify-center"><Paperclip size={18} /></span>
              <span className="w-8 h-8 inline-flex items-center justify-center"><AtSign size={18} /></span>
            </>
          )}
          <span className="flex-grow" />
          <Button size="sm" variant="dark" loading={loading} disabled={!text.trim()} onClick={() => { onSubmit(text.trim()); setText(''); }}>{compact ? 'Trả lời' : 'Gửi bình luận'}</Button>
        </div>
      </div>
    </div>
  );
}

function One({ c, canModerate, onReply, onLike, onPin, depth = 0 }: { c: CommentItem; canModerate: boolean; onReply: (parentId: string, text: string) => void; onLike: (id: string) => void; onPin: (id: string, pinned: boolean) => void; depth?: number }) {
  const [replying, setReplying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const replies = showAll ? c.replies : c.replies.slice(0, 2);
  return (
    <div className="flex gap-3 items-start">
      <UserAvatar user={c.author} size={36} />
      <div className="flex-grow min-w-0 flex flex-col gap-1.5">
        {c.pinned && <div className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: T.goldText }}><Pin size={12} /> Tác giả ghim bình luận này</div>}
        <div className="px-3.5 py-2.5 rounded-[14px]" style={{ background: c.author.isAdmin ? T.goldSoft : T.bg, borderTopLeftRadius: 4 }}>
          <div className="flex items-center gap-1.5 text-[13px]">
            <UserName user={c.author} />
            {c.author.isAdmin ? <Tag tone="dark" style={{ height: 18, padding: '0 6px', fontSize: 11 }}>Quản trị viên</Tag> : <span className="tag" style={{ background: T.surface, color: T.goldText, height: 18, padding: '0 6px', fontSize: 11 }}>Cấp {c.author.level}</span>}
          </div>
          <Markdown md={c.contentMd} small />
          {c.imageUrl && <img src={c.imageUrl} alt="" className="mt-2 rounded-[10px] max-w-[260px]" />}
        </div>
        <div className="flex items-center gap-3.5 text-[12px] pl-1.5" style={{ color: T.ink3 }}>
          <span>{timeAgo(c.createdAt, true)}</span>
          <button type="button" className="font-semibold" style={{ color: c.liked ? T.accentText : T.ink2 }} onClick={() => onLike(c.id)}>Thích{c.likeCount ? ` · ${c.likeCount}` : ''}</button>
          {depth === 0 && <button type="button" className="font-semibold" style={{ color: T.ink2 }} onClick={() => setReplying((v) => !v)}>Trả lời</button>}
          {canModerate && depth === 0 && <button type="button" className="font-semibold" style={{ color: T.ink3 }} onClick={() => onPin(c.id, !c.pinned)}>{c.pinned ? 'Bỏ ghim' : 'Ghim'}</button>}
        </div>
        {replies.length > 0 && (
          <div className="flex flex-col gap-3 pt-1.5 ml-1 pl-3.5" style={{ borderLeft: `2px solid ${T.line}` }}>
            {replies.map((r) => <One key={r.id} c={r} canModerate={canModerate} onReply={onReply} onLike={onLike} onPin={onPin} depth={1} />)}
          </div>
        )}
        {c.replies.length > 2 && !showAll && (
          <button type="button" className="text-[13px] font-semibold inline-flex items-center gap-1.5 pl-1.5" style={{ color: T.ink2 }} onClick={() => setShowAll(true)}><ChevronDown size={14} /> Xem thêm {c.replies.length - 2} trả lời</button>
        )}
        {replying && <Composer compact autoFocus placeholder={`Trả lời ${c.author.name}…`} onSubmit={(t) => { onReply(c.id, t); setReplying(false); }} />}
      </div>
    </div>
  );
}

export function CommentThread({ targetType, targetId, title, extraHeader, placeholder = 'Viết bình luận…' }: { targetType: CommentTarget; targetId: string; title?: (total: number) => ReactNode; extraHeader?: ReactNode; placeholder?: string }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<'top' | 'newest'>('top');
  const q = useQuery({ queryKey: [...commentsKey(targetType, targetId), sort], queryFn: () => api.get<CommentList>(`/v1/comments?targetType=${targetType}&targetId=${targetId}&sort=${sort}`) });
  const invalidate = () => { void qc.invalidateQueries({ queryKey: commentsKey(targetType, targetId) }); void qc.invalidateQueries({ queryKey: ['post'] }); };
  const create = useMutation({ mutationFn: (input: { contentMd: string; parentCommentId?: string }) => api.post('/v1/comments', { targetType, targetId, ...input }), onSuccess: invalidate });
  const like = useMutation({ mutationFn: (id: string) => api.post('/v1/reactions/toggle', { targetType: 'comment', targetId: id }), onSuccess: invalidate });
  const pin = useMutation({ mutationFn: (v: { id: string; pinned: boolean }) => api.post(`/v1/comments/${v.id}/pin`, { pinned: v.pinned }), onSuccess: invalidate });
  return (
    <div className="card px-6 md:px-8 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-bold text-[16px]">{title ? title(q.data?.total ?? 0) : `${q.data?.total ?? 0} bình luận`}</span>
        {extraHeader}
        <span className="flex-grow" />
        <button type="button" className="chip" style={{ height: 28, fontSize: 12 }} onClick={() => setSort(sort === 'top' ? 'newest' : 'top')}>{sort === 'top' ? 'Nhiều tương tác' : 'Mới nhất'} <ChevronDown size={12} /></button>
      </div>
      <Composer placeholder={placeholder} loading={create.isPending} onSubmit={(t) => create.mutate({ contentMd: t })} />
      <div className="flex flex-col gap-[18px] pt-1.5" style={{ borderTop: `1px solid ${T.line}` }}>
        <QueryState q={q} rows={2} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có bình luận', hint: 'Hãy là người đầu tiên' }}>
          {(d) => d.items.map((c) => <One key={c.id} c={c} canModerate={d.canModerate} onReply={(parentCommentId, contentMd) => create.mutate({ contentMd, parentCommentId })} onLike={(id) => like.mutate(id)} onPin={(id, pinned) => pin.mutate({ id, pinned })} />)}
        </QueryState>
      </div>
    </div>
  );
}
