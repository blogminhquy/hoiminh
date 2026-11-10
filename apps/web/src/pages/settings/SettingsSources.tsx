// Cài đặt · Nguồn đồng bộ: mỗi nguồn là một địa chỉ nhận dữ liệu từ landing (form đặt hàng Webcake hoặc công cụ khác).
// Dữ liệu gửi về mang email và thẻ; thẻ kích hoạt quy tắc ở tab Quy tắc tự động. Chưa biết bên gửi đặt tên trường thế nào
// nên có bước "bắn thử rồi chọn trường": xem lượt nhận gần nhất, chỉ ra trường nào là email, trường nào là thẻ.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Select, T, Tag, Toggle } from '@hoiminh/ui';
import { Check, ChevronDown, ChevronUp, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { timeAgo } from '@/lib/format';
import { fieldChoices, splitTags, type Source, type SourceEvent, type SourceMapping } from './automation-shared';

const STATUS: Record<SourceEvent['status'], { label: string; tone: 'teal' | 'neutral' | 'danger' }> = { processed: { label: 'Đã xử lý', tone: 'teal' }, ignored: { label: 'Bỏ qua', tone: 'neutral' }, failed: { label: 'Chưa xử lý được', tone: 'danger' } };
const FIELDS: Array<{ key: keyof Omit<SourceMapping, 'defaultTags'>; label: string }> = [{ key: 'emailPath', label: 'Email' }, { key: 'tagPath', label: 'Thẻ cần gắn' }, { key: 'namePath', label: 'Tên' }, { key: 'phonePath', label: 'Số điện thoại' }, { key: 'removeTagPath', label: 'Thẻ cần gỡ' }];

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* trình duyệt chặn thì người dùng tự bôi đen */ }
  };
  return (
    <div className="flex items-center gap-2 rounded-[10px] px-3 py-2.5" style={{ background: T.bg }}>
      <code className="flex-grow min-w-0 text-[14px] break-all" aria-label={label}>{value}</code>
      <button type="button" className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Đã chép' : 'Sao chép'}</button>
    </div>
  );
}

