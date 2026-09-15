// Hệ thống · Nhật ký và webhook: tab nhật ký thao tác (ai, hành động, tài nguyên) và sự kiện webhook (cổng, loại, chữ ký, trạng thái, lỗi).
import { useQuery } from '@tanstack/react-query';
import { Chip, StatusTag, T } from '@hoiminh/ui';
import { useState } from 'react';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

interface Audit { id: string; action: string; resourceType: string; resourceId: string | null; actorType: string; metadata: Record<string, unknown> | null; createdAt: string; actor: { name: string; email: string } | null; communityId: string | null }
interface Webhook { id: string; provider: string; providerEventId: string; eventType: string; signatureVerified: boolean; processingStatus: string; error: string | null; paymentId: string | null; processedAt: string | null; createdAt: string }
interface Logs { audit: Audit[]; webhooks: Webhook[] }
type Kind = 'audit' | 'webhook';
const PROVIDER: Record<string, string> = { sepay: 'SePay', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal' };

export default function Page() {
  const [kind, setKind] = useState<Kind>('audit');
  const q = useQuery({ queryKey: ['admin', 'logs', kind], queryFn: () => api.get<Logs>(`/v1/admin/logs?kind=${kind}&limit=100`), refetchInterval: 60_000 });
  const auditCols = '150px 1.4fr 1.4fr 1.6fr 2fr';
  const hookCols = '150px 90px 1.4fr 1.4fr 100px 1fr 2fr';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Nhật ký và webhook</h1>
        <div className="flex gap-2 md:ml-3"><Chip on={kind === 'audit'} onClick={() => setKind('audit')}>Nhật ký thao tác</Chip><Chip on={kind === 'webhook'} onClick={() => setKind('webhook')}>Webhook thanh toán</Chip></div>
        <span className="flex-grow" />
        <span className="muted text-[12px]">Tự làm mới mỗi phút · 100 dòng gần nhất</span>
      </div>
      <QueryState q={q} rows={6} isEmpty={(d) => (kind === 'audit' ? d.audit.length === 0 : d.webhooks.length === 0)} empty={{ title: 'Chưa có bản ghi' }}>
        {(d) => kind === 'audit' ? (
          <div className="card overflow-hidden table-scroll">
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: auditCols, minWidth: 900 }}>{['Thời gian', 'Người thực hiện', 'Hành động', 'Tài nguyên', 'Chi tiết'].map((h) => <span key={h} className="th">{h}</span>)}</div>
            {d.audit.map((a) => <div key={a.id} className="grid gap-3 items-start px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: auditCols, minWidth: 900, borderTop: `1px solid ${T.line}` }}><span className="muted">{fmtDateTime(a.createdAt)}</span><div className="min-w-0"><div className="font-medium truncate">{a.actor?.name ?? (a.actorType === 'system' ? 'Hệ thống' : a.actorType)}</div>{a.actor?.email && <div className="muted text-[12px] truncate">{a.actor.email}</div>}</div><code className="text-[12px]" style={{ color: T.accentText }}>{a.action}</code><span className="muted truncate">{a.resourceType}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}` : ''}</span><code className="text-[11px] truncate" style={{ color: T.ink2 }}>{a.metadata ? JSON.stringify(a.metadata).slice(0, 140) : ''}</code></div>)}
          </div>
        ) : (
          <div className="card overflow-hidden table-scroll">
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: hookCols, minWidth: 1000 }}>{['Thời gian', 'Cổng', 'Sự kiện', 'Mã cổng', 'Chữ ký', 'Trạng thái', 'Lỗi'].map((h) => <span key={h} className="th">{h}</span>)}</div>
            {d.webhooks.map((w) => <div key={w.id} className="grid gap-3 items-center px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: hookCols, minWidth: 1000, borderTop: `1px solid ${T.line}` }}><span className="muted">{fmtDateTime(w.createdAt)}</span><span className="font-semibold">{PROVIDER[w.provider] ?? w.provider}</span><span className="truncate">{w.eventType}</span><code className="text-[12px] truncate">{w.providerEventId}</code><span className="font-semibold" style={{ color: w.signatureVerified ? T.teal : T.accentText }}>{w.signatureVerified ? 'Hợp lệ' : 'Sai'}</span><StatusTag status={w.processingStatus === 'processed' ? 'succeeded' : w.processingStatus} /><span className="muted truncate" title={w.error ?? ''}>{w.error ?? '—'}</span></div>)}
          </div>
        )}
      </QueryState>
    </div>
  );
}
