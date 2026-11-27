// Bình luận lồng nhau (2 cấp) với ghim, cảm xúc, trả lời, sửa, xóa, kèm ảnh / nhãn dán / GIF, dùng cho bài viết, bài học và sự kiện.
// Dưới mỗi bình luận chỉ còn Thích và Trả lời; sửa, ghim, xóa, chép nội dung nằm trong menu ba chấm cạnh bình luận.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { T, Tag } from '@hoiminh/ui';
import { Check, ChevronDown, Pin } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, errorMessage } from '@/lib/api';
import { askForPushSoon } from '@/lib/pwa';
import { useAuth } from '@/lib/auth';
import { useJoinGate } from '@/lib/community';
import { timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { CommentComposer, type ComposerSubmit } from './CommentComposer';
import { CommentMenu } from './CommentMenu';
import { MediaImage } from './media/MediaImage';
import { mediaPayload, type MediaKind } from './media/types';
import { ReactionButton, ReactionSummary } from './post/Reactions';
import { QueryState } from './QueryState';
import { UserAvatar, UserName, type UserLite } from './UserLink';

export interface CommentItem {
  id: string;
  contentMd: string;
  imageUrl: string | null;
  /** null: ảnh tải lên; 'sticker': nhãn dán; 'gif': ảnh động GIPHY. */
  mediaKind?: MediaKind | null;
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

/** Ô sửa bình luận ngay tại chỗ: Lưu (hoặc Ctrl/Cmd Enter) để lưu, Hủy (hoặc Esc) để bỏ. */
/** `allowEmpty`: bình luận có ảnh, nhãn dán hay GIF thì được xóa hết chữ. */
function EditBox({ initial, allowEmpty, onSave, onCancel }: { initial: string; allowEmpty?: boolean; onSave: (text: string) => Promise<unknown>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const grow = () => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
  useEffect(() => { grow(); const el = area.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  const value = text.trim();
  const save = async () => {
    if ((!value && !allowEmpty) || saving) return;
    if (value === initial.trim()) { onCancel(); return; }
    setSaving(true); setError('');
    try { await onSave(value); } catch (e) { setError(errorMessage(e)); setSaving(false); }
  };
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="comment-box">
        <textarea
          ref={area}
          rows={1}
          value={text}
          aria-label="Sửa bình luận"
          onChange={(e) => { setText(e.target.value); grow(); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
          }}
        />
      </div>
      {error && <span className="text-[13px] pl-3" style={{ color: T.accentText }}>{error}</span>}
      <div className="flex items-center gap-3 text-[13px] pl-3">
        <button type="button" className="font-semibold" style={{ color: T.primaryText }} disabled={(!value && !allowEmpty) || saving} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="font-semibold" style={{ color: T.ink3 }} disabled={saving} onClick={onCancel}>Hủy</button>
      </div>
    </div>
  );
}

interface OneProps {
  c: CommentItem;
  canModerate: boolean;
  meId: string | null;
  onReply: (parentId: string, sub: ComposerSubmit) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => Promise<unknown>;
  depth?: number;
}

function One({ c, canModerate, meId, onReply, onPin, onDelete, onEdit, depth = 0 }: OneProps) {
  const [replying, setReplying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const gate = useJoinGate();
  const replies = showAll ? c.replies : c.replies.slice(0, 2);
  const mine = Boolean(meId && c.author.id === meId);
  const hasText = c.contentMd.trim().length > 0;
  const sticker = c.mediaKind === 'sticker';
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2000);
    return () => clearTimeout(t);
  }, [notice]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(c.contentMd); setNotice('Đã chép nội dung'); } catch { window.prompt('Chép nội dung bình luận:', c.contentMd); }
  };
  return (
    <div className="flex gap-2 items-start" id={`binh-luan-${c.id}`}>
      <UserAvatar user={c.author} size={depth ? 28 : 34} />
      <div className="flex-grow min-w-0 flex flex-col gap-1">
        {c.pinned && <div className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: T.goldText }}><Pin size={12} /> Tác giả ghim bình luận này</div>}
        {editing ? (
          <EditBox initial={c.contentMd} allowEmpty={Boolean(c.imageUrl)} onCancel={() => setEditing(false)} onSave={async (t) => { await onEdit(c.id, t); setEditing(false); setNotice('Đã lưu'); }} />
        ) : (
          <div className="comment-row flex items-center gap-1 max-w-full">
            {/* Nhãn dán đứng riêng ngoài bong bóng (như Facebook); bình luận chỉ có nhãn thì bong bóng chỉ còn tên. */}
            <div className="relative min-w-0 max-w-full flex flex-col items-start gap-1">
              <div className={sticker && !hasText ? 'px-1' : 'px-3 py-2 rounded-[16px] max-w-full'} style={sticker && !hasText ? undefined : { background: c.author.isAdmin ? T.goldSoft : T.bg }}>
                <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                  <UserName user={c.author} />
                  {c.author.isAdmin ? <Tag tone="dark" style={{ height: 18, padding: '0 6px', fontSize: 11 }}>Quản trị viên</Tag> : <span className="tag" style={{ background: T.surface, color: T.goldText, height: 18, padding: '0 6px', fontSize: 11 }}>Cấp {c.author.level}</span>}
                </div>
                {hasText && <Markdown md={c.contentMd} small />}
                {c.imageUrl && !sticker && <MediaImage url={c.imageUrl} kind={c.mediaKind} className="mt-2" />}
              </div>
              {c.imageUrl && sticker && <MediaImage url={c.imageUrl} kind="sticker" />}
              {c.likeCount > 0 && (
                <span className="absolute -bottom-2.5 right-1 inline-flex items-center rounded-full px-1 py-px" style={{ background: T.surface, boxShadow: '0 1px 3px rgba(8,24,23,0.18)' }}>
                  <ReactionSummary counts={c.reactionCounts} total={c.likeCount} size={16} showTotal={c.likeCount > 1} />
                </span>
              )}
            </div>
            <CommentMenu
              authorName={c.author.name}
              pinned={c.pinned}
              actions={{
                onCopy: () => void copy(),
                ...(mine ? { onEdit: () => setEditing(true) } : {}),
                ...(canModerate && depth === 0 ? { onPin: () => onPin(c.id, !c.pinned) } : {}),
                ...(canModerate || mine ? { onDelete: () => { if (window.confirm('Xóa bình luận này?')) onDelete(c.id); } } : {}),
              }}
            />
          </div>
        )}
        {!editing && (
          <div className="flex items-center gap-3 text-[13px] pl-3 flex-wrap" style={{ color: T.ink3 }}>
            <span>{timeAgo(c.createdAt, true)}</span>
            <ReactionButton targetType="comment" targetId={c.id} mine={c.myReaction ?? (c.liked ? 'like' : null)} variant="text" />
            {depth === 0 && <button type="button" className="font-semibold" style={{ color: T.ink2 }} onClick={() => (gate.guest ? gate.askJoin() : setReplying((v) => !v))}>Trả lời</button>}
            {notice && <span role="status" className="inline-flex items-center gap-1 font-semibold" style={{ color: T.primaryText }}><Check size={14} />{notice}</span>}
          </div>
        )}
        {replies.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {replies.map((r) => <One key={r.id} c={r} canModerate={canModerate} meId={meId} onReply={onReply} onPin={onPin} onDelete={onDelete} onEdit={onEdit} depth={1} />)}
          </div>
        )}
        {c.replies.length > 2 && !showAll && (
          <button type="button" className="text-[13px] font-semibold inline-flex items-center gap-1.5 pl-3 self-start" style={{ color: T.ink2 }} onClick={() => setShowAll(true)}><ChevronDown size={14} /> Xem thêm {c.replies.length - 2} trả lời</button>
        )}
        {replying && <CommentComposer compact autoFocus placeholder={`Trả lời ${c.author.name}…`} onSubmit={(sub) => { onReply(c.id, sub); setReplying(false); }} />}
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
    mutationFn: ({ sub, parentCommentId }: { sub: ComposerSubmit; parentCommentId?: string }) => api.post<{ id: string }>('/v1/comments', { targetType, targetId, contentMd: sub.text, parentCommentId, ...(sub.image ? { imageFileId: sub.image.fileId } : {}), ...(sub.media ? mediaPayload(sub.media).body : {}) }),
    // Bình luận vừa gửi có thể nằm ngoài tầm nhìn (danh sách xếp theo tương tác): chờ danh sách tải lại rồi cuộn tới nó.
    onError: (e) => window.alert(errorMessage(e)),
    onSuccess: async (row) => { askForPushSoon('comment'); await invalidate(); requestAnimationFrame(() => document.getElementById(`binh-luan-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })); },
  });
  const pin = useMutation({ mutationFn: (v: { id: string; pinned: boolean }) => api.post(`/v1/comments/${v.id}/pin`, { pinned: v.pinned }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/v1/comments/${id}`), onSuccess: invalidate });
  const edit = useMutation({ mutationFn: (v: { id: string; contentMd: string }) => api.patch(`/v1/comments/${v.id}`, { contentMd: v.contentMd }), onSuccess: invalidate });
  const meId = useAuth().user?.id ?? null;
  const plain = variant === 'plain';
  // Khách xem hội mở đọc được bình luận; ô viết bình luận thành lời mời tham gia hội.
  const gate = useJoinGate();
  const composer = gate.guest
    ? <button type="button" className="input w-full text-left text-[15px]" style={{ color: T.ink3 }} onClick={gate.askJoin}>Tham gia hội để bình luận</button>
    : <CommentComposer placeholder={placeholder} loading={create.isPending} onSubmit={(sub) => create.mutate({ sub })} />;
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
          {(d) => d.items.map((c) => <One key={c.id} c={c} canModerate={d.canModerate} meId={meId} onReply={(parentCommentId, sub) => create.mutate({ sub, parentCommentId })} onPin={(id, pinned) => pin.mutate({ id, pinned })} onDelete={(id) => del.mutate(id)} onEdit={(id, contentMd) => edit.mutateAsync({ id, contentMd })} />)}
        </QueryState>
      </div>
    </div>
  );
}
