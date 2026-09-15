// Khối form Tạo sự kiện (eventCreateMain): Sự kiện gì / Khi nào / Ở đâu / Ai được tham gia + rail xem trước, checklist, mẫu nhanh.
import { useQuery } from '@tanstack/react-query';
import { Avatar, Chip, Field, Input, OptionCard, Select, T } from '@hoiminh/ui';
import { Calendar, ChevronRight, Globe, Link as LinkIcon, Plus, Users, Video, X } from 'lucide-react';
import { Checklist, CoverPicker, MdEditor, ToggleRow } from '@/components/EditorBits';
import { api } from '@/lib/api';

export type Kind = 'online' | 'offline' | 'hybrid';
export type Access = 'all_members' | 'premium' | 'public';
export type Recurrence = 'none' | 'weekly' | 'monthly';
export type Reminder = '1d' | '1h' | 'start' | '15m';
export interface EventForm { title: string; coverColor: string; seriesTitle: string; descriptionMd: string; date: string; start: string; end: string; recurrence: Recurrence; occurrences: number; kind: Kind; meetingUrl: string; location: string; hostUserIds: string[]; capacity: string; access: Access; allowQuestions: boolean; autoPublishRecording: boolean; reminders: Reminder[]; announceOnFeed: boolean; broadcastEmail: boolean }
export type Patch = (p: Partial<EventForm>) => void;
interface Member { id: string; user: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }; role: string }

export const TEMPLATES: Array<{ title: string; meta: string; apply: Partial<EventForm> }> = [
  { title: 'Q&A hằng tuần', meta: 'Zoom · 90 phút · Premium', apply: { title: 'Q&A tuần', seriesTitle: 'Q&A hằng tuần', start: '20:00', end: '21:30', recurrence: 'weekly', occurrences: 8, kind: 'online', access: 'premium' } },
  { title: 'Workshop trực tiếp', meta: 'Tại chỗ · 3 giờ · giới hạn chỗ', apply: { title: 'Workshop', start: '09:00', end: '12:00', recurrence: 'none', kind: 'offline', capacity: '30', access: 'all_members' } },
  { title: 'Onboarding người mới', meta: 'Zoom · 60 phút · mọi thành viên', apply: { title: 'Onboarding cho thành viên mới', start: '20:00', end: '21:00', recurrence: 'weekly', occurrences: 4, kind: 'online', access: 'all_members' } },
];

export function durationLabel(start: string, end: string): string {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return '';
  return mins >= 60 ? `${Math.floor(mins / 60)} giờ${mins % 60 ? ` ${mins % 60}` : ''}` : `${mins} phút`;
}

export function WhatBlock({ f, patch }: { f: EventForm; patch: Patch }) {
  return (
    <div className="card p-6 flex flex-col gap-[18px]">
      <div className="font-bold text-[15px]">Sự kiện gì</div>
      <Field label="Tên sự kiện" hint={`${f.title.length}/120 ký tự`}><Input value={f.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} placeholder="Q&A tuần: Lead magnet và Tripwire" /></Field>
      <div className="flex gap-5 flex-col md:flex-row">
        <div className="w-full md:w-[240px] flex-shrink-0"><CoverPicker title={f.title || 'Sự kiện'} coverUrl={null} coverColor={f.coverColor} onColor={(coverColor) => patch({ coverColor })} fontSize={16} /></div>
        <div className="flex-grow flex flex-col gap-3.5">
          <Field label="Thuộc chuỗi" hint="Chuỗi gom các buổi lại, người đăng ký một lần được nhắc mọi buổi"><Input value={f.seriesTitle} onChange={(e) => patch({ seriesTitle: e.target.value })} placeholder="Để trống nếu là buổi lẻ" /></Field>
          <Field label="Mô tả"><MdEditor value={f.descriptionMd} onChange={(descriptionMd) => patch({ descriptionMd })} minHeight={96} tools={['b', 'i', 'h2', 'ul', 'ol', 'link']} placeholder="Buổi này nói về gì, ai nên có mặt, cần chuẩn bị gì…" /></Field>
        </div>
      </div>
    </div>
  );
}

