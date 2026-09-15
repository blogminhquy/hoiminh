// Mảnh Hệ thống · Thanh toán: dòng cổng (providerRow) với bật/tắt, mode, credential; bảng đối soát với ghép thủ công; bảng giao dịch.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Modal, Select, StatusTag, T, Toggle, money } from '@hoiminh/ui';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtTime, timeAgo } from '@/lib/format';

export interface Provider { provider: 'sepay' | 'momo' | 'vnpay' | 'paypal'; enabled: boolean; mode: 'sandbox' | 'production'; health: string; lastHealthAt: string | null; consecutiveFailures: number; webhooksThisMonth: number; webhookFailuresThisMonth: number; lastWebhookAt: string | null; hasCredentials: boolean }
export interface ReconItem { id: string; provider: string; bankContent: string | null; bankAccount: string | null; referenceCode: string | null; amountMinor: number; expectedMinor: number | null; status: string; note: string | null; transactionAt: string; matchedAt: string | null }
export interface Payment { id: string; provider: string; amountMinor: number; status: string; paymentMethod: string | null; reference: string; paidAt: string | null; createdAt: string; order: { status: string; title: string; targetType: string }; customer: { name: string; email: string }; community: { name: string; slug: string } | null }

const META: Record<Provider['provider'], { name: string; bg: string; fields: string[] }> = {
  sepay: { name: 'SePay', bg: T.ink, fields: ['apiKey', 'bankCode', 'bankAccount', 'accountHolder'] },
  momo: { name: 'MoMo', bg: '#A50064', fields: ['partnerCode', 'accessKey', 'secretKey'] },
  vnpay: { name: 'VNPAY', bg: '#0A5EB0', fields: ['tmnCode', 'hashSecret'] },
  paypal: { name: 'PayPal', bg: '#003087', fields: ['clientId', 'clientSecret', 'webhookId'] },
};

function CredentialModal({ p, onClose }: { p: Provider; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(p.mode);
  const [cred, setCred] = useState<Record<string, string>>({});
  const m = useMutation({ mutationFn: () => api.patch(`/v1/admin/providers/${p.provider}`, { mode, ...(Object.keys(cred).length ? { credentials: cred } : {}) }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'providers'] }); onClose(); } });
  return (
    <Modal open onClose={onClose} title={`Cấu hình ${META[p.provider].name}`} width={520}>
      <div className="p-5 flex flex-col gap-3">
        <Field label="Chế độ"><Select value={mode} onChange={(e) => setMode(e.target.value as 'sandbox')}><option value="sandbox">Sandbox</option><option value="production">Production</option></Select></Field>
        {META[p.provider].fields.map((f) => <Field key={f} label={f}><Input type={/secret|key/i.test(f) ? 'password' : 'text'} value={cred[f] ?? ''} onChange={(e) => setCred({ ...cred, [f]: e.target.value })} placeholder={p.hasCredentials ? 'Để trống để giữ nguyên' : ''} /></Field>)}
        <span className="muted text-[12px]">Bí mật được mã hóa khi lưu và không hiện lại.</span>
        {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
        <div className="flex justify-end gap-2"><Button size="sm" onClick={onClose}>Hủy</Button><Button size="sm" variant="dark" loading={m.isPending} onClick={() => m.mutate()}>Lưu</Button></div>
      </div>
    </Modal>
  );
}

export function ProviderRow({ p }: { p: Provider }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const toggle = useMutation({ mutationFn: (enabled: boolean) => api.patch(`/v1/admin/providers/${p.provider}`, { enabled }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'providers'] }) });
  const meta = META[p.provider];
  const healthOk = p.consecutiveFailures === 0 && p.webhookFailuresThisMonth === 0;
  const health = !p.enabled ? 'Chưa bật' : healthOk ? `OK${p.lastWebhookAt ? ` · ${timeAgo(p.lastWebhookAt, true)}` : ''}` : `Lỗi · ${p.webhookFailuresThisMonth || p.consecutiveFailures} lần`;
  return (
    <div className="flex items-center gap-3.5 py-3.5 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
      <span className="w-11 h-[30px] rounded-md inline-flex items-center justify-center text-[9px] font-extrabold serif" style={{ background: meta.bg, color: T.surface }}>{meta.name.slice(0, 5)}</span>
      <div className="flex-grow min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{meta.name}</span><span className="tag" style={{ background: p.mode === 'production' ? T.tealSoft : T.goldSoft, color: p.mode === 'production' ? T.tealText : T.goldText }}>{p.mode === 'production' ? 'Production' : 'Sandbox'}</span>{!p.hasCredentials && <span className="tag" style={{ background: T.bg, color: T.ink3 }}>Chưa có credential</span>}</div><div className="muted text-[12px]">Webhook nhận {p.webhooksThisMonth} sự kiện tháng này · lỗi {p.webhookFailuresThisMonth}</div></div>
      <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: !p.enabled ? T.ink3 : healthOk ? T.teal : T.accentText }}>{health}</span>
      <Button size="sm" onClick={() => setOpen(true)}>Cấu hình</Button>
      <Toggle on={p.enabled} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
      {open && <CredentialModal p={p} onClose={() => setOpen(false)} />}
    </div>
  );
}

