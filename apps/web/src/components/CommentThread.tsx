// Bình luận lồng nhau (2 cấp) với ghim, cảm xúc, trả lời, dùng cho bài viết, bài học và sự kiện.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, T, Tag } from '@hoiminh/ui';
import { ChevronDown, Pin, SendHorizontal } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { ReactionButton, ReactionSummary } from './post/Reactions';
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
  myReaction?: string | null;
  reactionCounts?: Record<string, number>;
  parentCommentId: string | null;
  author: UserLite & { level: number; isAdmin: boolean };
  replies: CommentItem[];
}
export interface CommentList { items: CommentItem[]; total: number; canModerate: boolean }
export type CommentTarget = 'post' | 'lesson' | 'event';

export const commentsKey = (t: CommentTarget, id: string) => ['comments', t, id] as const;

/**
 * Ô viết bình luận gọn kiểu Facebook: một dòng bo tròn, tự cao lên khi gõ, Enter để gửi, Shift Enter để xuống dòng
 * (trên điện thoại Enter là xuống dòng, gửi bằng nút mũi tên).
 */
function Composer({ onSubmit, placeholder, loading, autoFocus, compact }: { onSubmit: (text: string) => void; placeholder: string; loading?: boolean; autoFocus?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const grow = () => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
  const send = () => {
    const value = text.trim();
    if (!value || loading) return;
    onSubmit(value);
    setText('');
    requestAnimationFrame(grow);
  };
  return (
    <div className="flex gap-2 items-end">
      <span className="flex-shrink-0 pb-1"><Avatar name={user?.name} src={user?.avatarUrl} size={compact ? 28 : 34} /></span>
      <div className="comment-box">
        <textarea
          ref={area}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); grow(); }}
          onKeyDown={(e) => {
            // Bàn phím thật: Enter gửi. Màn cảm ứng không có Shift nên để Enter xuống dòng.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); }
          }}
        />
        <button type="button" className="comment-send" aria-label={compact ? 'Gửi trả lời' : 'Gửi bình luận'} title={compact ? 'Gửi trả lời' : 'Gửi bình luận'} disabled={!text.trim() || loading} onClick={send}><SendHorizontal size={18} /></button>
      </div>
    </div>
  );
}

function One({ c, canModerate, meId, onReply, onPin, onDelete, depth = 0 }: { c: CommentItem; canModerate: boolean; meId: string | null; onReply: (parentId: string, text: string) => void; onPin: (id: string, pinned: boolean) => void; onDelete: (id: string) => void; depth?: number }) {
  const [replying, setReplying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const replies = showAll ? c.replies : c.replies.slice(0, 2);
  return (
    <div className="flex gap-2 items-start" id={`binh-luan-${c.id}`}>
      <UserAvatar user={c.author} size={depth ? 28 : 34} />
      <div className="flex-grow min-w-0 flex flex-col gap-1">
        {c.pinned && <div className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: T.goldText }}><Pin size={12} /> Tác giả ghim bình luận này</div>}
        <div className="relative self-start max-w-full px-3 py-2 rounded-[16px]" style={{ background: c.author.isAdmin ? T.goldSoft : T.bg }}>
          <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
            <UserName user={c.author} />
            {c.author.isAdmin ? <Tag tone="dark" style={{ height: 18, padding: '0 6px', fontSize: 11 }}>Quản trị viên</Tag> : <span className="tag" style={{ background: T.surface, color: T.goldText, height: 18, padding: '0 6px', fontSize: 11 }}>Cấp {c.author.level}</span>}
          </div>
          <Markdown md={c.contentMd} small />
          {c.imageUrl && <img src={c.imageUrl} alt="" className="mt-2 rounded-[10px] max-w-[260px]" />}
          {c.likeCount > 0 && (
            <span className="absolute -bottom-2.5 right-1 inline-flex items-center rounded-full px-1 py-px" style={{ background: T.surface, boxShadow: '0 1px 3px rgba(8,24,23,0.18)' }}>
              <ReactionSummary counts={c.reactionCounts} total={c.likeCount} size={16} showTotal={c.likeCount > 1} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[13px] pl-3 flex-wrap" style={{ color: T.ink3 }}>
          <span>{timeAgo(c.createdAt, true)}</span>
          <ReactionButton targetType="comment" targetId={c.id} mine={c.myReaction ?? (c.liked ? 'like' : null)} variant="text" />
          {depth === 0 && <button type="button" className="font-semibold" style={{ color: T.ink2 }} onClick={() => setReplying((v) => !v)}>Trả lời</button>}
          {canModerate && depth === 0 && <button type="button" className="font-semibold" style={{ color: T.ink3 }} onClick={() => onPin(c.id, !c.pinned)}>{c.pinned ? 'Bỏ ghim' : 'Ghim'}</button>}
          {(canModerate || (meId && c.author.id === meId)) && <button type="button" className="font-semibold" style={{ color: T.ink3 }} onClick={() => { if (window.confirm('Xóa bình luận này?')) onDelete(c.id); }}>Xóa</button>}
        </div>
        {replies.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {replies.map((r) => <One key={r.id} c={r} canModerate={canModerate} meId={meId} onReply={onReply} onPin={onPin} onDelete={onDelete} depth={1} />)}
          </div>
        )}
        {c.replies.length > 2 && !showAll && (
          <button type="button" className="text-[13px] font-semibold inline-flex items-center gap-1.5 pl-3 self-start" style={{ color: T.ink2 }} onClick={() => setShowAll(true)}><ChevronDown size={14} /> Xem thêm {c.replies.length - 2} trả lời</button>
        )}
        {replying && <Composer compact autoFocus placeholder={`Trả lời ${c.author.name}…`} onSubmit={(t) => { onReply(c.id, t); setReplying(false); }} />}
      </div>
    </div>
  );
}

