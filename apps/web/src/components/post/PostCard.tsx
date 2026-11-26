// Thẻ bài viết trên Bảng tin: có tiêu đề + trích đoạn + lưới ảnh, hoặc status ngắn với nền màu.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CATEGORY_COLORS, T, Tag, statusBg } from '@hoiminh/ui';
import { MessageCircle, Pin } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { fmtLongDate, fmtTime, timeAgo } from '@/lib/format';
import { PhotoGrid, type GridImage } from './PhotoGrid';
import { PollBox, type Poll } from './PollBox';
import { PostMenu } from './PostMenu';
import { ReactionButton, ReactionSummary } from './Reactions';
import { UserAvatar, UserName, type UserLite } from '../UserLink';

export interface FeedPost {
  id: string;
  title: string;
  excerpt: string;
  contentMd: string;
  statusBgKey: string | null;
  pinned: boolean;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  myReaction?: string | null;
  reactionCounts?: Record<string, number>;
  createdAt: string;
  lastCommentAt: string | null;
  author: UserLite;
  authorLevel: number;
  space: { id: string; name: string; colorKey: string };
  images: GridImage[];
  poll: Poll | null;
  videoUrl?: string | null;
  moderationStatus?: 'approved' | 'pending';
}

export function StatusBox({ text, bgKey, height = 240, fontSize = 28 }: { text: string; bgKey: string | null; height?: number | string; fontSize?: number }) {
  const bg = statusBg(bgKey);
  return (
    <div className="rounded-[14px] flex items-center justify-center text-center px-10 py-8 serif font-extrabold leading-[1.3]" style={{ minHeight: height, background: bg?.css ?? T.ink, color: bg?.fg ?? T.surface, fontSize, letterSpacing: '-0.01em', textWrap: 'balance' as never }}>
      {text}
    </div>
  );
}

/** Duyệt / từ chối bài chờ duyệt (người kiểm duyệt). */
export function useModeratePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject'; reason?: string }) => api.post(`/v1/posts/${v.id}/moderate`, { action: v.action, ...(v.reason ? { reason: v.reason } : {}) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['post'] }); },
  });
}

/**
 * `onOpen`: Bảng tin mở bài trong khung bật lên thay vì chuyển trang. Các chỗ bấm vẫn là link thật tới trang riêng của bài,
 * nên bấm giữa, Ctrl bấm hay "mở trong tab mới" vẫn chạy như cũ; chỉ lượt bấm thường mới bị chặn lại để mở khung.
 * Mốc thời gian cũng là link tới bài (như Facebook): rê chuột thấy ngày giờ đầy đủ, bấm thì mở bài.
 */
export function PostCard({ post, slug, canModerate, onOpen }: { post: FeedPost; slug: string; canModerate?: boolean; onOpen?: (post: FeedPost) => void }) {
  const moderate = useModeratePost();
  const pending = post.moderationStatus === 'pending';
  const cat = CATEGORY_COLORS[post.space.colorKey] ?? CATEGORY_COLORS.neutral!;
  const href = `/${slug}/bai-viet/${post.id}`;
  const isStatus = Boolean(post.statusBgKey) && !post.title && post.images.length === 0;
  const open = onOpen
    ? (e: MouseEvent) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onOpen(post); }
    : undefined;
  return (
    <article className="card px-6 py-5 flex flex-col gap-3" style={post.pinned ? { borderColor: T.gold } : undefined}>
      {pending && (
        <div className="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-[10px] text-[12px]" style={{ background: T.goldSoft, color: T.goldText }}>
          <span className="font-semibold flex-grow">{canModerate ? 'Bài của thành viên mới, đang chờ duyệt' : 'Bài của bạn đang chờ quản trị viên duyệt, chỉ bạn thấy'}</span>
          {canModerate && <><button type="button" className="btn btn-dark btn-sm" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: post.id, action: 'approve' })}>Duyệt</button><button type="button" className="btn btn-ghost btn-sm" disabled={moderate.isPending} onClick={() => { const reason = window.prompt('Lý do từ chối (tác giả sẽ thấy):') ?? ''; moderate.mutate({ id: post.id, action: 'reject', reason }); }}>Từ chối</button></>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <UserAvatar user={post.author} size={40} />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <UserName user={post.author} />
            <Tag tone="gold" style={{ height: 20, padding: '0 6px' }}>Cấp {post.authorLevel}</Tag>
            <span className="muted text-[13px]">· <Link to={href} onClick={open} className="post-time" title={`${fmtLongDate(post.createdAt)}, lúc ${fmtTime(post.createdAt)}`}><time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></Link></span>
          </div>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: T.ink3 }}>
            <span className="tag" style={{ background: cat.bg, color: cat.fg }}>{post.space.name}</span>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 font-semibold text-[12px]" style={{ color: T.goldText }}>
                <Pin size={14} /> Đã ghim
              </span>
            )}
          </div>
        </div>
        <PostMenu post={post} slug={slug} canModerate={canModerate} onOpen={onOpen} />
      </div>
      {isStatus ? (
        <Link to={href} onClick={open}>
          <StatusBox text={post.contentMd} bgKey={post.statusBgKey} />
        </Link>
      ) : (
        <>
          {post.title && (
            <h2 className="serif m-0 text-[20px] leading-[1.3] font-bold">
              <Link to={href} onClick={open} style={{ color: T.ink }}>{post.title}</Link>
            </h2>
          )}
          <p className="m-0 text-[14px] leading-[1.6]" style={{ color: T.ink2 }}>
            {post.excerpt}{post.excerpt.endsWith('…') && <> <Link to={href} onClick={open} className="font-semibold">Xem thêm</Link></>}
          </p>
          {post.images.length > 0 && (
            <Link to={href} onClick={open}>
              <PhotoGrid images={post.images} />
            </Link>
          )}
          {post.poll && <PollBox poll={post.poll} />}
        </>
      )}
      {(post.likeCount > 0 || post.commentCount > 0) && (
        <div className="flex items-center gap-3 text-[14px]" style={{ color: T.ink2 }}>
          <ReactionSummary counts={post.reactionCounts} total={post.likeCount} />
          <span className="flex-grow" />
          {post.commentCount > 0 && <Link to={href} onClick={open} style={{ color: T.ink2 }}>{post.commentCount} bình luận</Link>}
        </div>
      )}
      <div className="post-actions" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <ReactionButton targetType="post" targetId={post.id} mine={post.myReaction ?? (post.liked ? 'like' : null)} />
        <Link to={href} onClick={open} className="post-action" style={{ color: T.ink2 }}><MessageCircle size={18} /> Bình luận</Link>
      </div>
    </article>
  );
}
