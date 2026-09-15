// Cửa hàng (storeMain): tiêu đề, chip lọc theo loại, ô tìm, lưới 3 cột thẻ sản phẩm (giá, giảm, Combo, Đã sở hữu).
import { useQuery } from '@tanstack/react-query';
import { Chip, T, money } from '@hoiminh/ui';
import { Check, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDuration } from '@/lib/format';

export interface ProductItem { id: string; kind: 'course' | 'bundle' | 'digital'; name: string; slug: string; shortDescription: string; coverUrl: string | null; coverColor: string; courseId: string | null; priceMinor: number; compareAtMinor: number | null; status: string; lessonCount: number | null; totalDurationSeconds: number | null; bundleCount: number; discountPercent: number; owned: boolean }
interface ProductList { items: ProductItem[]; counts: Record<string, number>; canManage: boolean }
type Kind = 'all' | 'course' | 'bundle' | 'digital';
const KIND_LABEL: Record<string, string> = { course: 'Khóa học', bundle: 'Combo', digital: 'Tài liệu' };

export function productType(p: ProductItem): string {
  if (p.kind === 'bundle') return `Combo · ${p.bundleCount} khóa học`;
  if (p.kind === 'digital') return 'Tài liệu · tải về';
  return [`Khóa học video`, p.lessonCount ? `${p.lessonCount} bài` : '', fmtDuration(p.totalDurationSeconds, true)].filter(Boolean).join(' · ');
}

function ProductCard({ p, slug }: { p: ProductItem; slug: string }) {
  const to = `/${slug}/cua-hang/${p.slug}`;
  const learnTo = p.kind === 'course' && p.courseId ? `/${slug}/khoa-hoc/${p.courseId}` : to;
  return (
    <div className="card overflow-hidden flex flex-col" style={{ opacity: p.status === 'draft' ? 0.7 : 1 }}>
      <Link to={to} className="relative h-[170px] flex items-end p-4" style={{ background: p.coverUrl ? `url(${p.coverUrl}) center/cover` : p.coverColor }}>
        <span className="serif text-[22px] font-bold leading-[1.15] max-w-[240px]" style={{ color: T.surface }}>{p.name}</span>
        {p.discountPercent > 0 && !p.owned && <span className="tag absolute top-3 right-3" style={{ background: T.ink, color: T.surface }}>-{p.discountPercent}%</span>}
        {p.kind === 'bundle' && <span className="tag absolute top-3 left-3" style={{ background: T.gold, color: T.ink }}>Combo</span>}
        {p.status === 'draft' && <span className="tag absolute top-3 left-3" style={{ background: T.bg, color: T.ink3 }}>Nháp</span>}
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-grow">
        <div className="muted text-[12px]">{productType(p)}</div>
        <Link to={to} className="font-semibold text-[16px]" style={{ color: T.ink }}>{p.name}</Link>
        <div className="text-[13px]" style={{ color: T.ink2 }}>{p.shortDescription}</div>
        <div className="flex-grow" />
        <div className="flex items-center gap-2.5 pt-2">
          {p.owned ? (
            <><span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: T.teal }}><Check size={16} />Đã sở hữu</span><span className="flex-grow" /><Link to={learnTo} className="btn btn-ghost btn-sm">{p.kind === 'digital' ? 'Tải về' : 'Vào học'}</Link></>
          ) : (
            <><span className="font-bold text-[18px]">{money(p.priceMinor)}</span>{p.compareAtMinor ? <span className="muted line-through text-[13px]">{money(p.compareAtMinor)}</span> : null}<span className="flex-grow" /><Link to={`/${slug}/thanh-toan?product=${p.id}`} className="btn btn-primary btn-sm">Mua</Link></>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const slug = shell.community.slug;
  const [kind, setKind] = useState<Kind>('all');
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['products', shell.community.id, kind, q], queryFn: () => api.get<ProductList>(`/v1/communities/${shell.community.id}/products?${new URLSearchParams({ ...(kind === 'all' ? {} : { kind }), ...(q ? { q } : {}) })}`) });
  const counts = query.data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div><h1 className="serif m-0 text-[28px] font-bold">Cửa hàng</h1><div className="muted text-[13px]">Sản phẩm số · truy cập trọn đời</div></div>
        <span className="flex-grow" />
        <div className="flex gap-2 flex-wrap">
          <Chip on={kind === 'all'} onClick={() => setKind('all')}>Tất cả · {total}</Chip>
          {(['course', 'bundle', 'digital'] as const).map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]} · {counts[k] ?? 0}</Chip>)}
        </div>
        <div className="input" style={{ width: 200 }}><Search size={18} style={{ color: T.ink3 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sản phẩm…" className="flex-grow min-w-0" /></div>
        {query.data?.canManage && <Link to={`/${slug}/khoa-hoc/moi`} className="btn btn-primary btn-sm" style={{ height: 36 }}><Plus size={16} /> Tạo khóa học bán</Link>}
      </div>
      <QueryState q={query} rows={3} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có sản phẩm', hint: 'Chủ hội đăng khóa học ở chế độ bán lẻ thì sản phẩm sẽ hiện ở đây' }}>
        {(d) => <div className="grid-3">{d.items.map((p) => <ProductCard key={p.id} p={p} slug={slug} />)}</div>}
      </QueryState>
    </div>
  );
}
