// Bài viết mở trong khung bật lên ngay trên Bảng tin, bố cục như Facebook: đầu khung và ô viết bình luận ở đáy đứng yên,
// bài viết và các bình luận cuộn ở giữa. Bấm X (hoặc Esc, hoặc bấm ra ngoài) là về lại đúng chỗ đang đọc. Trang riêng /bai-viet/:id vẫn còn cho
// link chia sẻ, thông báo và email.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CommentThread } from '@/components/CommentThread';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PostBody, type PostDetail } from './PostDetail';

export default function PostPopup({ postId, slug, onClose }: { postId: string; slug: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['post', postId], queryFn: () => api.get<PostDetail>(`/v1/posts/${postId}`) });
  const { user } = useAuth();
  const closeBtn = useRef<HTMLButtonElement>(null);
  // Phần đáy đứng yên của khung: ô viết bình luận của CommentThread được đặt vào đây (state chứ không ref, để khi phần
  // đáy gắn vào trang thì CommentThread vẽ lại và thấy nó).
  const [foot, setFoot] = useState<HTMLDivElement | null>(null);

  // onClose đổi theo từng lần Bảng tin vẽ lại; giữ bản mới nhất trong ref để hiệu ứng dưới đây chỉ chạy một lần khi mở,
  // nếu không mỗi lần vẽ lại sẽ giật tiêu điểm khỏi ô bình luận đang gõ.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    // Khóa cuộn trang nền để lăn chuột trong khung không kéo Bảng tin phía sau.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []);

  const title = q.data ? `Bài viết của ${q.data.author.name}` : 'Bài viết';
  return (
    <div className="modal-backdrop post-popup-backdrop" onClick={onClose}>
      <div className="card modal post-popup" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${T.line}` }}>
          <Link to={`/${slug}/bai-viet/${postId}`} aria-label="Mở trang riêng của bài" title="Mở trang riêng của bài" className="btn btn-ghost btn-sm btn-icon"><Maximize2 size={16} /></Link>
          <span className="font-bold text-[16px] flex-grow text-center truncate">{title}</span>
          <button ref={closeBtn} type="button" aria-label="Đóng" title="Đóng" onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><X size={18} /></button>
        </div>
        <div className="post-popup-body">
          <QueryState q={q} rows={2}>
            {(post) => (
              <>
                <PostBody post={post} slug={slug} bare onDeleted={onClose} onCommentsClick={() => foot?.querySelector('textarea')?.focus()} />
                <CommentThread targetType="post" targetId={post.id} variant="plain" composerSlot={foot} placeholder={user ? `Bình luận dưới tên ${user.name}` : 'Viết bình luận…'} />
              </>
            )}
          </QueryState>
        </div>
        <div ref={setFoot} className="post-popup-foot" />
      </div>
    </div>
  );
}
