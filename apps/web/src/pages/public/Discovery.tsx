// Khám phá (discoveryBody trong build.mjs): hero + ô tìm kiếm, chip danh mục, lưới thẻ hội từ /v1/communities/discover.
import { COMMUNITY_CATEGORY_LABELS } from '@hoiminh/contracts';
import { useQuery } from '@tanstack/react-query';
import { Chip, CommunityMark, T } from '@hoiminh/ui';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { PublicHeader } from '@/layouts/PublicHeader';
import { api } from '@/lib/api';
import { fmtCount } from '@/lib/format';

export interface DiscoverCommunity {
  id: string; name: string; slug: string; shortDescription: string; category: string; logoMark: string; logoColor: string; coverColor: string; coverUrl: string | null; memberCount: number; pricingMode: string; priceLabel: string; activity7d: number;
}

const CATEGORIES = Object.entries(COMMUNITY_CATEGORY_LABELS) as Array<[string, string]>;

export function useDiscover(category: string | null, q: string, limit?: number) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (q) qs.set('q', q);
  if (limit) qs.set('limit', String(limit));
  const s = qs.toString();
  return useQuery({ queryKey: ['discover', category, q, limit ?? null], queryFn: () => api.get<DiscoverCommunity[]>(`/v1/communities/discover${s ? `?${s}` : ''}`), staleTime: 60_000 });
}

function CommCard({ c }: { c: DiscoverCommunity }) {
  return (
    <Link to={`/${c.slug}`} className="card overflow-hidden flex flex-col" style={{ color: T.ink }}>
      <div style={{ height: 150, background: c.coverUrl ? `url(${c.coverUrl}) center/cover` : c.coverColor }} />
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <CommunityMark mark={c.logoMark} color={T.ink} size={36} radius={10} />
          <span className="font-semibold text-[16px] truncate">{c.name}</span>
        </div>
        <div className="text-[13px]" style={{ color: T.ink2 }}>{c.shortDescription || 'Chưa có mô tả'}</div>
        <div className="muted text-[13px] pt-1">{fmtCount(c.memberCount)} thành viên · {c.priceLabel}</div>
      </div>
    </Link>
  );
}

export default function Page() {
  const [params, setParams] = useSearchParams();
  const category = params.get('danh-muc');
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const list = useDiscover(category, q);

  const setCategory = (key: string | null) => {
    const next = new URLSearchParams(params);
    if (key) next.set('danh-muc', key); else next.delete('danh-muc');
    setParams(next);
  };
  const search = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (draft.trim()) next.set('q', draft.trim()); else next.delete('q');
    setParams(next);
  };
  const title = category ? (COMMUNITY_CATEGORY_LABELS[category as keyof typeof COMMUNITY_CATEGORY_LABELS] ?? 'Cộng đồng') : q ? `Kết quả cho “${q}”` : 'Cộng đồng nổi bật';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <PublicHeader cta="create" />
      <section className="flex flex-col items-center gap-5 text-center px-4 md:px-16" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <h1 className="serif m-0 font-bold leading-[1.1] text-[36px] md:text-[52px]" style={{ maxWidth: 760, textWrap: 'pretty' }}>Học cùng những người đi trước, trong hội của mình.</h1>
        <p className="m-0 text-[17px]" style={{ color: T.ink2, maxWidth: 560 }}>Cộng đồng có người dẫn dắt rõ mặt, khóa học theo lộ trình, thanh toán bằng chuyển khoản hay ví Việt Nam.</p>
        <form onSubmit={search} className="input w-full mt-2" style={{ maxWidth: 640, height: 56, borderRadius: 14, padding: '0 8px 0 18px', fontSize: 16 }}>
          <Search size={20} style={{ color: T.ink3 }} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tìm cộng đồng, chuyên gia, chủ đề…" aria-label="Tìm cộng đồng" />
          <button type="submit" className="btn btn-dark">Tìm kiếm</button>
        </form>
        <div className="flex gap-2 flex-wrap justify-center mt-2">
          <Chip on={!category} onClick={() => setCategory(null)}>Nổi bật</Chip>
          {CATEGORIES.map(([key, label]) => <Chip key={key} on={category === key} onClick={() => setCategory(key)}>{label}</Chip>)}
        </div>
      </section>
      <section className="flex flex-col gap-5 px-4 md:px-16 pb-16">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><div className="serif text-[26px] font-bold">{title}</div><div className="muted">Được chọn vì hoạt động thật và người dẫn dắt rõ ràng.</div></div>
          {(category || q) && <button type="button" className="font-semibold" style={{ color: T.teal }} onClick={() => { setDraft(''); setParams(new URLSearchParams()); }}>Xem tất cả</button>}
        </div>
        <QueryState q={list} rows={3} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có hội nào ở đây', hint: q ? 'Thử từ khóa khác hoặc xem danh mục khác.' : 'Hãy là người đầu tiên tạo hội trong danh mục này.', action: <Link to="/tao-hoi" className="btn btn-primary btn-sm">Tạo hội của bạn</Link> }}>
          {(items) => <div className="grid-3" style={{ gap: 24 }}>{items.map((c) => <CommCard key={c.id} c={c} />)}</div>}
        </QueryState>
      </section>
    </div>
  );
}