/** Lượt nhận gần đây của một nguồn + ghép trường theo lượt mới nhất. */
function Events({ source }: { source: Source }) {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation`;
  const q = useQuery({ queryKey: ['automation-events', source.id], queryFn: () => api.get<SourceEvent[]>(`${base}/sources/${source.id}/events`), refetchInterval: 5000 });
  const [mapping, setMapping] = useState<SourceMapping>(source.mapping);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['automation-events', source.id] }); void qc.invalidateQueries({ queryKey: ['automation-sources'] }); };
  const save = useMutation({ mutationFn: () => api.patch(`${base}/sources/${source.id}`, { mapping }), onSuccess: refresh });
  const redo = useMutation({ mutationFn: (eventId: string) => api.post(`${base}/events/${eventId}/reprocess`), onSuccess: refresh });
  const dirty = FIELDS.some((f) => mapping[f.key] !== source.mapping[f.key]);
  return (
    <QueryState q={q} rows={1}>
      {(events) => {
        if (events.length === 0) return <div className="muted text-[14px]">Chưa nhận lượt nào. Gửi thử một đơn từ landing, lượt nhận sẽ hiện ở đây sau vài giây.</div>;
        const choices = fieldChoices(events[0]!.fields);
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="font-semibold text-[15px]">Ghép trường theo lượt nhận mới nhất</div>
              <div className="muted text-[14px]">Để "Tự dò" nếu landing đặt tên trường là email, name, phone, tag. Bên gửi đặt tên khác thì chọn đúng trường ở đây.</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-[14px] font-semibold">{f.label}
                    <Select value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })} aria-label={`Trường ${f.label}`}>
                      <option value="">Tự dò</option>
                      {mapping[f.key] && !choices.some((c) => c.path === mapping[f.key]) && <option value={mapping[f.key]}>{mapping[f.key]}</option>}
                      {choices.map((c) => <option key={c.path} value={c.path}>{c.path}: {c.sample}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
              {dirty && <div className="flex items-center gap-2"><Button size="sm" variant="dark" loading={save.isPending} onClick={() => save.mutate()}>Lưu ghép trường</Button>{save.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</span>}</div>}
            </div>
            <div className="flex flex-col">
              {events.slice(0, 8).map((e) => (
                <div key={e.id} className="flex flex-col gap-1 py-2.5" style={{ borderTop: `1px solid ${T.line}` }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Tag>
                    <span className="font-semibold text-[15px] break-all">{e.email ?? 'Không có email'}</span>
                    <span className="muted text-[13px]">{timeAgo(e.createdAt)}</span>
                    <span className="flex-grow" />
                    <button type="button" className="btn btn-ghost btn-sm" disabled={redo.isPending} onClick={() => redo.mutate(e.id)}><RefreshCw size={14} />Xử lý lại</button>
                  </div>
                  <div className="text-[14px]" style={{ color: T.ink2 }}>{e.detail}</div>
                  <details className="text-[14px]">
                    <summary className="muted cursor-pointer">Xem dữ liệu nhận được ({Object.keys(e.fields).length} trường)</summary>
                    <div className="mt-1.5 rounded-[10px] px-3 py-2 flex flex-col gap-0.5 overflow-x-auto" style={{ background: T.bg }}>
                      {Object.entries(e.fields).map(([k, v]) => <div key={k} className="whitespace-nowrap"><code>{k}</code>: {v}</div>)}
                    </div>
                  </details>
                </div>
              ))}
              {redo.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(redo.error)}</span>}
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}

function SourceCard({ source }: { source: Source }) {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation/sources/${source.id}`;
  const [open, setOpen] = useState(source.receivedCount === 0);
  const [defaults, setDefaults] = useState(source.mapping.defaultTags.join(', '));
  const done = () => void qc.invalidateQueries({ queryKey: ['automation-sources'] });
  const patch = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch(base, body), onSuccess: done });
  const rotate = useMutation({ mutationFn: () => api.post(`${base}/rotate`), onSuccess: done });
  const remove = useMutation({ mutationFn: () => api.del(base), onSuccess: done });
  const parsed = splitTags(defaults);
  const defaultsDirty = parsed.join(',') !== source.mapping.defaultTags.join(',');
  return (
    <section className="card flex flex-col gap-3.5" style={{ padding: '18px 20px' }} aria-label={`Nguồn ${source.name}`}>
      <div className="flex items-center gap-3">
        <div className="flex-grow min-w-0">
          <div className="font-semibold text-[17px] truncate">{source.name}</div>
          <div className="muted text-[14px]">{source.receivedCount > 0 ? `Đã nhận ${source.receivedCount} lượt, gần nhất ${source.lastReceivedAt ? timeAgo(source.lastReceivedAt) : ''}` : 'Chưa nhận lượt nào'}</div>
        </div>
        <span className="text-[14px] font-semibold whitespace-nowrap" style={{ color: source.status === 'active' ? T.teal : T.ink3 }}>{source.status === 'active' ? 'Đang nhận' : 'Tạm dừng'}</span>
        <Toggle on={source.status === 'active'} disabled={patch.isPending} label={`Bật nhận dữ liệu cho ${source.name}`} onChange={(on) => patch.mutate({ status: on ? 'active' : 'paused' })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">Địa chỉ nhận (dán vào phần Webhook của form đặt hàng)</span>
        <CopyBox value={source.url} label="Địa chỉ nhận" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">Thẻ luôn gắn cho mọi đơn từ nguồn này (không bắt buộc)</span>
        <div className="flex gap-2 items-center">
          <label className="input flex-grow"><input value={defaults} onChange={(e) => setDefaults(e.target.value)} placeholder="Ví dụ: order_placed" aria-label="Thẻ luôn gắn" /></label>
          {defaultsDirty && <Button size="sm" variant="dark" loading={patch.isPending} onClick={() => patch.mutate({ mapping: { defaultTags: parsed } })}>Lưu</Button>}
        </div>
        <span className="muted text-[13px]">Dùng khi landing không truyền được trường tag. Nhiều thẻ thì cách nhau bằng dấu phẩy.{parsed.length > 0 && defaultsDirty ? ` Sẽ lưu: ${parsed.join(', ')}` : ''}</span>
      </div>
      <button type="button" className="flex items-center gap-1.5 font-semibold text-[15px] self-start" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}Lượt nhận gần đây và ghép trường</button>
      {open && <Events source={source} />}
      <div className="flex gap-2 flex-wrap pt-1" style={{ borderTop: `1px solid ${T.line}` }}>
        <button type="button" className="btn btn-ghost btn-sm mt-3" disabled={rotate.isPending} onClick={() => { if (window.confirm('Đổi địa chỉ nhận? Địa chỉ cũ ngừng hoạt động ngay, bạn cần dán địa chỉ mới vào landing.')) rotate.mutate(); }}><RefreshCw size={14} />Đổi địa chỉ</button>
        <button type="button" className="btn btn-ghost btn-sm mt-3" disabled={remove.isPending} onClick={() => { if (window.confirm(`Xóa nguồn "${source.name}"? Liên hệ và thẻ đã nhận vẫn được giữ.`)) remove.mutate(); }}><Trash2 size={14} />Xóa nguồn</button>
        {(patch.isError || rotate.isError || remove.isError) && <span className="text-[14px] mt-3 self-center" style={{ color: T.accentText }}>{errorMessage(patch.error ?? rotate.error ?? remove.error)}</span>}
      </div>
    </section>
  );
}

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation`;
  const q = useQuery({ queryKey: ['automation-sources', shell.community.id], queryFn: () => api.get<Source[]>(`${base}/sources`) });
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => api.post(`${base}/sources`, { name: name.trim() }), onSuccess: () => { setName(''); void qc.invalidateQueries({ queryKey: ['automation-sources'] }); } });
  const settings = `/${shell.community.slug}/cai-dat`;
  return (
    <>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Nguồn đồng bộ</h1>
        <div className="muted text-[15px]">Nhận đơn từ landing kèm thẻ. Thẻ sẽ kích hoạt việc ở <Link to={`${settings}/quy-tac`} className="font-semibold">Quy tắc tự động</Link>. Thẻ dùng chung cho mọi hội của bạn.</div>
      </div>
      <form className="card flex gap-2 items-center flex-wrap" style={{ padding: '14px 16px' }} onSubmit={(e) => { e.preventDefault(); if (name.trim() && !create.isPending) create.mutate(); }}>
        <label className="input flex-grow" style={{ minWidth: 200 }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nguồn, ví dụ: Landing khóa Facebook Ads" maxLength={80} aria-label="Tên nguồn mới" /></label>
        <Button type="submit" variant="primary" icon={<Plus size={18} />} loading={create.isPending} disabled={!name.trim()}>Tạo nguồn</Button>
        {create.isError && <span className="text-[14px] w-full" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
      </form>
      <QueryState q={q} rows={2}>
        {(list) => list.length === 0
          ? <Empty title="Chưa có nguồn nào" hint="Tạo một nguồn để lấy địa chỉ nhận, rồi dán địa chỉ đó vào form đặt hàng trên landing." />
          : <>{list.map((s) => <SourceCard key={s.id} source={s} />)}</>}
      </QueryState>
      <section className="card flex flex-col gap-2 text-[15px]" style={{ padding: '18px 20px', lineHeight: 1.65 }} aria-label="Cách nối với landing">
        <div className="font-semibold text-[17px]">Cách nối với landing Webcake</div>
        <ol className="m-0 pl-5 flex flex-col gap-1.5">
          <li>Mở form đặt hàng trên landing, vào phần gửi dữ liệu (Webhook hoặc API), dán <strong>Địa chỉ nhận</strong> ở trên.</li>
          <li>Form cần có trường <code>email</code>. Thêm một trường ẩn tên <code>tag</code>, giá trị là tên thẻ, ví dụ <code>paid</code>. Nhiều thẻ thì viết <code>order_placed, paid</code>.</li>
          <li>Đặt thử một đơn. Lượt nhận hiện ở mục "Lượt nhận gần đây". Nếu báo chưa tìm thấy email hay thẻ, chọn đúng trường ở phần ghép trường rồi bấm Xử lý lại.</li>
        </ol>
        <div className="muted text-[14px]">Không thêm được trường ẩn? Gắn thẻ ngay trên địa chỉ bằng cách thêm <code>?tag=paid</code> vào cuối, hoặc dùng ô "Thẻ luôn gắn". Muốn gỡ thẻ (ví dụ khi hoàn tiền) thì gửi trường <code>remove_tag</code>.</div>
        <div className="muted text-[14px]">Ai có địa chỉ nhận đều gắn được thẻ, nên đừng đăng địa chỉ này công khai. Lỡ lộ thì bấm Đổi địa chỉ.</div>
      </section>
    </>
  );
}
