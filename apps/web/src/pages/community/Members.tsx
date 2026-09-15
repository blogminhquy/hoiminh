// Thành viên: quản trị (bộ lọc 5 trạng thái, tìm, xuất CSV, mời, bảng + modal 4 tab) hoặc danh bạ cho thành viên thường.
import { useInfiniteQuery } from '@tanstack/react-query';
import { Avatar, Button, Chip, Empty, ErrorBox, Select, T, Tag } from '@hoiminh/ui';
import { Download, ListFilter, MessageCircle, Plus, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { InviteModal } from '@/components/InviteModal';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage, tokens } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { fmtDate, timeAgo } from '@/lib/format';
import { Directory, MessageModal, type MemberUser } from './MembersExtra';
import { MemberModal, tierTone } from './MembersParts';

export interface MemberRow { id: string; role: string; status: string; joinedAt: string; lastActiveAt: string | null; lifetimeValueCents: number; source: string; user: MemberUser; tier: { key: string; name: string } | null }
interface MembersPage { items: MemberRow[]; nextCursor: string | null; counts: Record<string, number> }

const STATUSES: Array<[string, string]> = [['active', 'Đang hoạt động'], ['pending', 'Chờ duyệt'], ['cancelling', 'Đang hủy'], ['churned', 'Đã rời'], ['banned', 'Bị chặn']];
const GRID = { display: 'grid', gridTemplateColumns: '1.9fr 1fr 1fr 1fr 1.5fr', gap: 16, alignItems: 'center', minWidth: 760 } as const;

export default function Page() {
  const shell = useShell();
  const can = useCan();
  if (!can('member.manage')) return <Directory communityId={shell.community.id} />;
  return <ManageMembers communityId={shell.community.id} slug={shell.community.slug} />;
}

function ManageMembers({ communityId, slug }: { communityId: string; slug: string }) {
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState({ tierKey: '', role: '', source: '' });
  const [filterOpen, setFilterOpen] = useState(false);
  const [invite, setInvite] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgTo, setMsgTo] = useState<MemberUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const params = new URLSearchParams({ status, limit: '30' });
  if (q.trim()) params.set('q', q.trim());
  for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
  const query = useInfiniteQuery({
    queryKey: ['members', communityId, params.toString()],
    queryFn: ({ pageParam }) => api.get<MembersPage>(`/v1/communities/${communityId}/members?${params.toString()}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const counts = query.data?.pages[0]?.counts ?? {};
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${api.url}/v1/communities/${communityId}/members/export.csv?status=${status}`, { headers: { Authorization: `Bearer ${tokens.access ?? ''}` } });
      if (!res.ok) throw new Error('Không xuất được CSV');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `thanh-vien-${status}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { window.alert(errorMessage(err)); } finally { setExporting(false); }
  };
  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-bold page-title">Thành viên</h1>
        <div className="flex gap-2 md:ml-3 flex-wrap">
          {STATUSES.map(([k, label]) => <Chip key={k} on={status === k} onClick={() => setStatus(k)}>{label} · {counts[k] ?? 0}</Chip>)}
        </div>
        <span className="flex-grow" />
        <div className="relative">
          <Button icon={<ListFilter size={18} />} onClick={() => setFilterOpen((v) => !v)}>Lọc</Button>
          {filterOpen && (
            <div className="card absolute right-0 top-11 z-20 p-4 flex flex-col gap-3" style={{ width: 260, boxShadow: '0 12px 32px rgba(31,27,23,0.15)' }}>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">Gói<Select value={filter.tierKey} onChange={(e) => setFilter({ ...filter, tierKey: e.target.value })}><option value="">Tất cả</option><option value="standard">Tiêu chuẩn</option><option value="premium">Premium</option><option value="vip">VIP</option></Select></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">Vai trò<Select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}><option value="">Tất cả</option><option value="owner">Chủ hội</option><option value="admin">Quản trị</option><option value="moderator">Điều phối</option><option value="member">Thành viên</option></Select></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">Nguồn<Select value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}><option value="">Tất cả</option><option value="direct">Trực tiếp</option><option value="invite">Lời mời</option><option value="affiliate">Cộng sự giới thiệu</option><option value="discovery">Khám phá</option></Select></label>
              <div className="flex gap-2"><Button size="sm" onClick={() => setFilter({ tierKey: '', role: '', source: '' })}>Bỏ lọc</Button><Button size="sm" variant="dark" onClick={() => setFilterOpen(false)}>Xong</Button></div>
            </div>
          )}
        </div>
        <Button icon={<Download size={18} />} loading={exporting} onClick={() => void exportCsv()}>Xuất CSV</Button>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setInvite(true)}>Mời</Button>
      </div>
      <label className="input" style={{ maxWidth: 380 }}><Search size={18} style={{ color: T.ink3 }} /><input placeholder="Tìm theo tên, email, @tên…" value={q} onChange={(e) => setQ(e.target.value)} /></label>

      {query.isLoading ? <LoadingBlock rows={3} /> : query.isError ? <ErrorBox message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : rows.length === 0 ? <Empty title="Không có thành viên nào" hint="Thử đổi trạng thái hoặc bỏ bộ lọc" /> : (
        <div className="card overflow-hidden">
          <div className="table-scroll">
            <div style={{ ...GRID, padding: '12px 20px' }}><span className="th">Thành viên</span><span className="th">Gói</span><span className="th">Tham gia</span><span className="th">Hoạt động</span><span /></div>
            {rows.map((m) => (
              <div key={m.id} style={{ ...GRID, padding: '12px 20px', borderTop: `1px solid ${T.line}` }}>
                <button type="button" className="flex items-center gap-3 text-left min-w-0" onClick={() => setOpenId(m.id)}>
                  <Avatar name={m.user.name} src={m.user.avatarUrl} color={m.user.coverColor} size={36} />
                  <span className="min-w-0"><span className="block font-semibold truncate">{m.user.name}</span><span className="block muted text-[12px] truncate">@{m.user.handle}</span></span>
                </button>
                <span><Tag tone={tierTone(m.tier?.key)}>{m.role === 'owner' ? 'Chủ hội' : m.role === 'admin' ? 'Quản trị' : m.tier?.name ?? 'Miễn phí'}</Tag></span>
                <span className="text-[13px]" style={{ color: T.ink2 }}>{fmtDate(m.joinedAt)}</span>
                <span className="text-[13px]" style={{ color: T.ink2 }}>{m.lastActiveAt ? timeAgo(m.lastActiveAt) : '—'}</span>
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" icon={<MessageCircle size={14} />} onClick={() => setMsgTo(m.user)}>Nhắn tin</Button>
                  <Button size="sm" icon={<Settings size={14} />} onClick={() => setOpenId(m.id)}>Quản lý</Button>
                </div>
              </div>
            ))}
          </div>
          {query.hasNextPage && <div className="p-3 flex justify-center" style={{ borderTop: `1px solid ${T.line}` }}><Button size="sm" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Tải thêm</Button></div>}
        </div>
      )}

      <InviteModal open={invite} onClose={() => setInvite(false)} communityId={communityId} slug={slug} canInvite />
      <MessageModal open={Boolean(msgTo)} onClose={() => setMsgTo(null)} communityId={communityId} user={msgTo} />
      {openId && <MemberModal communityId={communityId} memberId={openId} onClose={() => setOpenId(null)} onMessage={(u) => { setOpenId(null); setMsgTo(u); }} />}
    </div>
  );
}
