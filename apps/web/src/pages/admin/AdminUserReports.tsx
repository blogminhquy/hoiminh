// Hệ thống · Báo cáo người dùng: các báo cáo gửi từ khung chat (ai báo ai, lý do, mô tả), đánh dấu đã xử lý.
// Khóa tài khoản làm ở trang Người dùng: mỗi dòng có lối tắt mở đúng người bị báo cáo ở đó.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, T } from '@hoiminh/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

interface Who { id: string; name: string; email: string; handle: string; status?: string }
interface Row { id: string; reason: string; reasonLabel: string; detail: string; status: 'open' | 'resolved'; createdAt: string; resolvedAt: string | null; reporter: Who; reported: Who }
interface List { items: Row[]; open: number }

export default function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const list = useQuery({ queryKey: ['admin', 'user-reports', status], queryFn: () => api.get<List>(`/v1/admin/user-reports?status=${status}`) });
  const resolve = useMutation({ mutationFn: (id: string) => api.post(`/v1/admin/user-reports/${id}/resolve`, {}), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'user-reports'] }) });
  const cols = '1.1fr 1.6fr 1.6fr 1.2fr 2.4fr 1.5fr';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Báo cáo người dùng</h1>
        <div className="flex gap-2 md:ml-3">
          <Chip on={status === 'open'} onClick={() => setStatus('open')}>Chờ xử lý{list.data ? ` · ${list.data.open}` : ''}</Chip>
          <Chip on={status === 'resolved'} onClick={() => setStatus('resolved')}>Đã xử lý</Chip>
        </div>
      </div>
      {resolve.isError && <div className="text-[14px]" role="alert" style={{ color: T.accentText }}>{errorMessage(resolve.error)}</div>}
      <QueryState q={list} rows={4} isEmpty={(d) => d.items.length === 0} empty={status === 'open' ? { title: 'Không có báo cáo nào chờ xử lý', hint: 'Báo cáo thành viên gửi từ khung chat (menu ba chấm, Báo cáo) sẽ hiện ở đây' } : { title: 'Chưa có báo cáo nào đã xử lý' }}>
        {(d) => (
          <div className="card overflow-hidden table-scroll">
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 1040 }}>{['Lúc', 'Người báo cáo', 'Người bị báo cáo', 'Lý do', 'Mô tả', ''].map((h, i) => <span key={i} className="th">{h}</span>)}</div>
            {d.items.map((r) => (
              <div key={r.id} className="grid gap-3 items-start px-5 py-3 text-[14px]" style={{ gridTemplateColumns: cols, minWidth: 1040, borderTop: `1px solid ${T.line}` }}>
                <span className="muted">{fmtDateTime(r.createdAt)}</span>
                <div className="min-w-0"><div className="font-semibold truncate">{r.reporter.name}</div><div className="muted truncate">{r.reporter.email}</div></div>
                <div className="min-w-0"><div className="font-semibold truncate">{r.reported.name}{r.reported.status === 'suspended' ? ' (đang tạm khóa)' : ''}</div><div className="muted truncate">{r.reported.email}</div></div>
                <span className="font-semibold">{r.reasonLabel}</span>
                <span style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{r.detail || <span className="muted">Không có mô tả</span>}</span>
                <div className="flex gap-1.5 justify-end flex-wrap">
                  <Link to={`/he-thong/nguoi-dung?q=${encodeURIComponent(r.reported.email)}`} className="btn btn-ghost btn-sm">Xem người bị báo cáo</Link>
                  {r.status === 'open' && <button type="button" className="btn btn-primary btn-sm" disabled={resolve.isPending} onClick={() => resolve.mutate(r.id)}>Đã xử lý</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
