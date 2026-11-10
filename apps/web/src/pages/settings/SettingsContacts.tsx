// Cài đặt · Liên hệ và thẻ: mọi người đã để lại email qua landing (hoặc được thêm tay), kèm thẻ và quyền đang giữ.
// Liên hệ chưa chắc có tài khoản Hội Mình: quyền của họ được giữ theo email cho tới khi họ bấm link kích hoạt.
// Gắn hoặc gỡ thẻ ở đây cũng chạy quy tắc y như thẻ đến từ landing, nên đây là chỗ thử quy tắc nhanh nhất.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorBox, Modal, Select, T, Tag } from '@hoiminh/ui';
import { Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDate } from '@/lib/format';
import { normalizeTag, splitTags, type ContactRow, type ContactsPage, type TagRow } from './automation-shared';

function AddContactModal({ onClose, tags }: { onClose: () => void; tags: TagRow[] }) {
  const shell = useShell();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tagText, setTagText] = useState('');
  const parsed = splitTags(tagText);
  const m = useMutation({
    mutationFn: () => api.post(`/v1/communities/${shell.community.id}/automation/contacts`, { email: email.trim(), name: name.trim() || undefined, tags: parsed }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['automation-contacts'] }); void qc.invalidateQueries({ queryKey: ['automation-tags'] }); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Thêm liên hệ" width={520}>
      <form className="p-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (email.trim() && !m.isPending) m.mutate(); }}>
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Email<span className="input"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="khach@example.com" /></span></label>
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Tên (không bắt buộc)<span className="input"><input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></span></label>
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Thẻ
          <span className="input"><input value={tagText} list="contact-tags" onChange={(e) => setTagText(e.target.value)} placeholder="Ví dụ: paid" aria-label="Thẻ gắn ngay" /></span>
          <datalist id="contact-tags">{tags.map((t) => <option key={t.id} value={t.name} />)}</datalist>
          <span className="muted text-[13px] font-normal">{parsed.length ? `Sẽ gắn: ${parsed.join(', ')}. ` : ''}Gắn thẻ là quy tắc của thẻ đó chạy ngay (cấp quyền, gửi email).</span>
        </label>
        {m.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        <div className="flex gap-2 justify-end"><Button onClick={onClose}>Hủy</Button><Button type="submit" variant="primary" loading={m.isPending} disabled={!email.trim()}>Thêm liên hệ</Button></div>
      </form>
    </Modal>
  );
}

