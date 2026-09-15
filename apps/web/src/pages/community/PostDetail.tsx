// Chi tiết bài viết: nội dung Markdown, ảnh, bình chọn, thích, bình luận; rail tác giả / mục lục / bài liên quan.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, CATEGORY_COLORS, T, Tag } from '@hoiminh/ui';
import { Archive, ChevronLeft, ExternalLink, Heart, MessageCircle, MoreHorizontal, Pin } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CommentThread } from '@/components/CommentThread';
import { PhotoGrid, type GridImage } from '@/components/post/PhotoGrid';
import { PollBox, type Poll } from '@/components/post/PollBox';
import { StatusBox, useToggleLike } from '@/components/post/PostCard';
import { QueryState } from '@/components/QueryState';
import { UserAvatar, UserName, type UserLite } from '@/components/UserLink';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtTime, timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { AuthorCard, EditPostModal, Related, Toc, type PostAuthor } from './PostDetailParts';

interface PostDetail {
  id: string; title: string; contentMd: string; statusBgKey: string | null; pinned: boolean; likeCount: number; commentCount: number; createdAt: string; editedAt: string | null; videoUrl: string | null; linkUrl: string | null;
  author: PostAuthor; space: { id: string; name: string; colorKey: string }; community: { id: string; name: string; slug: string };
  images: GridImage[]; liked: boolean; poll: Poll | null; likers: UserLite[]; related: Array<{ id: string; title: string; likeCount: number; commentCount: number; author: string }>; headings: string[];
  access: { canModerate: boolean; isAuthor: boolean };
}

function Likers({ likers, total }: { likers: UserLite[]; total: number }) {
  if (!total) return null;
  const names = likers.slice(0, 2).map((l) => l.name);
  const rest = total - names.length;
  return (
    <>
      <div className="flex">
        {likers.slice(0, 3).map((l, k) => <span key={l.handle} className="inline-flex rounded-full" style={{ marginLeft: k ? -8 : 0, border: `2px solid ${T.surface}` }}><Avatar name={l.name} src={l.avatarUrl} color={l.coverColor} size={26} /></span>)}
      </div>
      <span className="muted text-[12px]">{names.join(', ')}{rest > 0 ? ` và ${rest} người khác` : ''}</span>
    </>
  );
}

function PostBody({ post, slug }: { post: PostDetail; slug: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const like = useToggleLike('post');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const cat = CATEGORY_COLORS[post.space.colorKey] ?? CATEGORY_COLORS.neutral!;
  const isStatus = Boolean(post.statusBgKey) && !post.title && post.images.length === 0;
  const canEdit = post.access.isAuthor || post.access.canModerate;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['post', post.id] }); void qc.invalidateQueries({ queryKey: ['feed'] }); };
  const pin = useMutation({ mutationFn: () => api.patch(`/v1/posts/${post.id}`, { pinned: !post.pinned }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: () => api.del(`/v1/posts/${post.id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); navigate(`/${slug}/bang-tin`); } });
  const share = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* bỏ qua */ } };
  const when = timeAgo(post.createdAt);
  const showImagesBelow = post.images.length > 0 && !/!\[/.test(post.contentMd);
  return (
    <div className="card px-6 md:px-8 py-7 flex flex-col gap-[18px]">
      <div className="flex items-center gap-3 flex-wrap">
        <UserAvatar user={post.author} size={44} />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <UserName user={post.author} />
            <Tag tone="gold" style={{ height: 20, padding: '0 6px' }}>Cấp {post.author.level}</Tag>
            <span className="tag" style={{ background: cat.bg, color: cat.fg }}>{post.space.name}</span>
            {post.pinned && <span className="inline-flex items-center gap-1 font-semibold text-[12px]" style={{ color: T.goldText }}><Pin size={12} /> Đã ghim</span>}
          </div>
          <div className="muted text-[13px]">{when}{when !== 'vừa xong' && !when.includes('phút') && !when.includes('giờ') ? `, ${fmtTime(post.createdAt)}` : ''} · {post.community.name}{post.editedAt ? ' · đã chỉnh sửa' : ''}</div>
        </div>
        <Button size="sm" icon={<ExternalLink size={14} />} onClick={() => void share()}>{copied ? 'Đã sao chép' : 'Chia sẻ'}</Button>
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
          {post.title && <h1 className="serif m-0 text-[30px] leading-[1.25] font-extrabold">{post.title}</h1>}
          <Markdown md={post.contentMd} />
          {showImagesBelow && <PhotoGrid images={post.images} />}
          {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer" className="chip self-start"><ExternalLink size={14} /> {post.linkUrl}</a>}
        </>
      )}
      {post.poll && <PollBox poll={post.poll} />}
      <div className="flex items-center gap-2 pt-4 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
        <Button size="sm" icon={<Heart size={14} fill={post.liked ? T.accent : 'none'} />} onClick={() => like.mutate(post.id)} style={post.liked ? { color: T.accentText, background: T.accentSoft, borderColor: T.accentSoft } : undefined} aria-pressed={post.liked}>Thích · {post.likeCount}</Button>
        <a href="#binh-luan" className="btn btn-ghost btn-sm"><MessageCircle size={14} /> {post.commentCount} bình luận</a>
        <Button size="sm" icon={<Archive size={14} />} onClick={() => setSaved((v) => !v)} aria-pressed={saved}>{saved ? 'Đã lưu' : 'Lưu'}</Button>
        <span className="flex-grow" />
        <Likers likers={post.likers} total={post.likeCount} />
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
