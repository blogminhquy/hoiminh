// Bảng tin của hội: chip chuyên mục, composer thu gọn, danh sách bài, rail thông tin hội / Premium / sự kiện sắp tới.
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Chip, DateBlock, T, money } from '@hoiminh/ui';
import { Image as ImageIcon, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PostCard, type FeedPost } from '@/components/post/PostCard';
import { LoadingBlock } from '@/components/QueryState';
import { Empty, ErrorBox } from '@hoiminh/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isPremium, useShell, type Shell } from '@/lib/community';
import { checkoutQuery, entryChoice, promoEndLabel } from '@/lib/membership';
import { fmtTime } from '@/lib/format';
import { Composer } from './Composer';
import { SITE_HOST } from '@/lib/site';

// Khung bật lên của bài viết kéo theo trình hiện Markdown và bình luận: chỉ tải khi có người mở bài.
const PostPopup = lazy(() => import('./PostPopup'));

interface FeedPage { items: FeedPost[]; nextCursor: string | null; spaces: Array<{ id: string; name: string; colorKey: string }>; access: { role: string; canBroadcast: boolean; canModerate: boolean } }

/** Ô mời viết bài: một dòng, chạm vào là mở khung soạn (chuyên mục đã chọn sẵn ở đó). */
function MiniComposer({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth();
  return (
    <button type="button" className="card px-4 py-3 flex items-center gap-3 text-left w-full" onClick={onOpen} aria-label="Viết bài mới">
      <Avatar name={user?.name} src={user?.avatarUrl} size={40} />
      <span className="flex-grow text-[15px]" style={{ color: T.ink3 }}>Bạn muốn chia sẻ gì?</span>
      <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: T.primarySoft, color: T.primaryText }}><ImageIcon size={20} /></span>
    </button>
  );
}