function Row({ c }: { c: ContactRow }) {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation/contacts/${c.id}`;
  const [adding, setAdding] = useState('');
  const [sent, setSent] = useState(false);
  const done = () => { void qc.invalidateQueries({ queryKey: ['automation-contacts'] }); void qc.invalidateQueries({ queryKey: ['automation-tags'] }); };
  const add = useMutation({ mutationFn: (tag: string) => api.post(`${base}/tags`, { tag }), onSuccess: () => { setAdding(''); done(); } });
  const untag = useMutation({ mutationFn: (tag: string) => api.del(`${base}/tags/${encodeURIComponent(tag)}`), onSuccess: done });
  const resend = useMutation({ mutationFn: () => api.post(`${base}/resend-activation`), onSuccess: () => setSent(true) });
  const remove = useMutation({ mutationFn: () => api.del(base), onSuccess: done });
  const pending = c.grants.filter((g) => g.status === 'pending');
  const applied = c.grants.filter((g) => g.status === 'applied');
  const next = normalizeTag(adding);
  const err = add.error ?? untag.error ?? resend.error ?? remove.error;
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-grow min-w-0" style={{ minWidth: 200 }}>
          <div className="font-semibold text-[16px] break-all">{c.email}</div>
          <div className="muted text-[14px]">{[c.name, c.phone, `thêm ${fmtDate(c.createdAt)}`].filter(Boolean).join(' · ')}</div>
        </div>
        <Tag tone={c.hasAccount ? 'teal' : 'neutral'}>{c.hasAccount ? 'Đã có tài khoản' : 'Chưa có tài khoản'}</Tag>
        {c.unsubscribed && <Tag tone="neutral">Đã ngừng nhận email</Tag>}
        <button type="button" aria-label={`Xóa liên hệ ${c.email}`} className="p-1.5" disabled={remove.isPending} onClick={() => { if (window.confirm(`Xóa liên hệ ${c.email}? Quyền các quy tắc đã cấp cho liên hệ này sẽ bị thu hồi.`)) remove.mutate(); }}><Trash2 size={18} style={{ color: T.ink3 }} /></button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {c.tags.map((t) => (
          <span key={t.id} className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{t.name}
            <button type="button" aria-label={`Gỡ thẻ ${t.name} khỏi ${c.email}`} disabled={untag.isPending} onClick={() => { if (window.confirm(`Gỡ thẻ "${t.name}"? Quy tắc bật "gỡ thẻ thì thu hồi" sẽ thu hồi quyền đã cấp.`)) untag.mutate(t.name); }}><X size={14} /></button>
          </span>
        ))}
        <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (next && !add.isPending) add.mutate(next); }}>
          <label className="input" style={{ height: 34, width: 150, padding: '0 10px' }}><input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Gắn thẻ" list="contact-tags-all" aria-label={`Gắn thẻ cho ${c.email}`} style={{ fontSize: 14 }} /></label>
          {next && <button type="submit" className="btn btn-ghost btn-sm" disabled={add.isPending}><Plus size={14} />Gắn</button>}
        </form>
      </div>
      {applied.length > 0 && <div className="text-[14px]" style={{ color: T.tealText }}>Đã cấp: {applied.map((g) => g.title + (g.expiresAt ? ` (tới ${fmtDate(g.expiresAt)})` : '')).join('; ')}</div>}
      {pending.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-[14px]" style={{ color: T.goldText }}>
          <span>Chờ khách kích hoạt: {pending.map((g) => g.title).join('; ')}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={resend.isPending || sent} onClick={() => resend.mutate()}><Send size={14} />{sent ? 'Đã gửi lại link' : 'Gửi lại link kích hoạt'}</button>
        </div>
      )}
      {err && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(err)}</div>}
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const base = `/v1/communities/${shell.community.id}/automation`;
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [adding, setAdding] = useState(false);
  const tags = useQuery({ queryKey: ['automation-tags', shell.community.id], queryFn: () => api.get<TagRow[]>(`${base}/tags`) });
  const params = new URLSearchParams({ limit: '30' });
  if (q.trim()) params.set('q', q.trim());
  if (tag) params.set('tag', tag);
  const list = useInfiniteQuery({
    queryKey: ['automation-contacts', shell.community.id, params.toString()],
    queryFn: ({ pageParam }) => api.get<ContactsPage>(`${base}/contacts?${params.toString()}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  return (
    <>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-grow" style={{ minWidth: 220 }}>
          <h1 className="serif m-0 text-[28px] font-extrabold">Liên hệ và thẻ</h1>
          <div className="muted text-[15px]">{total} liên hệ, dùng chung cho mọi hội của bạn. Người đã có tài khoản còn xem được theo thẻ ở trang Thành viên.</div>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>Thêm liên hệ</Button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <label className="input flex-grow" style={{ maxWidth: 380, minWidth: 200 }}><Search size={18} style={{ color: T.ink3 }} /><input placeholder="Tìm theo email, tên, số điện thoại" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm liên hệ" /></label>
        <Select value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 'auto', minWidth: 180 }} aria-label="Lọc theo thẻ">
          <option value="">Mọi thẻ</option>
          {(tags.data ?? []).map((t) => <option key={t.id} value={t.name}>{t.name} ({t.contactCount})</option>)}
        </Select>
      </div>
      <datalist id="contact-tags-all">{(tags.data ?? []).map((t) => <option key={t.id} value={t.name} />)}</datalist>
      {list.isLoading ? <LoadingBlock rows={3} /> : list.isError ? <ErrorBox message={errorMessage(list.error)} onRetry={() => void list.refetch()} /> : rows.length === 0 ? (
        <Empty title={q || tag ? 'Không có liên hệ nào khớp' : 'Chưa có liên hệ nào'} hint={q || tag ? 'Thử bỏ bộ lọc' : 'Liên hệ tự vào đây khi landing gửi đơn về, hoặc bấm Thêm liên hệ để thử quy tắc.'} />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 th">Liên hệ, thẻ và quyền</div>
          {rows.map((c) => <Row key={c.id} c={c} />)}
          {list.hasNextPage && <div className="p-3 flex justify-center" style={{ borderTop: `1px solid ${T.line}` }}><Button size="sm" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Tải thêm</Button></div>}
        </div>
      )}
      {adding && <AddContactModal tags={tags.data ?? []} onClose={() => setAdding(false)} />}
    </>
  );
}