/**
 * `variant="plain"`: không khung thẻ, không tiêu đề đếm (khung bật lên của bài viết đã có khung riêng).
 * `composerSlot`: nơi đặt ô viết bình luận. Khung bật lên truyền phần đáy đứng yên của nó vào đây, để ô viết luôn nằm
 * dưới cùng trong khi bài viết và danh sách bình luận cuộn phía trên. Không truyền thì ô viết nằm ngay trên danh sách.
 */
export function CommentThread({ targetType, targetId, title, extraHeader, placeholder = 'Viết bình luận…', variant = 'card', composerSlot }: { targetType: CommentTarget; targetId: string; title?: (total: number) => ReactNode; extraHeader?: ReactNode; placeholder?: string; variant?: 'card' | 'plain'; composerSlot?: HTMLElement | null }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<'top' | 'newest'>('top');
  const q = useQuery({ queryKey: [...commentsKey(targetType, targetId), sort], queryFn: () => api.get<CommentList>(`/v1/comments?targetType=${targetType}&targetId=${targetId}&sort=${sort}`) });
  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: commentsKey(targetType, targetId) }), qc.invalidateQueries({ queryKey: ['post'] })]);
  const create = useMutation({
    mutationFn: (input: { contentMd: string; parentCommentId?: string }) => api.post<{ id: string }>('/v1/comments', { targetType, targetId, ...input }),
    // Bình luận vừa gửi có thể nằm ngoài tầm nhìn (danh sách xếp theo tương tác): chờ danh sách tải lại rồi cuộn tới nó.
    onSuccess: async (row) => { await invalidate(); requestAnimationFrame(() => document.getElementById(`binh-luan-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })); },
  });
  const pin = useMutation({ mutationFn: (v: { id: string; pinned: boolean }) => api.post(`/v1/comments/${v.id}/pin`, { pinned: v.pinned }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/v1/comments/${id}`), onSuccess: invalidate });
  const meId = useAuth().user?.id ?? null;
  const plain = variant === 'plain';
  const composer = <Composer placeholder={placeholder} loading={create.isPending} onSubmit={(t) => create.mutate({ contentMd: t })} />;
  const sortButton = <button type="button" className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: T.ink2 }} onClick={() => setSort(sort === 'top' ? 'newest' : 'top')}>{sort === 'top' ? 'Nhiều tương tác' : 'Mới nhất'} <ChevronDown size={14} /></button>;
  return (
    <div className={plain ? 'flex flex-col gap-3' : 'card px-5 md:px-6 py-5 flex flex-col gap-4'}>
      <div className="flex items-center gap-3 flex-wrap">
        {!plain && <span className="font-bold text-[16px]">{title ? title(q.data?.total ?? 0) : `${q.data?.total ?? 0} bình luận`}</span>}
        {extraHeader}
        {!plain && <span className="flex-grow" />}
        {sortButton}
      </div>
      {composerSlot === undefined ? composer : composerSlot ? createPortal(composer, composerSlot) : null}
      <div className="flex flex-col gap-3.5">
        <QueryState q={q} rows={2} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có bình luận', hint: 'Hãy là người đầu tiên' }}>
          {(d) => d.items.map((c) => <One key={c.id} c={c} canModerate={d.canModerate} meId={meId} onReply={(parentCommentId, contentMd) => create.mutate({ contentMd, parentCommentId })} onPin={(id, pinned) => pin.mutate({ id, pinned })} onDelete={(id) => del.mutate(id)} />)}
        </QueryState>
      </div>
    </div>
  );
}
