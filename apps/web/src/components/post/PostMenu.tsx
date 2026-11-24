// Menu ba chấm trên thẻ bài ở Bảng tin. Ai cũng thấy: xem bài, mở tab mới, chia sẻ, chép link.
// Tác giả và người kiểm duyệt thấy thêm: sửa bài, xóa bài. Người kiểm duyệt thấy thêm: ghim / bỏ ghim.
// Máy tính: bảng thả dưới nút. Điện thoại: bảng trượt từ đáy (dùng chung kiểu của menu khóa học).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { Check, Eye, ExternalLink, Link2, MoreHorizontal, Pencil, Pin, PinOff, Share2, Trash2 } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { EditPostModal } from '@/pages/community/PostDetailParts';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { FeedPost } from './PostCard';

/** Địa chỉ đầy đủ của trang riêng bài viết, để chép hoặc gửi đi. */
export function postUrl(slug: string, id: string): string {
  return `${window.location.origin}/${slug}/bai-viet/${id}`;
}

export function PostMenu({ post, slug, canModerate, onOpen }: { post: FeedPost; slug: string; canModerate?: boolean; onOpen?: (post: FeedPost) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const isAuthor = Boolean(user && post.author.id && user.id === post.author.id);
  const canEdit = isAuthor || Boolean(canModerate);
  const href = `/${slug}/bai-viet/${post.id}`;
  const url = postUrl(slug, post.id);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2000);
    return () => clearTimeout(t);
  }, [notice]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['post', post.id] }); };
  const pin = useMutation({
    mutationFn: () => api.patch(`/v1/posts/${post.id}`, { pinned: !post.pinned }),
    onSuccess: () => { refresh(); setNotice(post.pinned ? 'Đã bỏ ghim' : 'Đã ghim bài'); },
    onError: (e) => window.alert(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => api.del(`/v1/posts/${post.id}`),
    onSuccess: refresh,
    onError: (e) => window.alert(errorMessage(e)),
  });

  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setNotice('Đã chép link'); } catch { window.prompt('Chép link bài viết:', url); }
  };
  const share = async () => {
    const title = post.title || `Bài viết của ${post.author.name}`;
    try { await navigator.share({ title, text: post.excerpt || undefined, url }); } catch (e) {
      // Người dùng tự đóng bảng chia sẻ thì thôi; lỗi khác thì chép link thay.
      if ((e as Error)?.name !== 'AbortError') await copyLink();
    }
  };
  const remove = () => { if (window.confirm('Xóa bài viết này? Bình luận và lượt thích của bài cũng mất theo.')) del.mutate(); };
  const view = (e: MouseEvent) => {
    setOpen(false);
    if (onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onOpen(post); }
  };

  const title = post.title || `Bài viết của ${post.author.name}`;
  return (
    <div className="relative flex items-center gap-1 flex-shrink-0">
      {notice && <span role="status" className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: T.primaryText }}><Check size={14} />{notice}</span>}
      <button type="button" className={`post-more${open ? ' on' : ''}`} aria-label="Tùy chọn bài viết" aria-haspopup="menu" aria-expanded={open} title="Tùy chọn bài viết" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <>
          <button type="button" className="course-menu-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <div role="menu" className="course-menu post-menu" aria-label="Tùy chọn bài viết">
            <div className="course-menu-title">{title}</div>
            <Link role="menuitem" to={href} onClick={view}><Eye size={18} />Xem bài viết</Link>
            <a role="menuitem" href={href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><ExternalLink size={18} />Mở trong tab mới</a>
            <div className="course-menu-sep" />
            {canNativeShare && <button type="button" role="menuitem" onClick={pick(() => void share())}><Share2 size={18} />Chia sẻ bài viết</button>}
            <button type="button" role="menuitem" onClick={pick(() => void copyLink())}><Link2 size={18} />Chép link bài viết</button>
            {(canModerate || canEdit) && <div className="course-menu-sep" />}
            {canModerate && (
              <button type="button" role="menuitem" disabled={pin.isPending} onClick={pick(() => pin.mutate())}>
                {post.pinned ? <><PinOff size={18} />Bỏ ghim</> : <><Pin size={18} />Ghim lên đầu Bảng tin</>}
              </button>
            )}
            {canEdit && <button type="button" role="menuitem" onClick={pick(() => setEditing(true))}><Pencil size={18} />Sửa bài</button>}
            {canEdit && <button type="button" role="menuitem" disabled={del.isPending} style={{ color: T.accentText }} onClick={pick(remove)}><Trash2 size={18} />Xóa bài</button>}
          </div>
        </>
      )}
      {editing && <EditPostModal open onClose={() => setEditing(false)} post={post} />}
    </div>
  );
}
