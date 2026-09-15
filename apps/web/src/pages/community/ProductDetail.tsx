// Chi tiết sản phẩm (productDetailMain): breadcrumb, bìa/video giới thiệu, tiêu đề, lợi ích, giáo trình, giảng viên, FAQ + rail giá.
import { useQuery } from '@tanstack/react-query';
import { Avatar, T } from '@hoiminh/ui';
import { ChevronLeft, Play, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDuration } from '@/lib/format';
import { Benefits, Curriculum, Faq, PriceRail, type Product } from './ProductDetailParts';

interface ProductList { items: Array<{ id: string; slug: string }> }
const KIND_LABEL = { course: 'Khóa học video', bundle: 'Combo', digital: 'Tài liệu' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useProductId(communityId: string, productSlug: string) {
  const list = useQuery({ queryKey: ['products', communityId, 'all', ''], queryFn: () => api.get<ProductList>(`/v1/communities/${communityId}/products`), enabled: !UUID.test(productSlug) });
  if (UUID.test(productSlug)) return { id: productSlug, loading: false };
  return { id: list.data?.items.find((p) => p.slug === productSlug)?.id ?? null, loading: list.isLoading };
}

function Cover({ p }: { p: Product }) {
  const [play, setPlay] = useState(false);
  const embed = useQuery({ queryKey: ['video-parse', p.page?.introVideoUrl], queryFn: () => api.post<{ embed: { embedUrl: string } | null }>('/v1/video/parse', { url: p.page?.introVideoUrl }), enabled: play && Boolean(p.page?.introVideoUrl) });
  if (play && embed.data?.embed) return <div className="relative rounded-[18px] overflow-hidden" style={{ aspectRatio: '16 / 9', background: '#171310' }}><iframe src={embed.data.embed.embedUrl} title="Video giới thiệu" className="absolute inset-0 w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>;
  return (
    <div className="relative rounded-[18px] overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16 / 9', background: p.coverUrl ? `url(${p.coverUrl}) center/cover` : p.coverColor }}>
      <div className="absolute left-7 bottom-7" style={{ color: T.surface }}><div className="serif text-[28px] md:text-[40px] font-extrabold leading-[1.05] max-w-[520px]">{p.page?.headline || p.name}</div>{p.page?.introVideoUrl && <div className="text-[14px] opacity-85 mt-2">Video giới thiệu</div>}</div>
      {p.page?.introVideoUrl && <button type="button" onClick={() => setPlay(true)} aria-label="Phát video giới thiệu" className="w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{ background: T.ink, color: T.surface }}><Play size={30} /></button>}
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const slug = shell.community.slug;
  const { productSlug = '' } = useParams();
  const { id, loading } = useProductId(shell.community.id, productSlug);
  const q = useQuery({ queryKey: ['product', id], queryFn: () => api.get<Product>(`/v1/products/${id}`), enabled: Boolean(id) });
  if (loading) return <div className="p-6 muted text-[13px]">Đang tải…</div>;
  if (!id) return <div className="card p-8 text-center"><div className="font-semibold">Không tìm thấy sản phẩm</div><Link to={`/${slug}/cua-hang`} className="btn btn-ghost btn-sm mt-3">Về cửa hàng</Link></div>;
  return (
    <QueryState q={q} rows={6}>
      {(p) => (
        <div className="two-col">
          <div className="main flex flex-col gap-5">
            <div className="flex items-center gap-2 text-[13px]" style={{ color: T.ink3 }}><Link to={`/${slug}/cua-hang`} className="inline-flex items-center gap-1.5" style={{ color: T.ink3 }}><ChevronLeft size={16} />Cửa hàng</Link><span>/</span><span>{KIND_LABEL[p.kind]}</span></div>
            <Cover p={p} />
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2 items-center text-[13px] flex-wrap"><span className="tag" style={{ background: T.accentSoft, color: T.accentText }}>{KIND_LABEL[p.kind]}</span><span className="muted">{[p.course ? `${p.course.lessonCount} bài` : '', p.course ? fmtDuration(p.course.totalDurationSeconds, true) : '', p.course ? `cập nhật ${new Date(p.course.updatedAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}` : '', 'tiếng Việt'].filter(Boolean).join(' · ')}</span></div>
              <h1 className="serif m-0 text-[32px] font-extrabold leading-[1.2]">{p.name}</h1>
              <p className="m-0 text-[17px] leading-[1.6]" style={{ color: T.ink2 }}>{p.page?.subheadline || p.shortDescription}</p>
              <div className="flex items-center gap-2.5 text-[13px] flex-wrap">{p.ratingCount > 0 && <><span className="inline-flex gap-0.5" style={{ color: T.gold }}>{Array.from({ length: 5 }).map((_, i) => <Sparkles key={i} size={14} />)}</span><strong>{Number(p.ratingAvg ?? 0).toFixed(1)}</strong><span className="muted">· {p.ratingCount} đánh giá ·</span></>}<span className="muted">{p.salesCount} thành viên đã sở hữu</span></div>
            </div>
            <Benefits items={p.page?.benefits ?? []} />
            {p.kind === 'bundle' && p.bundleItems.length > 0 && (
              <div className="card flex flex-col gap-3" style={{ padding: '22px 24px' }}>
                <div className="font-bold text-[16px]">Có gì trong combo</div>
                {p.bundleItems.map((b) => <Link key={b.id} to={`/${slug}/cua-hang/${b.slug}`} className="flex items-center gap-3 py-2" style={{ borderTop: `1px solid ${T.line}`, color: T.ink }}><div className="w-11 h-11 rounded-[10px] flex-shrink-0" style={{ background: b.coverColor }} /><span className="flex-grow font-semibold text-[14px]">{b.name}</span></Link>)}
              </div>
            )}
            <Curriculum p={p} slug={slug} />
            {p.instructor && (
              <div className="card flex gap-[18px] items-center flex-col sm:flex-row" style={{ padding: '22px 24px' }}>
                <Avatar name={p.instructor.name} src={p.instructor.avatarUrl} color={p.instructor.coverColor ?? T.ink} size={64} />
                <div className="flex-grow"><div className="font-bold text-[16px]">{p.instructor.name} <span className="muted font-medium text-[13px]">· Giảng viên</span></div><div className="text-[14px] leading-[1.6] mt-1" style={{ color: T.ink2 }}>{p.instructor.bio}</div></div>
                <Link to={`/u/${p.instructor.handle}`} className="btn btn-ghost btn-sm">Xem hồ sơ</Link>
              </div>
            )}
            <Faq items={p.page?.faq ?? []} />
          </div>
          <PriceRail p={p} slug={slug} premium={shell.premium} />
        </div>
      )}
    </QueryState>
  );
}
