// Chi tiết bài viết: nội dung Markdown, ảnh, bình chọn, thích, bình luận; rail tác giả / mục lục / bài liên quan.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, CATEGORY_COLORS, T, Tag } from '@hoiminh/ui';
import { ChevronLeft, ExternalLink, MessageCircle, MoreHorizontal, Pin, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CommentThread } from '@/components/CommentThread';
import { PhotoGrid, type GridImage } from '@/components/post/PhotoGrid';
import { PollBox, type Poll } from '@/components/post/PollBox';
import { StatusBox } from '@/components/post/PostCard';
import { ReactionButton, ReactionSummary } from '@/components/post/Reactions';
import { QueryState } from '@/components/QueryState';
import { UserAvatar, UserName, type UserLite } from '@/components/UserLink';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtLongDate, fmtTime, timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { AuthorCard, EditPostModal, Related, Toc, type PostAuthor } from './PostDetailParts';

export interface PostDetail {
  id: string; title: string; contentMd: string; statusBgKey: string | null; pinned: boolean; likeCount: number; commentCount: number; createdAt: string; editedAt: string | null; videoUrl: string | null; linkUrl: string | null;
  author: PostAuthor; space: { id: string; name: string; colorKey: string }; community: { id: string; name: string; slug: string };
  images: GridImage[]; liked: boolean; myReaction?: string | null; reactionCounts?: Record<string, number>; poll: Poll | null; likers: UserLite[]; related: Array<{ id: string; title: string; likeCount: number; commentCount: number; author: string }>; headings: string[];
  access: { canModerate: boolean; isAuthor: boolean };
}

/**
 * Thân bài viết: tác giả, nội dung, thích, lưu, sửa, xóa. Dùng ở trang riêng của bài và ở khung bật lên trên Bảng tin
 * (`bare`: bỏ khung thẻ vì khung bật lên đã có khung; `onDeleted`, `onCommentsClick`: khung bật lên tự đóng và tự cuộn).
 */