const RECON_LABEL: Record<string, [string, string]> = { matched: ['Đã khớp', T.teal], wrong_content: ['Sai nội dung', T.goldText], missing_code: ['Thiếu mã', T.goldText], amount_mismatch: ['Lệch số tiền', T.accentText], duplicate: ['Trùng', T.accentText], unmatched: ['Chưa khớp', T.goldText], manual_review: ['Cần xem', T.goldText] };

export function ReconRow({ it, onMatched }: { it: ReconItem; onMatched: () => void }) {
  const [ref, setRef] = useState(it.referenceCode ?? '');
  const [editing, setEditing] = useState(false);
  const m = useMutation({ mutationFn: () => api.post(`/v1/admin/reconciliation/${it.id}/match`, { paymentReference: ref.trim().toUpperCase() }), onSuccess: () => { setEditing(false); onMatched(); } });
  const [label, color] = RECON_LABEL[it.status] ?? [it.status, T.ink2];
  const cols = '90px 1.1fr 1.6fr 1fr 1fr 1.2fr 1.4fr';
  return (
    <div className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 900, borderTop: `1px solid ${T.line}` }}>
      <span className="muted" title={fmtDateTime(it.transactionAt)}>{fmtTime(it.transactionAt)}</span>
      <span className="font-bold" style={{ color: T.accent }}>{it.referenceCode ?? '—'}</span>
      <span className="truncate" title={it.bankContent ?? ''}>{it.bankContent ?? '—'}</span>
      <span className="font-semibold">{money(it.amountMinor)}</span>
      <span className="muted">{it.expectedMinor === null ? '—' : money(it.expectedMinor)}</span>
      <span className="font-semibold" style={{ color }}>{label}</span>
      {it.status === 'matched' ? <span className="muted text-[12px]">{it.matchedAt ? `Khớp ${timeAgo(it.matchedAt, true)}` : ''}</span> : editing ? (
        <div className="flex gap-1.5 items-center"><div className="input" style={{ height: 32, fontSize: 12 }}><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="HM XXXXX" className="w-[100px]" /></div><Button size="sm" variant="dark" loading={m.isPending} disabled={ref.trim().length < 4} onClick={() => m.mutate()}>Ghép</Button><Button size="sm" onClick={() => setEditing(false)}>Hủy</Button>{m.isError && <span className="text-[12px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}</div>
      ) : (
        <Button size="sm" onClick={() => setEditing(true)} style={{ width: 'fit-content' }}>{it.status === 'amount_mismatch' ? 'Ghép / liên hệ khách' : 'Ghép thủ công'}</Button>
      )}
    </div>
  );
}

export function PaymentsTable({ rows }: { rows: Payment[] }) {
  const cols = '110px 1.6fr 1.6fr 1fr 1fr 1fr 1fr';
  return (
    <div className="card overflow-hidden table-scroll">
      <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 960 }}>{['Thời gian', 'Khách', 'Nội dung', 'Hội', 'Cổng', 'Số tiền', 'Trạng thái'].map((h) => <span key={h} className="th">{h}</span>)}</div>
      {rows.length === 0 && <div className="muted text-[13px] text-center py-6">Chưa có giao dịch</div>}
      {rows.map((p) => <div key={p.id} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 960, borderTop: `1px solid ${T.line}` }}><span className="muted">{fmtDateTime(p.paidAt ?? p.createdAt)}</span><div className="min-w-0"><div className="font-medium truncate">{p.customer.name}</div><div className="muted text-[12px] truncate">{p.customer.email}</div></div><span className="truncate">{p.order.title} <span className="muted">· {p.reference}</span></span><span className="truncate muted">{p.community?.name ?? 'Nền tảng'}</span><span className="muted">{META[p.provider as Provider['provider']]?.name ?? p.provider}</span><span className="font-semibold">{money(p.amountMinor)}</span><StatusTag status={p.status} /></div>)}
    </div>
  );
}
