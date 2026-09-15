// Khối con màn Nhà phát triển: bảng API key, bảng webhook gửi đi, hướng dẫn MCP.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_SCOPES, WEBHOOK_EVENTS } from '@hoiminh/contracts';
import { Button, Field, Input, T, Tag } from '@hoiminh/ui';
import { Check, Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react';
import { useState } from 'react';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

interface ApiKey { id: string; name: string; prefix: string; scopes: string[]; status: string; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }
interface CreatedKey { id: string; name: string; prefix: string; scopes: string[]; raw: string }
interface Delivery { id: string; eventName: string; status: string; attempt: number; responseStatus: number | null; createdAt: string; deliveredAt: string | null }
interface Hook { id: string; url: string; description: string; events: string[]; status: string; failureCount: number; createdAt: string; recent: Delivery[] }

/** Ô hiện bí mật một lần duy nhất kèm nút chép. */
function SecretOnce({ label, value, note }: { label: string; value: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5 rounded-xl" style={{ background: T.goldSoft, color: T.goldDark }}>
      <span className="font-semibold text-[13px]">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="px-2.5 py-1.5 rounded-md text-[12px] break-all" style={{ background: T.surface, fontFamily: 'Consolas, monospace', color: T.ink }}>{value}</code>
        <Button size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? 'Đã chép' : 'Chép'}</Button>
      </div>
      <span className="text-[12px]">{note}</span>
    </div>
  );
}

/** Chọn nhiều giá trị bằng chip. */
function ChipPicker({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onToggle(o)} className={`chip${selected.includes(o) ? ' on' : ''}`} style={{ height: 28, fontSize: 12 }}>{o}</button>
      ))}
    </div>
  );
}

