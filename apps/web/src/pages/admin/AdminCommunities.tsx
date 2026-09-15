// Hệ thống · Hội (saCommunitiesMain): chip trạng thái, tìm kiếm, bảng hội (chủ hội, gói, thành viên, GMV 30 ngày, trạng thái) + khóa/mở/lưu trữ.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, CommunityMark, T, money } from '@hoiminh/ui';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { saveBlob, toCsvBlob } from '@/lib/download';
import { daysUntil, fmtCount } from '@/lib/format';

interface Row { id: string; name: string; slug: string; logoMark: string; logoColor: string; logoUrl: string | null; status: string; memberCount: number; lockedReason: string | null; owner: { id: string; name: string; email: string }; workspaceStatus: string; trialEndsAt: string | null; gmv30Minor: number; planCycle: string | null }
interface List { items: Row[]; counts: Record<string, number> }
type Status = 'active' | 'draft' | 'archived' | 'locked';
const STATUSES: Array<[Status, string]> = [['active', 'Hoạt động'], ['draft', 'Nháp'], ['archived', 'Lưu trữ'], ['locked', 'Bị khóa']];

function planOf(r: Row): string { return r.planCycle === 'yearly' ? 'Năm' : r.planCycle === 'monthly' ? 'Tháng' : 'Dùng thử'; }
function stateOf(r: Row): [string, string] {
  if (r.status === 'locked') return ['Đã khóa', T.accentText];
  if (r.lockedReason) return ['Bị báo cáo', T.accentText];
  if (r.status === 'archived') return ['Lưu trữ', T.ink3];
  if (r.status === 'draft') return ['Nháp', T.ink3];
  const d = r.planCycle ? null : daysUntil(r.trialEndsAt);
  if (d !== null && d <= 3) return [d < 0 ? 'Hết dùng thử' : `Còn ${d} ngày thử`, T.goldText];
  return ['Hoạt động', T.teal];
}

export default function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('active');
  // Nhận từ khóa từ ô tìm nhanh trên header quản trị (?q=...).
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const list = useQuery({ queryKey: ['admin', 'communities', status, q], queryFn: () => api.get<List>(`/v1/admin/communities?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`) });
  const act = useMutation({ mutationFn: (p: { id: string; action: 'lock' | 'unlock' | 'archive'; reason: string }) => api.post(`/v1/admin/communities/${p.id}/action`, { action: p.action, reason: p.reason }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] }) });
  const doAct = (r: Row, action: 'lock' | 'unlock' | 'archive') => { const reason = action === 'unlock' ? '' : window.prompt(action === 'lock' ? 'Lý do khóa hội:' : 'Lý do lưu trữ:') ?? ''; if (action !== 'unlock' && !reason) return; act.mutate({ id: r.id, action, reason }); };
  const cols = '2.2fr 1.4fr 0.8fr 0.9fr 1.1fr 1fr 1.6fr';
  const exportCsv = () => { const rows = list.data?.items ?? []; saveBlob(toCsvBlob([['Hội', 'Đường dẫn', 'Chủ hội', 'Email', 'Gói', 'Thành viên', 'GMV 30 ngày', 'Trạng thái'], ...rows.map((r) => [r.name, r.slug, r.owner.name, r.owner.email, planOf(r), String(r.memberCount), String(r.gmv30Minor), stateOf(r)[0]])]), `hoi-${status}.csv`); };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Hội</h1>
        <div className="flex gap-2 flex-wrap md:ml-3">{STATUSES.map(([k, l]) => <Chip key={k} on={status === k} onClick={() => setStatus(k)}>{l} · {list.data?.counts[k] ?? 0}</Chip>)}</div>
        <span className="flex-grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!list.data}><Download size={14} />Xuất CSV</button>
      </div>
      <div className="input" style={{ width: 380, maxWidth: '100%' }}><Search size={18} style={{ color: T.ink3 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hội, đường dẫn, chủ hội…" className="flex-grow min-w-0" /></div>
      {act.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(act.error)}</div>}
      <QueryState q={list} rows={5} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Không có hội nào', hint: 'Đổi bộ lọc hoặc từ khóa' }}>
        {(d) => (
          <div className="card overflow-hidden table-scroll">
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 960 }}>{['Hội', 'Chủ hội', 'Gói', 'Thành viên', 'GMV 30 ngày', 'Trạng thái', ''].map((h, i) => <span key={i} className="th">{h}</span>)}</div>
            {d.items.map((r) => { const [st, color] = stateOf(r); const plan = planOf(r); return (
              <div key={r.id} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 960, borderTop: `1px solid ${T.line}` }}>
                <div className="flex items-center gap-2.5 min-w-0"><CommunityMark mark={r.logoMark} color={r.logoColor} url={r.logoUrl} size={34} radius={9} /><div className="min-w-0"><div className="font-semibold truncate">{r.name}</div><div className="muted text-[12px] truncate">hoiminh.vn/{r.slug}</div></div></div>
                <span className="truncate">{r.owner.name}</span>
                <span className="tag" style={{ background: plan === 'Dùng thử' ? T.bg : T.goldSoft, color: plan === 'Dùng thử' ? T.ink2 : T.goldText, width: 'fit-content' }}>{plan}</span>
                <span>{fmtCount(r.memberCount)}</span>
                <span className="font-semibold">{money(r.gmv30Minor)}</span>
                <span className="font-semibold" style={{ color }}>{st}</span>
                <div className="flex gap-1.5 justify-end flex-wrap">
                  <Link to={`/${r.slug}`} className="btn btn-ghost btn-sm">Xem</Link>
                  {r.status === 'locked' ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => doAct(r, 'unlock')}>Mở khóa</button> : r.status !== 'archived' && <button type="button" className="btn btn-ghost btn-sm" style={{ color: T.accentText }} onClick={() => doAct(r, 'lock')}>Khóa</button>}
                  {r.status !== 'archived' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => doAct(r, 'archive')}>Lưu trữ</button>}
                </div>
              </div>
            ); })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