export function PostBody({ post, slug, bare, onDeleted, onCommentsClick }: { post: PostDetail; slug: string; bare?: boolean; onDeleted?: () => void; onCommentsClick?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const cat = CATEGORY_COLORS[post.space.colorKey] ?? CATEGORY_COLORS.neutral!;
  const isStatus = Boolean(post.statusBgKey) && !post.title && post.images.length === 0;
  const canEdit = post.access.isAuthor || post.access.canModerate;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['post', post.id] }); void qc.invalidateQueries({ queryKey: ['feed'] }); };
  const pin = useMutation({ mutationFn: () => api.patch(`/v1/posts/${post.id}`, { pinned: !post.pinned }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: () => api.del(`/v1/posts/${post.id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); if (onDeleted) onDeleted(); else navigate(`/${slug}/bang-tin`); } });
  // Luôn chép địa chỉ trang riêng của bài, kể cả khi đang xem trong khung bật lên trên Bảng tin.
  const share = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/${slug}/bai-viet/${post.id}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* bỏ qua */ } };
  const when = timeAgo(post.createdAt);
  const showImagesBelow = post.images.length > 0 && !/!\[/.test(post.contentMd);
  return (
    <div className={bare ? 'flex flex-col gap-3' : 'card px-6 md:px-8 py-7 flex flex-col gap-[18px]'}>
      <div className="flex items-center gap-3 flex-wrap">
        <UserAvatar user={post.author} size={44} />
        {/* flex-1 + minWidth: trên màn hẹp tên tác giả vẫn đứng cạnh avatar, các nút mới là thứ rớt xuống dòng. */}
        <div className="flex-1" style={{ minWidth: 180 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <UserName user={post.author} />
            <Tag tone="gold" style={{ height: 20, padding: '0 6px' }}>Cấp {post.author.level}</Tag>
            <span className="tag" style={{ background: cat.bg, color: cat.fg }}>{post.space.name}</span>
            {post.pinned && <span className="inline-flex items-center gap-1 font-semibold text-[12px]" style={{ color: T.goldText }}><Pin size={12} /> Đã ghim</span>}
          </div>
          <div className="muted text-[13px]"><time dateTime={post.createdAt} title={`${fmtLongDate(post.createdAt)}, lúc ${fmtTime(post.createdAt)}`}>{when}</time>{when !== 'vừa xong' && !when.includes('phút') && !when.includes('giờ') ? `, ${fmtTime(post.createdAt)}` : ''}{bare ? '' : ` · ${post.community.name}`}{post.editedAt ? ' · đã chỉnh sửa' : ''}</div>
        </div>
        {post.access.canModerate && <Button size="sm" icon={<Pin size={14} />} loading={pin.isPending} onClick={() => pin.mutate()} aria-label={post.pinned ? 'Bỏ ghim' : 'Ghim'} style={post.pinned ? { color: T.goldText, background: T.goldSoft, borderColor: T.goldSoft } : undefined} />}
        {canEdit && (
          <div className="relative">
            <button type="button" aria-label="Thêm" onClick={() => setMenu((v) => !v)} style={{ color: T.ink3 }}><MoreHorizontal size={20} /></button>
            {menu && (
              <div className="card absolute right-0 top-7 z-10 py-1 min-w-[140px] shadow-lg" onMouseLeave={() => setMenu(false)}>
                <button type="button" className="block w-full text-left px-4 py-2 text-[13px]" onClick={() => { setMenu(false); setEditing(true); }}>Sửa bài</button>
                <button type="button" className="block w-full text-left px-4 py-2 text-[13px]" style={{ color: T.accentText }} onClick={() => { setMenu(false); if (window.confirm('Xóa bài viết này?')) del.mutate(); }}>Xóa bài</button>
              </div>
            )}
          </div>
        )}
      </div>
      {isStatus ? (
        <StatusBox text={post.contentMd} bgKey={post.statusBgKey} height={320} fontSize={32} />
      ) : (
        <>
          {post.title && <h1 className={`serif m-0 leading-[1.25] font-extrabold ${bare ? 'text-[22px]' : 'text-[30px]'}`}>{post.title}</h1>}
          <Markdown md={post.contentMd} />
          {showImagesBelow && <PhotoGrid images={post.images} />}
          {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer" className="chip self-start"><ExternalLink size={14} /> {post.linkUrl}</a>}
        </>
      )}
      {post.poll && <PollBox poll={post.poll} />}
      {(post.likeCount > 0 || post.commentCount > 0) && (
        <div className="flex items-center gap-3 text-[14px]" style={{ color: T.ink2 }}>
          <ReactionSummary counts={post.reactionCounts} total={post.likeCount} />
          <span className="flex-grow" />
          {post.commentCount > 0 && <span>{post.commentCount} bình luận</span>}
        </div>
      )}
      <div className="post-actions">
        <ReactionButton targetType="post" targetId={post.id} mine={post.myReaction ?? (post.liked ? 'like' : null)} />
        {onCommentsClick
          ? <button type="button" className="post-action" onClick={onCommentsClick}><MessageCircle size={18} /> Bình luận</button>
          : <a href="#binh-luan" className="post-action" style={{ color: T.ink2 }}><MessageCircle size={18} /> Bình luận</a>}
        <button type="button" className="post-action" onClick={() => void share()}><Share2 size={18} /> {copied ? 'Đã chép link' : 'Chia sẻ'}</button>
      </div>
      {editing && <EditPostModal open onClose={() => setEditing(false)} post={post} />}
    </div>
  );
}

export default function Page() {
  const { postId = '' } = useParams();
  const shell = useShell();
  const slug = shell.community.slug;
  const q = useQuery({ queryKey: ['post', postId], queryFn: () => api.get<PostDetail>(`/v1/posts/${postId}`), enabled: Boolean(postId) });
  return (
    <div className="two-col">
      <article className="main" style={{ gap: 20 }}>
        <Link to={`/${slug}/bang-tin`} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} /> Bảng tin</Link>
        <QueryState q={q} rows={2}>
          {(post) => (
            <>
              <PostBody post={post} slug={slug} />
              <div id="binh-luan"><CommentThread targetType="post" targetId={post.id} /></div>
            </>
          )}
        </QueryState>
      </article>
      {q.data && (
        <aside className="rail">
          <AuthorCard author={q.data.author} communityId={shell.community.id} />
          <Toc headings={q.data.headings} />
          <Related items={q.data.related} slug={slug} />
        </aside>
      )}
    </div>
  );
}
