// Hệ thống · Người dùng: tìm kiếm, bảng người dùng (hội tham gia, hội làm chủ, đã chi), tạm khóa / kích hoạt / cấp super admin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Chip, T, money } from '@hoiminh/ui';
import { Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, timeAgo } from '@/lib/format';

interface Row { id: string; name: string; email: string; handle: string; status: string; isSuperAdmin: boolean; avatarUrl: string | null; coverColor: string | null; createdAt: string; lastSeenAt: string | null; memberships: number; ownedWorkspaces: number; spentMinor: number }
interface List { items: Row[]; total: number }
type Action = 'suspend' | 'activate' | 'make_super_admin' | 'remove_super_admin';

export default function Page() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  // Nhận từ khóa từ ô tìm nhanh trên header quản trị (?q=...).
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const list = useQuery({ queryKey: ['admin', 'users', status, q], queryFn: () => api.get<List>(`/v1/admin/users?${new URLSearchParams({ ...(status === 'all' ? {} : { status }), ...(q ? { q } : {}) })}`) });
  const act = useMutation({ mutationFn: (p: { id: string; action: Action; reason: string }) => api.post(`/v1/admin/users/${p.id}/action`, { action: p.action, reason: p.reason }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }) });
  const run = (r: Row, action: Action) => { const reason = action === 'suspend' ? window.prompt('Lý do tạm khóa:') ?? '' : ''; if (action === 'suspend' && !reason) return; if (action.includes('super_admin') && !window.confirm('Xác nhận đổi quyền super admin?')) return; act.mutate({ id: r.id, action, reason }); };
  const cols = '2.2fr 1.6fr 0.8fr 0.8fr 1fr 1fr 1.8fr';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Người dùng</h1>
        <div className="flex gap-2 md:ml-3"><Chip on={status === 'all'} onClick={() => setStatus('all')}>Tất cả{list.data ? ` · ${list.data.total}` : ''}</Chip><Chip on={status === 'active'} onClick={() => setStatus('active')}>Hoạt động</Chip><Chip on={status === 'suspended'} onClick={() => setStatus('suspended')}>Tạm khóa</Chip></div>
        <span className="flex-grow" />
        <div className="input" style={{ width: 320, maxWidth: '100%' }}><Search size={18} style={{ color: T.ink3 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, email, handle…" className="flex-grow min-w-0" /></div>
      </div>
      {act.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(act.error)}</div>}
      <QueryState q={list} rows={5} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Không tìm thấy người dùng' }}>
        {(d) => (
          <div className="card overflow-hidden table-scroll">
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 980 }}>{['Người dùng', 'Email', 'Hội', 'Làm chủ', 'Đã chi', 'Hoạt động', ''].map((h, i) => <span key={i} className="th">{h}</span>)}</div>
            {d.items.map((r) => (
              <div key={r.id} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 980, borderTop: `1px solid ${T.line}`, opacity: r.status === 'suspended' ? 0.6 : 1 }}>
                <div className="flex items-center gap-2.5 min-w-0"><Avatar name={r.name} src={r.avatarUrl} color={r.coverColor ?? T.ink} size={34} /><div className="min-w-0"><div className="font-semibold truncate flex items-center gap-1.5">{r.name}{r.isSuperAdmin && <span title="Super admin" style={{ color: T.teal }}><ShieldCheck size={14} /></span>}</div><div className="muted text-[12px] truncate">@{r.handle} · từ {fmtDate(r.createdAt)}</div></div></div>
                <span className="truncate muted">{r.email}</span>
                <span>{r.memberships}</span>
                <span>{r.ownedWorkspaces}</span>
                <span className="font-semibold">{money(r.spentMinor)}</span>
                <span className="muted">{r.lastSeenAt ? timeAgo(r.lastSeenAt, true) : '—'}</span>
                <div className="flex gap-1.5 justify-end flex-wrap">
                  <Link to={`/u/${r.handle}`} className="btn btn-ghost btn-sm">Hồ sơ</Link>
                  {r.id !== me?.id && (r.status === 'suspended' ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(r, 'activate')}>Kích hoạt</button> : <button type="button" className="btn btn-ghost btn-sm" style={{ color: T.accentText }} onClick={() => run(r, 'suspend')}>Tạm khóa</button>)}
                  {r.id !== me?.id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(r, r.isSuperAdmin ? 'remove_super_admin' : 'make_super_admin')}>{r.isSuperAdmin ? 'Bỏ admin' : 'Cấp admin'}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
