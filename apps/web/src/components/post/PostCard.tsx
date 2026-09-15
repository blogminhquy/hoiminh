// Thẻ bài viết trên Bảng tin: có tiêu đề + trích đoạn + lưới ảnh, hoặc status ngắn với nền màu.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CATEGORY_COLORS, T, Tag, statusBg } from '@hoiminh/ui';
import { Heart, MessageCircle, MoreHorizontal, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { PhotoGrid, type GridImage } from './PhotoGrid';
import { PollBox, type Poll } from './PollBox';
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
  createdAt: string;
  lastCommentAt: string | null;
  author: UserLite;
  authorLevel: number;
  space: { id: string; name: string; colorKey: string };
  images: GridImage[];
  poll: Poll | null;
  videoUrl?: string | null;
}

export function StatusBox({ text, bgKey, height = 240, fontSize = 28 }: { text: string; bgKey: string | null; height?: number | string; fontSize?: number }) {
  const bg = statusBg(bgKey);
  return (
    <div className="rounded-[14px] flex items-center justify-center text-center px-10 py-8 serif font-extrabold leading-[1.3]" style={{ minHeight: height, background: bg?.css ?? T.ink, color: bg?.fg ?? T.surface, fontSize, letterSpacing: '-0.01em', textWrap: 'balance' as never }}>
      {text}
    </div>
  );
}

export function useToggleLike(targetType: 'post' | 'comment') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => api.post<{ liked: boolean; likeCount: number }>('/v1/reactions/toggle', { targetType, targetId }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['post'] }); void qc.invalidateQueries({ queryKey: ['comments'] }); },
  });
}

export function PostCard({ post, slug, onMenu }: { post: FeedPost; slug: string; onMenu?: (post: FeedPost) => void }) {
  const like = useToggleLike('post');
  const cat = CATEGORY_COLORS[post.space.colorKey] ?? CATEGORY_COLORS.neutral!;
  const href = `/${slug}/bai-viet/${post.id}`;
  const isStatus = Boolean(post.statusBgKey) && !post.title && post.images.length === 0;
  return (
    <article className="card px-6 py-5 flex flex-col gap-3" style={post.pinned ? { borderColor: T.gold } : undefined}>
      <div className="flex items-center gap-3">
        <UserAvatar user={post.author} size={40} />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <UserName user={post.author} />
            <Tag tone="gold" style={{ height: 20, padding: '0 6px' }}>Cấp {post.authorLevel}</Tag>
            <span className="muted text-[13px]">· {timeAgo(post.createdAt)}</span>
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
        {onMenu && (
          <button type="button" aria-label="Thêm" onClick={() => onMenu(post)} style={{ color: T.ink3 }}>
            <MoreHorizontal size={20} />
          </button>
        )}
      </div>
      {isStatus ? (
        <Link to={href}>
          <StatusBox text={post.contentMd} bgKey={post.statusBgKey} />
        </Link>
      ) : (
        <>
          {post.title && (
            <h2 className="serif m-0 text-[20px] leading-[1.3] font-bold">
              <Link to={href} style={{ color: T.ink }}>{post.title}</Link>
            </h2>
          )}
          <p className="m-0 text-[14px] leading-[1.6]" style={{ color: T.ink2 }}>
            {post.excerpt}{post.excerpt.endsWith('…') && <> <Link to={href} className="font-semibold">Xem thêm</Link></>}
          </p>
          {post.images.length > 0 && (
            <Link to={href}>
              <PhotoGrid images={post.images} />
            </Link>
          )}
          {post.poll && <PollBox poll={post.poll} />}
        </>
      )}
      <div className="flex items-center gap-5 pt-1.5 text-[13px] font-medium" style={{ borderTop: `1px solid ${T.line}`, color: T.ink2 }}>
        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => like.mutate(post.id)} style={{ color: post.liked ? T.accentText : T.ink2 }} aria-pressed={post.liked}>
          <Heart size={18} fill={post.liked ? T.accent : 'none'} /> {post.likeCount}
        </button>
        <Link to={href} className="inline-flex items-center gap-1.5" style={{ color: T.ink2 }}>
          <MessageCircle size={18} /> {post.commentCount} bình luận
        </Link>
        <span className="flex-grow" />
        {post.lastCommentAt && <span className="muted hide-mobile">Bình luận mới nhất {timeAgo(post.lastCommentAt)}</span>}
      </div>
    </article>
  );
}