export function WhenBlock({ f, patch }: { f: EventForm; patch: Patch }) {
  const rec: Array<[Recurrence, string]> = [['none', 'Không'], ['weekly', 'Hằng tuần'], ['monthly', 'Hằng tháng']];
  return (
    <div className="card p-6 flex flex-col gap-[18px]">
      <div className="font-bold text-[15px]">Khi nào</div>
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-3.5">
        <Field label="Ngày"><Input type="date" value={f.date} onChange={(e) => patch({ date: e.target.value })} left={<Calendar size={16} />} /></Field>
        <Field label="Bắt đầu"><Input type="time" value={f.start} onChange={(e) => patch({ start: e.target.value })} /></Field>
        <Field label="Kết thúc"><Input type="time" value={f.end} onChange={(e) => patch({ end: e.target.value })} right={<span className="muted text-[12px]">{durationLabel(f.start, f.end)}</span>} /></Field>
      </div>
      <div className="flex gap-3.5 items-end flex-wrap">
        <Field label="Múi giờ" hint="Thành viên ở múi giờ khác tự thấy giờ của họ"><div className="input" style={{ width: 260, color: T.ink }}><Globe size={16} /><span className="flex-grow">Giờ Việt Nam (GMT+7)</span></div></Field>
        <Field label="Lặp lại"><div className="flex gap-1.5">{rec.map(([k, l]) => <Chip key={k} on={f.recurrence === k} onClick={() => patch({ recurrence: k })} style={{ height: 40, borderRadius: 10 }}>{l}</Chip>)}</div></Field>
        {f.recurrence !== 'none' && <Field label="Số buổi"><Input type="number" min={1} max={52} value={f.occurrences} onChange={(e) => patch({ occurrences: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })} style={{ width: 100 }} /></Field>}
      </div>
      {f.recurrence !== 'none' && f.date && <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-[10px] text-[13px]" style={{ background: T.tealSoft, color: T.tealText }}><Calendar size={16} /><span>Sẽ tạo {f.occurrences} buổi, {f.recurrence === 'weekly' ? 'hằng tuần' : 'hằng tháng'} từ {f.date.split('-').reverse().join('/')}. Mỗi buổi sửa riêng được sau.</span></div>}
    </div>
  );
}

export function WhereBlock({ f, patch, communityId }: { f: EventForm; patch: Patch; communityId: string }) {
  const members = useQuery({ queryKey: ['directory', communityId], queryFn: () => api.get<Member[]>(`/v1/communities/${communityId}/members/directory`), staleTime: 60_000 });
  const staff = (members.data ?? []).filter((m) => m.role !== 'member');
  const picked = (members.data ?? []).filter((m) => f.hostUserIds.includes(m.user.id));
  const provider = /zoom\.us/.test(f.meetingUrl) ? 'Zoom' : /meet\.google/.test(f.meetingUrl) ? 'Google Meet' : /youtu/.test(f.meetingUrl) ? 'YouTube' : /facebook/.test(f.meetingUrl) ? 'Facebook' : null;
  return (
    <div className="card p-6 flex flex-col gap-[18px]">
      <div className="font-bold text-[15px]">Ở đâu</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <OptionCard on={f.kind === 'online'} onClick={() => patch({ kind: 'online' })} icon={<Video size={14} />} title="Trực tuyến" sub="Zoom, Google Meet, YouTube Live" />
        <OptionCard on={f.kind === 'offline'} onClick={() => patch({ kind: 'offline' })} icon={<Globe size={14} />} title="Trực tiếp" sub="Có địa chỉ, giới hạn chỗ" />
        <OptionCard on={f.kind === 'hybrid'} onClick={() => patch({ kind: 'hybrid' })} icon={<Users size={14} />} title="Kết hợp" sub="Vừa tại chỗ vừa phát online" />
      </div>
      {f.kind !== 'offline' && <Field label="Link phòng" hint="Chỉ hiện cho người đã đăng ký, và chỉ từ 15 phút trước giờ bắt đầu"><Input value={f.meetingUrl} onChange={(e) => patch({ meetingUrl: e.target.value })} placeholder="https://zoom.us/j/…" left={<LinkIcon size={16} />} right={provider ? <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}>{provider}</span> : undefined} /></Field>}
      {f.kind !== 'online' && <Field label="Địa chỉ"><Input value={f.location} onChange={(e) => patch({ location: e.target.value })} placeholder="Số nhà, đường, quận, thành phố" /></Field>}
      <div className="grid-2">
        <Field label="Người dẫn dắt">
          <div className="input flex-wrap" style={{ minHeight: 44, height: 'auto', padding: '6px 10px', gap: 6 }}>
            {picked.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full text-[13px]" style={{ padding: '3px 8px 3px 3px', background: T.bg }}><Avatar name={m.user.name} src={m.user.avatarUrl} color={m.user.coverColor ?? T.ink} size={22} />{m.user.name}<button type="button" aria-label="Bỏ" onClick={() => patch({ hostUserIds: f.hostUserIds.filter((id) => id !== m.user.id) })} style={{ color: T.ink3 }}><X size={12} /></button></span>)}
            <Select value="" onChange={(e) => { if (e.target.value) patch({ hostUserIds: [...f.hostUserIds, e.target.value] }); }} className="flex-grow" style={{ border: 0, height: 30, minWidth: 120 }}><option value="">+ Thêm</option>{staff.filter((m) => !f.hostUserIds.includes(m.user.id)).map((m) => <option key={m.id} value={m.user.id}>{m.user.name}</option>)}</Select>
            <Plus size={16} style={{ color: T.ink3 }} />
          </div>
        </Field>
        <Field label="Giới hạn chỗ" hint="Đặt số chỗ nếu Zoom có giới hạn hoặc có tại chỗ"><Input type="number" min={1} value={f.capacity} onChange={(e) => patch({ capacity: e.target.value })} placeholder="Không giới hạn" /></Field>
      </div>
    </div>
  );
}

export function WhoBlock({ f, patch }: { f: EventForm; patch: Patch }) {
  const rem: Array<[Reminder, string]> = [['1d', '1 ngày'], ['1h', '1 giờ'], ['start', 'Khi bắt đầu'], ['15m', '15 phút']];
  const toggleRem = (r: Reminder) => patch({ reminders: f.reminders.includes(r) ? f.reminders.filter((x) => x !== r) : [...f.reminders, r] });
  return (
    <div className="card p-6 flex flex-col gap-3.5">
      <div className="font-bold text-[15px]">Ai được tham gia</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <OptionCard on={f.access === 'all_members'} onClick={() => patch({ access: 'all_members' })} title="Mọi thành viên" sub="Kể cả gói Tiêu chuẩn" />
        <OptionCard on={f.access === 'premium'} onClick={() => patch({ access: 'premium' })} title="Chỉ Premium" sub="Người khác thấy nhưng bị khóa, có nút nâng cấp" />
        <OptionCard on={f.access === 'public'} onClick={() => patch({ access: 'public' })} title="Công khai" sub="Hiện trên trang giới thiệu, người ngoài đăng ký rồi vào hội" />
      </div>
      <div className="flex flex-col gap-2.5 text-[13px] pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <ToggleRow label="Cho gửi câu hỏi trước và bình chọn" on={f.allowQuestions} onChange={(allowQuestions) => patch({ allowQuestions })} />
        <ToggleRow label="Tự đăng bản ghi vào Xem lại sau buổi" on={f.autoPublishRecording} onChange={(autoPublishRecording) => patch({ autoPublishRecording })} />
        <ToggleRow label="Nhắc người đăng ký"><div className="flex gap-1.5 flex-wrap">{rem.map(([k, l]) => <Chip key={k} on={f.reminders.includes(k)} onClick={() => toggleRem(k)} style={{ height: 28, fontSize: 12 }}>{l}</Chip>)}</div></ToggleRow>
        <ToggleRow label="Đăng bài thông báo lên Bảng tin khi tạo" on={f.announceOnFeed} onChange={(announceOnFeed) => patch({ announceOnFeed })} />
        <ToggleRow label="Gửi email cho tất cả thành viên" on={f.broadcastEmail} onChange={(broadcastEmail) => patch({ broadcastEmail })} />
      </div>
    </div>
  );
}

export function EventRail({ f, patch, editing }: { f: EventForm; patch: Patch; editing: boolean }) {
  return (
    <aside className="rail flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2">
        <div className="font-semibold text-[13px]">Trước khi đăng</div>
        <Checklist items={[{ label: 'Tên và mô tả', done: f.title.trim().length >= 3 }, { label: 'Ngày giờ', done: Boolean(f.date && f.start && f.end && durationLabel(f.start, f.end)) }, { label: f.kind === 'offline' ? 'Địa chỉ' : 'Link phòng', done: f.kind === 'offline' ? Boolean(f.location.trim()) : /^https?:\/\//.test(f.meetingUrl) }, { label: 'Người dẫn dắt', done: true }, { label: 'Ảnh bìa (nên có)', done: true }]} />
      </div>
      {!editing && (
        <div className="card p-4 flex flex-col gap-2">
          <div className="font-semibold text-[13px]">Mẫu nhanh</div>
          {TEMPLATES.map((t) => <button key={t.title} type="button" onClick={() => patch(t.apply)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left" style={{ background: T.bg }}><Calendar size={14} style={{ color: T.ink3 }} /><span className="flex-grow"><span className="block text-[13px] font-semibold">{t.title}</span><span className="block muted text-[11px]">{t.meta}</span></span><ChevronRight size={14} /></button>)}
        </div>
      )}
      <div className="muted text-[12px]">Hiện trong Sự kiện, lịch tháng và khối Sự kiện sắp tới trên Bảng tin.</div>
    </aside>
  );
}
