// Mảnh sự kiện dùng chung: kiểu dữ liệu, dòng sự kiện (eventRow), lịch tháng (calCell), nhãn giờ/địa điểm.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, DateBlock, T } from '@hoiminh/ui';
import { Check, ChevronLeft, ChevronRight, Clock, Globe, Play, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { fmtTime } from '@/lib/format';

export interface Host { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }
export interface EventItem { id: string; title: string; startsAt: string; endsAt: string; kind: 'online' | 'offline' | 'hybrid'; meetingProvider: string | null; meetingUrl: string | null; location: string | null; access: string; registrationCount: number; status: string; coverColor: string; live: boolean; registered: boolean; hosts: Host[]; seriesId: string | null; seriesIndex: number | null }

export const PROVIDER_LABEL: Record<string, string> = { zoom: 'Zoom', google_meet: 'Google Meet', youtube: 'YouTube Live', facebook: 'Facebook Live', other: 'Trực tuyến' };
export function placeLabel(e: { kind: string; meetingProvider: string | null; location: string | null }): string {
  if (e.kind === 'offline') return `Trực tiếp${e.location ? ` · ${e.location}` : ''}`;
  const online = PROVIDER_LABEL[e.meetingProvider ?? 'other'] ?? 'Trực tuyến';
  return e.kind === 'hybrid' ? `${online} + tại chỗ` : online;
}
export function timeRange(a: string, b: string): string { return `${fmtTime(a)} – ${fmtTime(b)}`; }

export function useRegister(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (join: boolean) => (join ? api.post(`/v1/events/${eventId}/register`, {}) : api.del(`/v1/events/${eventId}/register`)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['events'] }); void qc.invalidateQueries({ queryKey: ['event', eventId] }); },
  });
}

export function EventRow({ e, slug }: { e: EventItem; slug: string }) {
  const reg = useRegister(e.id);
  const host = e.hosts[0];
  const d = new Date(e.startsAt);
  return (
    <div className="card flex items-center gap-4 flex-wrap" style={{ padding: '16px 20px', borderColor: e.live ? T.accent : undefined }}>
      <DateBlock date={d} tone={e.live ? 'accent' : 'neutral'} />
      <div className="flex-grow min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">{e.live && <span className="tag" style={{ background: T.accentSoft, color: T.accentText }}>Đang diễn ra</span>}<Link to={`/${slug}/su-kien/${e.id}`} className="font-semibold text-[15px]" style={{ color: T.ink }}>{e.title}</Link></div>
        <div className="flex items-center gap-3.5 text-[13px] flex-wrap" style={{ color: T.ink2 }}>
          <span className="inline-flex items-center gap-1.5"><Clock size={15} />{timeRange(e.startsAt, e.endsAt)}</span>
          <span className="inline-flex items-center gap-1.5">{e.kind === 'offline' ? <Globe size={15} /> : <Video size={15} />}{placeLabel(e)}</span>
          {host && <span className="inline-flex items-center gap-1.5"><Avatar name={host.name} src={host.avatarUrl} color={host.coverColor ?? T.ink} size={20} />{host.name}</span>}
        </div>
      </div>
      <span className="muted text-[13px] whitespace-nowrap">{e.registrationCount} người tham gia</span>
      {e.live && e.registered && e.meetingUrl ? <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm"><Play size={14} />Vào phòng</a>
        : e.registered ? <button type="button" className="btn btn-ghost btn-sm" style={{ color: T.teal }} onClick={() => reg.mutate(false)} disabled={reg.isPending}><Check size={14} />Đã đăng ký</button>
          : <button type="button" className="btn btn-dark btn-sm" onClick={() => reg.mutate(true)} disabled={reg.isPending}>Đăng ký</button>}
    </div>
  );
}

export function MonthCalendar({ month, days, onMonth }: { month: string; days: string[]; onMonth: (m: string) => void }) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(y, m - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const shift = (d: number) => { const n = new Date(y, m - 1 + d, 1); onMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`); };
  const cells = [...Array.from({ length: pad }, () => null), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between pb-2"><button type="button" aria-label="Tháng trước" onClick={() => shift(-1)} style={{ color: T.ink3 }}><ChevronLeft size={16} /></button><span className="font-bold">Tháng {m}, {y}</span><button type="button" aria-label="Tháng sau" onClick={() => shift(1)} style={{ color: T.ink3 }}><ChevronRight size={16} /></button></div>
      <div className="grid grid-cols-7 gap-0.5">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <div key={d} className="th text-center" style={{ height: 28, lineHeight: '28px' }}>{d}</div>)}
        {cells.map((n, i) => {
          const key = n ? `${y}-${String(m).padStart(2, '0')}-${String(n).padStart(2, '0')}` : '';
          const isToday = key === todayKey;
          const dot = Boolean(n) && days.includes(key);
          return <div key={i} className="relative h-[34px] flex items-center justify-center text-[13px]" style={isToday ? { background: T.ink, color: T.surface, borderRadius: 8, fontWeight: 700 } : { color: n ? T.ink : T.line2 }}>{n ?? ''}{dot && !isToday && <span className="absolute bottom-1 w-[5px] h-[5px] rounded-full" style={{ background: T.accent }} />}</div>;
        })}
      </div>
      <div className="muted text-[12px] pt-2 flex items-center gap-1.5"><Clock size={14} />Giờ Việt Nam (GMT+7)</div>
    </div>
  );
}
