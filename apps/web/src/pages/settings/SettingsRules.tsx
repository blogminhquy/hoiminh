// Cài đặt · Quy tắc tự động: "KHI một người được gắn thẻ X THÌ cho vào hội, mở khóa học, gửi email". Thẻ đến từ
// Nguồn đồng bộ (landing) hoặc gắn tay ở Liên hệ và thẻ. Khách chưa có tài khoản thì quyền được giữ theo email,
// email gửi đi có nút kích hoạt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Modal, Select, T, Tag, Textarea, Toggle } from '@hoiminh/ui';
import { BookOpen, CircleCheck, CircleMinus, CircleX, Clock, Mail, Pencil, Plus, Trash2, Undo2, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { timeAgo } from '@/lib/format';
import { normalizeTag, RESULT_LABEL, TRIGGER_LABEL, type Rule, type RuleAction, type RuleOptions, type RuleRun, type TagRow } from './automation-shared';

const DEFAULT_EMAIL = { subject: 'Chào {{name}}, quyền truy cập của bạn đã sẵn sàng', body: 'Chào {{name}},\n\nCảm ơn bạn đã đặt mua. Bấm nút bên dưới để vào xem ngay.\n\nCần hỗ trợ, bạn trả lời email này nhé.' };
const ACTION_ICON: Record<RuleAction['type'], ReactNode> = { grant_membership: <Users size={18} />, grant_course: <BookOpen size={18} />, send_email: <Mail size={18} /> };
interface Draft { id: string | null; name: string; tag: string; actions: RuleAction[]; revokeOnTagRemoved: boolean }
const EMPTY: Draft = { id: null, name: '', tag: '', actions: [], revokeOnTagRemoved: true };

function ActionEditor({ action, options, onChange, onRemove }: { action: RuleAction; options: RuleOptions; onChange: (a: RuleAction) => void; onRemove: () => void }) {
  const head = (icon: ReactNode, title: string) => (
    <div className="flex items-center gap-2"><span style={{ color: T.ink2 }}>{icon}</span><span className="font-semibold text-[15px] flex-grow">{title}</span><button type="button" onClick={onRemove} aria-label={`Bỏ việc: ${title}`} className="p-1"><X size={18} style={{ color: T.ink3 }} /></button></div>
  );
  if (action.type === 'grant_membership') {
    const community = options.communities.find((c) => c.id === action.communityId);
    return (
      <div className="rounded-[12px] p-3.5 flex flex-col gap-2.5" style={{ background: T.bg }}>
        {head(<Users size={18} />, 'Cho vào hội')}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[14px] font-semibold">Hội
            <Select value={action.communityId} onChange={(e) => onChange({ ...action, communityId: e.target.value, tierKey: options.communities.find((c) => c.id === e.target.value)?.tiers[0]?.key ?? 'standard' })}>{options.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-semibold">Gói
            <Select value={action.tierKey} onChange={(e) => onChange({ ...action, tierKey: e.target.value as 'standard' | 'premium' | 'vip' })}>{(community?.tiers ?? []).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select>
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-semibold">Thời hạn
            <Select value={action.durationDays ?? 0} onChange={(e) => onChange({ ...action, durationDays: Number(e.target.value) || null })}>
              <option value={0}>Không giới hạn</option><option value={30}>30 ngày</option><option value={90}>90 ngày</option><option value={180}>180 ngày</option><option value={365}>1 năm</option>
            </Select>
          </label>
        </div>
      </div>
    );
  }
  if (action.type === 'grant_course') {
    return (
      <div className="rounded-[12px] p-3.5 flex flex-col gap-2.5" style={{ background: T.bg }}>
        {head(<BookOpen size={18} />, 'Mở khóa học')}
        <Select value={action.courseId} onChange={(e) => onChange({ ...action, courseId: e.target.value })} aria-label="Khóa học">{options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.status !== 'published' ? ' (chưa xuất bản)' : ''}</option>)}</Select>
      </div>
    );
  }
  return (
    <div className="rounded-[12px] p-3.5 flex flex-col gap-2.5" style={{ background: T.bg }}>
      {head(<Mail size={18} />, 'Gửi email')}
      <label className="input" style={{ background: T.surface }}><input value={action.subject} maxLength={150} onChange={(e) => onChange({ ...action, subject: e.target.value })} placeholder="Tiêu đề email" aria-label="Tiêu đề email" /></label>
      <Textarea rows={6} value={action.body} maxLength={5000} onChange={(e) => onChange({ ...action, body: e.target.value })} style={{ background: T.surface }} aria-label="Nội dung email" />
      <span className="muted text-[13px]">Biến dùng được: <code>{'{{name}}'}</code> tên khách, <code>{'{{email}}'}</code>, <code>{'{{tag}}'}</code>, <code>{'{{access_link}}'}</code> link vào xem. Quy tắc có cấp quyền thì email tự có nút vào xem (hoặc nút kích hoạt nếu khách chưa có tài khoản).</span>
    </div>
  );
}

function RuleModal({ draft, options, tags, onClose }: { draft: Draft; options: RuleOptions; tags: TagRow[]; onClose: () => void }) {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation/rules`;
  const [d, setD] = useState<Draft>(draft);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: d.name.trim(), tag: d.tag, actions: d.actions, revokeOnTagRemoved: d.revokeOnTagRemoved };
      return d.id ? api.patch(`${base}/${d.id}`, body) : api.post(base, body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['automation-rules'] }); void qc.invalidateQueries({ queryKey: ['automation-tags'] }); onClose(); },
  });
  const tag = normalizeTag(d.tag);
  const setAction = (i: number, a: RuleAction) => setD({ ...d, actions: d.actions.map((x, j) => (j === i ? a : x)) });
  const add = (a: RuleAction) => setD({ ...d, actions: [...d.actions, a] });
  // Mặc định là hội đang mở, không phải hội đứng đầu bảng chữ cái.
  const firstCommunity = options.communities.find((c) => c.id === shell.community.id) ?? options.communities[0];
  const ready = d.name.trim() && tag && d.actions.length > 0 && d.actions.every((a) => a.type !== 'send_email' || (a.subject.trim() && a.body.trim()));
  return (
    <Modal open onClose={onClose} title={d.id ? 'Sửa quy tắc' : 'Quy tắc mới'} width={640}>
      <div className="p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Tên quy tắc
          <span className="input"><input value={d.name} maxLength={120} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Ví dụ: Mua khóa Facebook Ads" /></span>
        </label>
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">KHI một người được gắn thẻ
          <span className="input"><input value={d.tag} maxLength={60} list="automation-tags" onChange={(e) => setD({ ...d, tag: e.target.value })} placeholder="Ví dụ: paid" aria-label="Thẻ kích hoạt" /></span>
          <datalist id="automation-tags">{tags.map((t) => <option key={t.id} value={t.name} />)}</datalist>
          <span className="muted text-[13px] font-normal">{tag && tag !== d.tag ? <>Sẽ lưu thành <code>{tag}</code>. </> : null}Tên thẻ viết tiếng Anh không dấu, ví dụ <code>paid</code>, <code>order_placed</code>. Landing phải gửi đúng tên này.</span>
        </label>
        <div className="flex flex-col gap-2.5">
          <span className="text-[14px] font-semibold">THÌ làm các việc sau</span>
          {d.actions.map((a, i) => <ActionEditor key={i} action={a} options={options} onChange={(x) => setAction(i, x)} onRemove={() => setD({ ...d, actions: d.actions.filter((_, j) => j !== i) })} />)}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!firstCommunity} onClick={() => firstCommunity && add({ type: 'grant_membership', communityId: firstCommunity.id, tierKey: firstCommunity.tiers.find((t) => t.key === 'premium')?.key ?? firstCommunity.tiers[0]?.key ?? 'standard', durationDays: null })}><Users size={16} />Cho vào hội</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={options.courses.length === 0} onClick={() => add({ type: 'grant_course', courseId: options.courses[0]!.id })}><BookOpen size={16} />Mở khóa học</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => add({ type: 'send_email', ...DEFAULT_EMAIL })}><Mail size={16} />Gửi email</button>
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-[15px]">
          <input type="checkbox" checked={d.revokeOnTagRemoved} onChange={(e) => setD({ ...d, revokeOnTagRemoved: e.target.checked })} className="mt-1" style={{ width: 18, height: 18 }} />
          <span>Gỡ thẻ thì thu hồi quyền đã cấp<span className="muted block text-[13px]">Dùng khi hoàn tiền: gỡ thẻ là khách mất quyền quy tắc này đã mở.</span></span>
        </label>
        {save.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
        <div className="flex gap-2 justify-end"><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={save.isPending} disabled={!ready} onClick={() => save.mutate()}>Lưu quy tắc</Button></div>
      </div>
    </Modal>
  );
}

const RESULT_ICON: Record<string, { icon: ReactNode; color: string }> = {
  done: { icon: <CircleCheck size={18} />, color: T.teal },
  pending: { icon: <Clock size={18} />, color: T.goldText },
  skipped: { icon: <CircleMinus size={18} />, color: T.ink3 },
  failed: { icon: <CircleX size={18} />, color: T.accentText },
  revoked: { icon: <Undo2 size={18} />, color: T.ink2 },
};

function Runs() {
  const shell = useShell();
  const q = useQuery({ queryKey: ['automation-runs', shell.community.id], queryFn: () => api.get<RuleRun[]>(`/v1/communities/${shell.community.id}/automation/runs`), refetchInterval: 10_000 });
  return (
    <section className="card overflow-hidden" aria-label="Nhật ký chạy">
      <div className="px-5 py-3 th">Nhật ký chạy gần đây</div>
      <QueryState q={q} rows={1}>
        {(runs) => runs.length === 0 ? <div className="muted text-[14px] px-5 pb-4">Chưa có lượt chạy nào.</div> : (
          <>{runs.slice(0, 12).map((r) => (
            <div key={r.id} className="px-5 py-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${T.line}` }}>
              <div className="flex items-center gap-2"><Tag tone={r.trigger === 'tag_added' ? 'teal' : 'neutral'}>{TRIGGER_LABEL[r.trigger]}</Tag><span className="flex-grow" /><span className="muted text-[13px] whitespace-nowrap">{timeAgo(r.createdAt)}</span></div>
              <div className="font-semibold text-[15px] break-all">{r.email}</div>
              <div className="muted text-[14px]">{r.rule}</div>
              {r.results.map((x, i) => {
                const st = RESULT_ICON[x.status] ?? RESULT_ICON.skipped!;
                return <div key={i} className="flex items-start gap-2 text-[14px]" style={{ color: x.status === 'failed' ? T.accentText : T.ink2 }}><span className="flex-shrink-0 mt-px" style={{ color: st.color }} role="img" aria-label={RESULT_LABEL[x.status] ?? x.status} title={RESULT_LABEL[x.status] ?? x.status}>{st.icon}</span><span>{x.detail}</span></div>;
              })}
            </div>
          ))}</>
        )}
      </QueryState>
    </section>
  );
}

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const base = `/v1/communities/${shell.community.id}/automation`;
  const rules = useQuery({ queryKey: ['automation-rules', shell.community.id], queryFn: () => api.get<Rule[]>(`${base}/rules`) });
  const options = useQuery({ queryKey: ['automation-options', shell.community.id], queryFn: () => api.get<RuleOptions>(`${base}/options`) });
  const tags = useQuery({ queryKey: ['automation-tags', shell.community.id], queryFn: () => api.get<TagRow[]>(`${base}/tags`) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const done = () => void qc.invalidateQueries({ queryKey: ['automation-rules'] });
  const toggle = useMutation({ mutationFn: (p: { id: string; enabled: boolean }) => api.patch(`${base}/rules/${p.id}`, { enabled: p.enabled }), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`${base}/rules/${id}`), onSuccess: done });
  const settings = `/${shell.community.slug}/cai-dat`;
  return (
    <>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-grow" style={{ minWidth: 220 }}>
          <h1 className="serif m-0 text-[28px] font-extrabold">Quy tắc tự động</h1>
          <div className="muted text-[15px]">Gắn thẻ là việc tự chạy. Thẻ đến từ <Link to={`${settings}/nguon-dong-bo`} className="font-semibold">Nguồn đồng bộ</Link> hoặc gắn tay ở <Link to={`${settings}/lien-he`} className="font-semibold">Liên hệ và thẻ</Link>.</div>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} disabled={!options.data} onClick={() => setDraft(EMPTY)}>Quy tắc mới</Button>
      </div>
      {(toggle.isError || remove.isError) && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(toggle.error ?? remove.error)}</div>}
      <QueryState q={rules} rows={2}>
        {(list) => list.length === 0
          ? <Empty title="Chưa có quy tắc nào" hint='Ví dụ: KHI gắn thẻ "paid" THÌ mở khóa học và gửi email hướng dẫn.' />
          : <>{list.map((r) => (
            <section key={r.id} className="card overflow-hidden" aria-label={`Quy tắc ${r.name}`}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-grow min-w-0 font-semibold text-[17px]" style={{ overflowWrap: 'anywhere', opacity: r.enabled ? 1 : 0.6 }}>{r.name}</div>
                <Toggle on={r.enabled} disabled={toggle.isPending} label={`Bật quy tắc ${r.name}`} onChange={(enabled) => toggle.mutate({ id: r.id, enabled })} />
              </div>
              <div className="rule-row" style={{ borderTop: `1px solid ${T.line}` }}>
                <span className="th">Khi</span>
                <div className="flex items-center gap-2 flex-wrap text-[15px]"><span className="muted">gắn thẻ</span><Tag tone="gold">{r.tag}</Tag></div>
              </div>
              <div className="rule-row" style={{ borderTop: `1px solid ${T.line}` }}>
                <span className="th">Thì</span>
                <div className="flex flex-col gap-2 text-[15px] min-w-0">
                  {r.summary.map((line, i) => <div key={i} className="flex items-start gap-2.5"><span className="flex-shrink-0 mt-0.5" style={{ color: T.teal }}>{ACTION_ICON[r.actions[i]?.type ?? 'send_email']}</span><span style={{ overflowWrap: 'anywhere' }}>{line}</span></div>)}
                </div>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5" style={{ borderTop: `1px solid ${T.line}`, background: T.bg }}>
                <div className="flex-grow min-w-0 muted text-[13px] flex flex-col gap-0.5">
                  <span>{r.runCount > 0 ? `Đã chạy ${r.runCount} lần${r.lastRunAt ? ` · ${timeAgo(r.lastRunAt)}` : ''}` : 'Chưa chạy lần nào'}</span>
                  {r.revokeOnTagRemoved && <span className="flex items-center gap-1.5"><Undo2 size={14} className="flex-shrink-0" />Gỡ thẻ thì thu hồi</span>}
                </div>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Sửa quy tắc ${r.name}`} title="Sửa" onClick={() => setDraft({ id: r.id, name: r.name, tag: r.tag, actions: r.actions, revokeOnTagRemoved: r.revokeOnTagRemoved })}><Pencil size={16} /></button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Xóa quy tắc ${r.name}`} title="Xóa" disabled={remove.isPending} onClick={() => { if (window.confirm(`Xóa quy tắc "${r.name}"? Quyền đã cấp cho khách vẫn giữ nguyên.`)) remove.mutate(r.id); }}><Trash2 size={16} /></button>
              </div>
            </section>
          ))}</>}
      </QueryState>
      <Runs />
      {draft && options.data && <RuleModal draft={draft} options={options.data} tags={tags.data ?? []} onClose={() => setDraft(null)} />}
    </>
  );
}