function Rail({ shell }: { shell: Shell }) {
  const c = shell.community;
  const premium = shell.premium && !isPremium(shell) ? shell.premium : null;
  const entry = entryChoice(premium, c.pricingMode);
  return (
    <aside className="rail">
      <div className="card overflow-hidden">
        {/* Giống thẻ ở trang giới thiệu: có ảnh bìa thì hiện trọn ảnh 16:9, không chồng chữ (ảnh thường đã có chữ riêng, tên hội nằm ngay dưới); chưa có thì nền màu kèm khẩu hiệu. */}
        {c.coverUrl
          ? <img src={c.coverUrl} alt={`Ảnh bìa ${c.name}`} className="block w-full" style={{ aspectRatio: '16 / 9', objectFit: 'cover', background: c.coverColor }} />
          : (
            <div className="h-[120px] flex items-end p-4" style={{ background: c.coverColor }}>
              <span className="serif text-[22px] font-bold leading-[1.1]" style={{ color: T.invertInk }}>{c.coverTagline}</span>
            </div>
          )}
        <div className="p-4 flex flex-col gap-2.5">
          <div className="font-semibold text-[16px]">{c.name}</div>
          <div className="muted text-[13px]">{SITE_HOST}/{c.slug}</div>
          <p className="m-0 text-[13px]" style={{ color: T.ink2 }}>{c.shortDescription}</p>
          <div className="grid grid-cols-3 gap-2 pt-1.5" style={{ borderTop: `1px solid ${T.line}` }}>
            {[[shell.stats.members, 'Thành viên'], [shell.stats.online, 'Online'], [shell.stats.admins, 'Quản trị']].map(([n, l]) => (
              <div key={String(l)} className="text-center"><div className="font-bold text-[18px]">{n}</div><div className="muted text-[12px]">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      {premium && (
        <div className="card card-invert p-[18px] flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} /> Gói Premium</div>
          <div className="serif text-[19px] font-bold leading-[1.3]">Mở khóa toàn bộ khóa học và trở thành affiliate</div>
          <div className="text-[13px]" style={{ color: T.sideText }}>{entry ? <>{entry.percentOff > 0 && <span className="line-through mr-1.5">{money(entry.listMinor)}</span>}{money(entry.payMinor)}/{entry.unit} · </> : null}hủy bất cứ lúc nào</div>
          {entry && entry.percentOff > 0 && <div className="text-[13px] font-semibold" style={{ color: T.gold }}>Đang giảm {entry.percentOff}%{promoEndLabel(premium.promo) ? ` đến hết ngày ${promoEndLabel(premium.promo)}` : ''}</div>}
          <Link to={`/${c.slug}/thanh-toan?${checkoutQuery(entry)}`} className="btn btn-primary w-full mt-1">Nâng cấp ngay</Link>
        </div>
      )}
      <div className="card p-4 flex flex-col gap-3">
        <Link to={`/${c.slug}/su-kien`} className="font-semibold" style={{ color: T.ink }}>Sự kiện sắp tới</Link>
        {shell.upcomingEvents.length === 0 && <span className="muted text-[13px]">Chưa có sự kiện nào sắp diễn ra</span>}
        {shell.upcomingEvents.slice(0, 3).map((e, i) => (
          <Link key={e.id} to={`/${c.slug}/su-kien/${e.id}`} className="flex gap-3 items-center" style={{ color: T.ink }}>
            <DateBlock date={new Date(e.startsAt)} tone={i === 0 ? 'accent' : 'teal'} size={44} />
            <div><div className="font-medium text-[13px]">{e.title}</div><div className="muted text-[12px]">{fmtTime(e.startsAt)} · {e.meetingProvider === 'zoom' ? 'Zoom' : e.kind === 'offline' ? 'Trực tiếp' : 'Online'}</div></div>
          </Link>
        ))}
      </div>
    </aside>
  );
}

export default function Page() {
  const shell = useShell();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const cid = shell.community.id;
  const slug = shell.community.slug;
  const [spaceId, setSpaceId] = useState<string>('');
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const composing = location.pathname.endsWith('/bang-tin/moi');
  const qc = useQueryClient();
  // Bài đang mở trong khung bật lên nằm trên địa chỉ (?bai=...): nút Quay lại của trình duyệt đóng khung, tải lại trang vẫn giữ khung.
  const openId = params.get('bai');
  const openPost = (p: FeedPost) => { const next = new URLSearchParams(params); next.set('bai', p.id); navigate({ search: next.toString() }, { state: { popup: true } }); };
  const closePost = () => {
    // Số bình luận trên thẻ bài có thể đã đổi trong lúc mở khung.
    void qc.invalidateQueries({ queryKey: ['feed'] });
    if ((location.state as { popup?: boolean } | null)?.popup) { navigate(-1); return; }
    const next = new URLSearchParams(params); next.delete('bai'); setParams(next, { replace: true });
  };

  const feed = useInfiniteQuery({
    queryKey: ['feed', cid, spaceId],
    queryFn: ({ pageParam }) => api.get<FeedPage>(`/v1/communities/${cid}/feed?${spaceId ? `spaceId=${spaceId}&` : ''}${pageParam ? `cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const spaces = feed.data?.pages[0]?.spaces ?? [];
  const posts = useMemo(() => {
    const all = feed.data?.pages.flatMap((p) => p.items) ?? [];
    return q ? all.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.contentMd.toLowerCase().includes(q)) : all;
  }, [feed.data, q]);

  return (
    <div className="two-col">
      <div className="main">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h1 className="serif m-0 text-[28px] font-bold page-title">Bảng tin</h1>
          <div className="chip-row">
            <Chip on={!spaceId} onClick={() => setSpaceId('')}>Tất cả</Chip>
            {spaces.map((s) => <Chip key={s.id} on={spaceId === s.id} onClick={() => setSpaceId(s.id)}>{s.name}</Chip>)}
          </div>
        </div>
        {q && (
          <div className="flex items-center gap-2">
            <Chip on onClick={() => { params.delete('q'); setParams(params); }}>Kết quả cho “{params.get('q')}” <X size={14} /></Chip>
            <span className="muted text-[13px]">{posts.length} bài</span>
          </div>
        )}
        <MiniComposer onOpen={() => navigate(`/${slug}/bang-tin/moi`)} />
        {feed.isLoading && <LoadingBlock rows={3} />}
        {feed.isError && <ErrorBox message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />}
        {feed.isSuccess && posts.length === 0 && <Empty title={q ? 'Không tìm thấy bài nào' : 'Chưa có bài viết'} hint={q ? 'Thử từ khóa khác' : 'Hãy là người đầu tiên chia sẻ với cộng đồng'} />}
        {posts.map((p) => <PostCard key={p.id} post={p} slug={slug} canModerate={feed.data?.pages[0]?.access.canModerate} onOpen={openPost} />)}
        {feed.hasNextPage && !q && (
          <Button block loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>Tải thêm</Button>
        )}
      </div>
      <Rail shell={shell} />
      <Composer open={composing} onClose={() => navigate(`/${slug}/bang-tin`)} defaultSpaceId={spaceId} />
      {openId && <Suspense fallback={null}><PostPopup postId={openId} slug={slug} onClose={closePost} /></Suspense>}
    </div>
  );
}
