// Mảnh của trang chi tiết bài viết: thẻ tác giả (theo dõi, nhắn tin), mục lục, bài liên quan, modal sửa bài.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, T } from '@hoiminh/ui';
import { MessageCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAvatar, UserName, type UserLite } from '@/components/UserLink';
import { api, errorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export interface PostAuthor extends UserLite { id: string; bio: string | null; level: number; joinedAt: string | null; postCount: number; tierId: string | null }

export function AuthorCard({ author, communityId }: { author: PostAuthor; communityId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [following, setFollowing] = useState(false);
  const send = useMutation({
    mutationFn: () => api.post('/v1/me/messages', { recipientUserId: author.id, communityId, body: body.trim() }),
    onSuccess: () => { setOpen(false); navigate('/tin-nhan'); },
  });
  return (
    <div className="card p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <UserAvatar user={author} size={44} />
        <div className="flex-grow min-w-0">
          <div className="font-semibold"><UserName user={author} /></div>
          <div className="muted text-[12px]">{author.tierId ? 'Premium' : 'Thành viên'} · tham gia {fmtDate(author.joinedAt) || '—'} · {author.postCount} bài viết</div>
        </div>
      </div>
      {author.bio && <div className="text-[13px]" style={{ color: T.ink2 }}>{author.bio}</div>}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" icon={<UserPlus size={14} />} onClick={() => setFollowing((v) => !v)} aria-pressed={following}>{following ? 'Đang theo dõi' : 'Theo dõi'}</Button>
        <Button size="sm" variant="dark" className="flex-1" icon={<MessageCircle size={14} />} onClick={() => setOpen(true)}>Nhắn tin</Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Nhắn tin cho ${author.name}`} width={520}>
        <div className="p-5 flex flex-col gap-3">
          <span className="input textarea"><textarea rows={4} autoFocus placeholder="Viết tin nhắn…" value={body} onChange={(e) => setBody(e.target.value)} /></span>
          {send.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(send.error)}</span>}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setOpen(false)}>Hủy</Button>
            <Button size="sm" variant="dark" loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>Gửi</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Mục lục từ các heading trong bài; bấm cuộn tới heading tương ứng. */
export function Toc({ headings }: { headings: string[] }) {
  const [active, setActive] = useState(0);
  if (!headings.length) return null;
  const go = (i: number) => {
    setActive(i);
    const el = Array.from(document.querySelectorAll('.md h1, .md h2, .md h3')).find((h) => h.textContent?.trim() === headings[i]);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="font-semibold text-[13px]">Trong bài này</div>
      {headings.map((h, i) => (
        <button key={i} type="button" onClick={() => go(i)} className="flex items-center gap-2 text-[13px] text-left" style={{ color: active === i ? T.ink : T.ink2, fontWeight: active === i ? 600 : 400 }}>
          <span className="w-[3px] h-4 rounded-full flex-shrink-0" style={{ background: active === i ? T.accent : T.line }} />{h}
        </button>
      ))}
    </div>
  );
}

export function Related({ items, slug }: { items: Array<{ id: string; title: string; likeCount: number; commentCount: number; author: string }>; slug: string }) {
  if (!items.length) return null;
  return (
    <div className="card p-4 flex flex-col gap-2.5">
      <div className="font-semibold text-[13px]">Bài liên quan</div>
      {items.map((r) => (
        <Link key={r.id} to={`/${slug}/bai-viet/${r.id}`} className="flex flex-col gap-0.5" style={{ color: T.ink }}>
          <span className="text-[13px] font-semibold leading-[1.4]">{r.title || 'Bài không tiêu đề'}</span>
          <span className="muted text-[12px]">{r.author} · {r.likeCount ? `${r.likeCount} thích` : `${r.commentCount} bình luận`}</span>
        </Link>
      ))}
    </div>
  );
}

export function EditPostModal({ open, onClose, post }: { open: boolean; onClose: () => void; post: { id: string; title: string; contentMd: string } }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.contentMd);
  const save = useMutation({
    mutationFn: () => api.patch(`/v1/posts/${post.id}`, { title: title.trim(), contentMd: content.trim() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['post', post.id] }); void qc.invalidateQueries({ queryKey: ['feed'] }); onClose(); },
  });
  return (
    <Modal open={open} onClose={onClose} title="Sửa bài viết" width={680}>
      <div className="p-5 flex flex-col gap-3">
        <span className="input"><input placeholder="Tiêu đề (tùy chọn)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></span>
        <span className="input textarea"><textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} /></span>
        {save.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</span>}
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onClose}>Hủy</Button>
          <Button size="sm" variant="dark" loading={save.isPending} disabled={!content.trim()} onClick={() => save.mutate()}>Lưu thay đổi</Button>
        </div>
      </div>
    </Modal>
  );
}