export function ApiKeysCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ['api-keys', workspaceId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<ApiKey[]>(`/v1/workspaces/${workspaceId}/api-keys`) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['communities:read', 'members:read']);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<CreatedKey>(`/v1/workspaces/${workspaceId}/api-keys`, { name: name.trim(), scopes }),
    onSuccess: (d) => { setCreated(d); setOpen(false); setName(''); void qc.invalidateQueries({ queryKey: key }); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/v1/workspaces/${workspaceId}/api-keys/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const cols = '1.4fr 1fr 2fr 1fr 1fr 90px';
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-5 py-4">
        <KeyRound size={18} style={{ color: T.ink2 }} />
        <span className="font-semibold">API key</span>
        <span className="muted text-[12px]">gọi REST `/v1` bằng header `Authorization: Bearer hm_…`</span>
        <span className="flex-grow" />
        <Button size="sm" variant="dark" icon={<Plus size={14} />} onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Tạo key'}</Button>
      </div>

      {created && (
        <div className="px-5 pb-4">
          <SecretOnce label={`Key "${created.name}" đã tạo`} value={created.raw} note="Chỉ hiện một lần. Chép và cất ngay — đóng trang là không xem lại được, phải tạo key mới." />
        </div>
      )}

      {open && (
        <div className="px-5 pb-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <Field label="Tên key" hint="Đặt theo nơi dùng để sau này biết cái nào của cái gì: Zapier, n8n, trợ lý nội bộ…">
            <Input value={name} maxLength={60} placeholder="Trợ lý nội bộ" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phạm vi" hint="Chỉ cấp đúng thứ cần. Key lộ ra ngoài thì chỉ làm được những việc trong phạm vi này.">
            <ChipPicker options={API_SCOPES} selected={scopes} onToggle={(s) => setScopes((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))} />
          </Field>
          {create.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
          <div><Button variant="primary" size="sm" loading={create.isPending} disabled={name.trim().length < 2 || scopes.length === 0} onClick={() => create.mutate()}>Tạo key</Button></div>
        </div>
      )}

      <div className="table-scroll">
        <div style={{ minWidth: 820 }}>
          <div className="grid gap-3 px-5 py-2.5" style={{ gridTemplateColumns: cols, borderTop: `1px solid ${T.line}` }}>
            <span className="th">Tên</span><span className="th">Tiền tố</span><span className="th">Phạm vi</span><span className="th">Dùng lần cuối</span><span className="th">Trạng thái</span><span />
          </div>
          <QueryState q={q} rows={2} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có API key nào', hint: 'Tạo key đầu tiên để gọi REST hoặc chạy MCP.' }}>
            {(keys) => (
              <>
                {keys.map((k) => (
                  <div key={k.id} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, borderTop: `1px solid ${T.line}` }}>
                    <span className="font-semibold truncate">{k.name}</span>
                    <code className="text-[12px]" style={{ fontFamily: 'Consolas, monospace' }}>hm_…{k.prefix}</code>
                    <span className="muted text-[12px] truncate" title={k.scopes.join(', ')}>{k.scopes.join(', ')}</span>
                    <span className="muted">{k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : 'chưa dùng'}</span>
                    <span className="tag" style={k.status === 'active' ? { background: T.tealSoft, color: T.tealText } : { background: T.bg, color: T.ink3 }}>{k.status === 'active' ? 'Đang dùng' : 'Đã thu hồi'}</span>
                    <span className="justify-self-end">
                      {k.status === 'active' && (
                        <Button size="sm" icon={<Trash2 size={14} />} style={{ color: T.accentText }} loading={revoke.isPending && revoke.variables === k.id} onClick={() => revoke.mutate(k.id)}>Thu hồi</Button>
                      )}
                    </span>
                  </div>
                ))}
                {revoke.isError && <div className="text-[13px] px-5 py-3" style={{ color: T.accentText, borderTop: `1px solid ${T.line}` }}>{errorMessage(revoke.error)}</div>}
              </>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}

export function WebhooksCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ['webhooks-out', workspaceId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Hook[]>(`/v1/workspaces/${workspaceId}/webhooks`) });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ url: '', description: '' });
  const [events, setEvents] = useState<string[]>(['payment.succeeded']);
  const [created, setCreated] = useState<{ id: string; secret: string } | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ id: string; url: string; events: string[]; secret: string }>(`/v1/workspaces/${workspaceId}/webhooks`, { url: f.url.trim(), events, description: f.description.trim() }),
    onSuccess: (d) => { setCreated({ id: d.id, secret: d.secret }); setOpen(false); setF({ url: '', description: '' }); void qc.invalidateQueries({ queryKey: key }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/workspaces/${workspaceId}/webhooks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const validUrl = /^https?:\/\/.+/.test(f.url.trim());
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-5 py-4">
        <Webhook size={18} style={{ color: T.ink2 }} />
        <span className="font-semibold">Webhook gửi đi</span>
        <span className="muted text-[12px]">Hội Mình gọi URL của bạn khi có sự kiện, ký HMAC-SHA256 ở header `X-HoiMinh-Signature`</span>
        <span className="flex-grow" />
        <Button size="sm" variant="dark" icon={<Plus size={14} />} onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm webhook'}</Button>
      </div>

      {created && (
        <div className="px-5 pb-4">
          <SecretOnce label="Secret để kiểm chữ ký" value={created.secret} note="Chỉ hiện một lần. Dùng để xác minh X-HoiMinh-Signature ở phía bạn." />
        </div>
      )}

      {open && (
        <div className="px-5 pb-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <Field label="URL nhận" hint="Phải là https ở production. Hội Mình thử lại theo backoff khi bạn trả lỗi.">
            <Input value={f.url} placeholder="https://n8n.cua-ban.com/webhook/hoiminh" onChange={(e) => setF({ ...f, url: e.target.value })} />
          </Field>
          <Field label="Ghi chú"><Input value={f.description} maxLength={120} placeholder="Đồng bộ đơn hàng sang CRM" onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Sự kiện">
            <ChipPicker options={WEBHOOK_EVENTS} selected={events} onToggle={(s) => setEvents((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))} />
          </Field>
          {create.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
          <div><Button variant="primary" size="sm" loading={create.isPending} disabled={!validUrl || events.length === 0} onClick={() => create.mutate()}>Thêm webhook</Button></div>
        </div>
      )}

      <QueryState q={q} rows={2} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa đăng ký webhook nào', hint: 'Thêm URL để nhận sự kiện thành viên, thanh toán, khóa học.' }}>
        {(hooks) => (
          <>
            {hooks.map((w) => (
              <div key={w.id} className="px-5 py-3.5 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.line}` }}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <code className="text-[12px] truncate" style={{ fontFamily: 'Consolas, monospace', maxWidth: 380 }}>{w.url}</code>
                  <span className="tag" style={w.status === 'active' ? { background: T.tealSoft, color: T.tealText } : { background: T.bg, color: T.ink3 }}>{w.status === 'active' ? 'Đang bật' : 'Đã tắt'}</span>
                  {w.failureCount > 0 && <Tag tone="danger">{w.failureCount} lần lỗi liên tiếp</Tag>}
                  <span className="flex-grow" />
                  <Button size="sm" icon={<Trash2 size={14} />} style={{ color: T.accentText }} loading={remove.isPending && remove.variables === w.id} onClick={() => remove.mutate(w.id)}>Xóa</Button>
                </div>
                {w.description && <span className="muted text-[12px]">{w.description}</span>}
                <div className="flex gap-1.5 flex-wrap">{w.events.map((e) => <span key={e} className="tag" style={{ background: T.bg, color: T.ink2, height: 22 }}>{e}</span>)}</div>
                {w.recent.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="muted text-[12px]">Lần gửi gần đây</span>
                    {w.recent.slice(0, 5).map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-[12px]">
                        <span className="muted" style={{ width: 96 }}>{fmtDateTime(d.createdAt)}</span>
                        <span className="flex-grow truncate">{d.eventName}</span>
                        <span style={{ color: d.status === 'delivered' ? T.tealText : T.accentText }}>{d.status === 'delivered' ? `OK ${d.responseStatus ?? ''}` : `lỗi ${d.responseStatus ?? ''} · lần ${d.attempt}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {remove.isError && <div className="text-[13px] px-5 py-3" style={{ color: T.accentText, borderTop: `1px solid ${T.line}` }}>{errorMessage(remove.error)}</div>}
          </>
        )}
      </QueryState>
    </div>
  );
}

export function McpCard() {
  return (
    <div className="card px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold">MCP · cho trợ lý AI thao tác hộ</span>
      </div>
      <div className="text-[13px] leading-[1.6]" style={{ color: T.ink2 }}>
        Máy chủ MCP của Hội Mình cho Claude, Cursor hay bất kỳ ứng dụng nào nói giao thức MCP gọi thẳng vào hội của bạn: liệt kê hội, xem thành viên, đăng bài, tạo khóa học, tạo sự kiện, xem doanh thu. Tạo một API key ở trên rồi khai báo:
      </div>
      <pre className="px-4 py-3 rounded-xl text-[12px] overflow-x-auto" style={{ background: T.side, color: T.sideText, fontFamily: 'Consolas, monospace' }}>{`{
  "mcpServers": {
    "hoiminh": {
      "command": "npx",
      "args": ["-y", "@hoiminh/mcp"],
      "env": {
        "HOIMINH_API_URL": "https://api.hoiminh.com",
        "HOIMINH_API_KEY": "hm_live_..."
      }
    }
  }
}`}</pre>
      <span className="muted text-[12px]">Trợ lý chỉ làm được những việc nằm trong phạm vi của key. Thu hồi key là cắt quyền ngay lập tức.</span>
    </div>
  );
}
