// Sự kiện (eventsMain): chip Sắp tới/Của tôi/Đã qua, nhóm theo Hôm nay/Tuần này/Tuần sau/Sau đó, rail lịch tháng + bản ghi.
import { useQuery } from '@tanstack/react-query';
import { Chip, T } from '@hoiminh/ui';
import { Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDate, fmtDuration } from '@/lib/format';
import { EventRow, MonthCalendar, type EventItem } from './EventParts';

interface Recording { id: string; eventId: string; title: string; videoUrl: string; durationSeconds: number | null; publishedAt: string }
interface EventList { items: EventItem[]; pastCount: number; recordings: Recording[]; calendarDays: string[]; canManage: boolean }
type Filter = 'upcoming' | 'mine' | 'past';

const DOW = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function groupOf(startsAt: string, past: boolean): string {
  const d = new Date(startsAt);
  if (past) return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff <= 0) return `Hôm nay · ${DOW[now.getDay()]}, ${fmtDate(now).slice(0, 5)}`;
  const weekEnd = 7 - ((now.getDay() + 6) % 7);
  if (diff < weekEnd) return 'Tuần này';
  if (diff < weekEnd + 7) return 'Tuần sau';
  return 'Sau đó';
}

export default function Page() {
  const shell = useShell();
  const slug = shell.community.slug;
  const [filter, setFilter] = useState<Filter>('upcoming');
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const q = useQuery({ queryKey: ['events', shell.community.id, filter, month], queryFn: () => api.get<EventList>(`/v1/communities/${shell.community.id}/events?filter=${filter}&month=${month}`) });
  const groups = (items: EventItem[]) => {
    const out: Array<[string, EventItem[]]> = [];
    for (const e of items) { const g = groupOf(e.startsAt, filter === 'past'); const last = out[out.length - 1]; if (last && last[0] === g) last[1].push(e); else out.push([g, [e]]); }
    return out;
  };
  return (
    <div className="two-col">
      <div className="main flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="serif m-0 text-[28px] font-extrabold">Sự kiện</h1>
          <div className="flex gap-2 md:ml-3"><Chip on={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>Sắp tới</Chip><Chip on={filter === 'mine'} onClick={() => setFilter('mine')}>Của tôi</Chip><Chip on={filter === 'past'} onClick={() => setFilter('past')}>Đã qua{q.data ? ` · ${q.data.pastCount}` : ''}</Chip></div>
          <span className="flex-grow" />
          {q.data?.canManage && <Link to={`/${slug}/su-kien/moi`} className="btn btn-primary btn-sm" style={{ height: 36 }}><Plus size={16} />Tạo sự kiện</Link>}
        </div>
        <QueryState q={q} rows={3} isEmpty={(d) => d.items.length === 0} empty={{ title: filter === 'mine' ? 'Bạn chưa đăng ký sự kiện nào' : filter === 'past' ? 'Chưa có sự kiện đã qua' : 'Chưa có sự kiện sắp tới', hint: q.data?.canManage ? 'Tạo Q&A hằng tuần hoặc workshop cho thành viên' : 'Quay lại sau, chủ hội sẽ sớm mở buổi mới' }}>
          {(d) => (
            <>
              {groups(d.items).map(([g, items]) => (
                <div key={g} className="flex flex-col gap-3">
                  <div className="th pt-1">{g}</div>
                  {items.map((e) => <EventRow key={e.id} e={e} slug={slug} />)}
                </div>
              ))}
            </>
          )}
        </QueryState>
      </div>
      <aside className="rail flex flex-col gap-4">
        <MonthCalendar month={month} days={q.data?.calendarDays ?? []} onMonth={setMonth} />
        <div className="card p-4 flex flex-col gap-2.5">
          <div className="font-semibold">Xem lại buổi trước</div>
          {(q.data?.recordings ?? []).length === 0 && <div className="muted text-[13px]">Chưa có bản ghi.</div>}
          {(q.data?.recordings ?? []).slice(0, 3).map((r) => (
            <a key={r.id} href={r.videoUrl} target="_blank" rel="noreferrer" className="flex gap-3 items-center" style={{ color: T.ink }}>
              <div className="w-[72px] h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#171310', color: T.surface }}><Play size={16} /></div>
              <div className="min-w-0"><div className="text-[13px] font-medium truncate">{r.title}</div><div className="muted text-[12px]">{fmtDate(r.publishedAt).slice(0, 5)}{r.durationSeconds ? ` · ${fmtDuration(r.durationSeconds, true)}` : ''}</div></div>
            </a>
          ))}
          {(q.data?.recordings ?? []).length > 0 && <button type="button" className="text-[13px] font-semibold text-left" style={{ color: T.ink }} onClick={() => setFilter('past')}>Tất cả bản ghi</button>}
        </div>
      </aside>
    </div>
  );
}
