// Chi tiết sự kiện (eventDetailMain): bìa + nhãn, ngày giờ + CTA, nhắc, mô tả, bản ghi, câu hỏi gửi trước, thảo luận; rail người tham gia, chuỗi, tổ chức.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, DateBlock, T } from '@hoiminh/ui';
import { Bell, Calendar, Check, ChevronLeft, ChevronUp, Download, ExternalLink, Lock, Play, Settings, Users, Video } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommentThread } from '@/components/CommentThread';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { saveBlob, toCsvBlob } from '@/lib/download';
import { fmtDate, fmtDuration, fmtLongDate } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { placeLabel, timeRange, useRegister, type EventItem, type Host } from './EventParts';

interface Question { id: string; question: string; voteCount: number; answeredAt: string | null; user: Host; voted: boolean }
interface EventDetail extends EventItem { descriptionMd: string; capacity: number | null; allowQuestions: boolean; premiumLocked: boolean; questions: Question[]; attendees: Host[]; attendeesVisible: boolean; series: Array<{ id: string; title: string; startsAt: string; seriesIndex: number | null; status: string; registrationCount: number }>; recordings: Array<{ id: string; title: string; videoUrl: string; durationSeconds: number | null }>; canManage: boolean }

function Questions({ e }: { e: EventDetail }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['event', e.id] });
  const ask = useMutation({ mutationFn: () => api.post(`/v1/events/${e.id}/questions`, { question: text.trim() }), onSuccess: () => { setText(''); void refresh(); } });
  const vote = useMutation({ mutationFn: (id: string) => api.post(`/v1/event-questions/${id}/vote`, {}), onSuccess: () => void refresh() });
  return (
    <div className="card flex flex-col gap-3.5" style={{ padding: '22px 24px' }}>
      <div className="flex items-center gap-2.5 flex-wrap"><span className="font-bold text-[16px]">Câu hỏi gửi trước</span><span className="muted text-[13px]">· {e.questions.length} câu, bình chọn để xếp thứ tự</span></div>
      <div className="input" style={{ height: 46, borderRadius: 12 }}><input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Gửi câu hỏi của bạn cho buổi này…" className="flex-grow min-w-0" onKeyDown={(ev) => { if (ev.key === 'Enter' && text.trim().length >= 3) ask.mutate(); }} /><Button size="sm" variant="dark" loading={ask.isPending} disabled={text.trim().length < 3} onClick={() => ask.mutate()}>Gửi</Button></div>
      {ask.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(ask.error)}</div>}
      {e.questions.map((qn) => (
        <div key={qn.id} className="flex gap-3 items-start py-3" style={{ borderTop: `1px solid ${T.line}` }}>
          <button type="button" onClick={() => vote.mutate(qn.id)} className="flex flex-col items-center gap-0.5 w-11 flex-shrink-0 py-1.5 rounded-[10px]" style={{ background: qn.voted ? T.accentSoft : T.bg, color: qn.voted ? T.accentText : T.ink2 }}><ChevronUp size={16} /><span className="font-bold text-[13px]">{qn.voteCount}</span></button>
          <div className="flex-grow min-w-0"><div className="flex items-center gap-2 text-[13px]"><Avatar name={qn.user.name} src={qn.user.avatarUrl} color={qn.user.coverColor ?? T.ink} size={22} /><span className="font-semibold">{qn.user.name}</span>{qn.answeredAt && <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}>Đã trả lời</span>}</div><div className="text-[14px] mt-1" style={{ color: T.ink2 }}>{qn.question}</div></div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const slug = shell.community.slug;
  const { eventId = '' } = useParams();
  const q = useQuery({ queryKey: ['event', eventId], queryFn: () => api.get<EventDetail>(`/v1/events/${eventId}`), refetchInterval: 60_000 });
  const reg = useRegister(eventId);
  return (
    <QueryState q={q} rows={6}>
      {(e) => {
        const start = new Date(e.startsAt);
        const hosts = e.hosts;
        return (
          <div className="two-col">
            <div className="main flex flex-col gap-5">
              <Link to={`/${slug}/su-kien`} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} />Sự kiện</Link>
              <div className="card overflow-hidden">
                <div className="relative flex items-end p-6" style={{ height: 240, background: e.coverColor }}>
                  <div className="absolute top-5 left-6 flex gap-2">{e.live && <span className="tag" style={{ background: T.accentSoft, color: T.accentText, height: 26, padding: '0 10px' }}>Đang diễn ra</span>}<span className="tag" style={{ background: 'rgba(255,253,249,0.2)', color: T.invertInk, height: 26, padding: '0 10px' }}><Video size={12} />{placeLabel(e)}</span>{e.access === 'premium' && <span className="tag" style={{ background: T.goldSoft, color: T.goldText, height: 26, padding: '0 10px' }}><Lock size={12} />Premium</span>}</div>
                  <div style={{ color: T.invertInk }}><div className="serif text-[24px] md:text-[32px] font-extrabold leading-[1.15] max-w-[560px]">{e.title}</div>{e.seriesIndex ? <div className="text-[14px] opacity-85 mt-1.5">Buổi {e.seriesIndex} · chuỗi</div> : null}</div>
                </div>
                <div className="p-6 flex flex-col gap-5">
                  <div className="flex gap-4 flex-col md:flex-row">
                    <DateBlock date={start} tone="accent" />
                    <div className="flex-grow flex flex-col gap-1">
                      <div className="font-bold text-[16px]">{fmtLongDate(e.startsAt)}</div>
                      <div className="flex items-center gap-3.5 text-[14px] flex-wrap" style={{ color: T.ink2 }}><span className="inline-flex items-center gap-1.5"><Bell size={16} />{timeRange(e.startsAt, e.endsAt)} · giờ Việt Nam</span><span className="inline-flex items-center gap-1.5"><Users size={16} />{e.registrationCount} đã đăng ký{e.capacity ? ` / ${e.capacity} chỗ` : ''}</span></div>
                      {hosts.length > 0 && <div className="flex items-center gap-2 text-[13px] flex-wrap" style={{ color: T.ink2 }}><Avatar name={hosts[0]?.name} src={hosts[0]?.avatarUrl} color={hosts[0]?.coverColor ?? T.ink} size={22} />Dẫn dắt bởi {hosts.map((h, i) => <span key={h.id}>{i > 0 && ' · cùng '}<Link to={`/u/${h.handle}`} className="font-semibold" style={{ color: T.ink }}>{h.name}</Link></span>)}</div>}
                      {e.location && <div className="text-[13px]" style={{ color: T.ink2 }}>Địa điểm: {e.location}</div>}
                    </div>
                    <div className="flex flex-col gap-2 items-start md:items-end">
                      {e.premiumLocked ? <Link to={`/${slug}/thanh-toan?tier=premium&cycle=monthly`} className="btn btn-primary" style={{ height: 48, padding: '0 24px', fontSize: 15 }}><Lock size={16} />Nâng cấp để tham gia</Link>
                        : e.meetingUrl ? <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ height: 48, padding: '0 24px', fontSize: 15 }}><Play size={16} />Vào phòng {placeLabel(e)}</a>
                          : e.registered ? <span className="muted text-[13px]">Link phòng hiện 15 phút trước giờ bắt đầu</span>
                            : <Button variant="primary" size="lg" loading={reg.isPending} onClick={() => reg.mutate(true)}>Đăng ký tham gia</Button>}
                      <div className="flex gap-1.5 flex-wrap">
                        <a className="btn btn-ghost btn-sm" href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${start.toISOString().replace(/[-:]|\.\d{3}/g, '')}/${new Date(e.endsAt).toISOString().replace(/[-:]|\.\d{3}/g, '')}`} target="_blank" rel="noreferrer"><Calendar size={14} />Thêm vào lịch</a>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void navigator.clipboard?.writeText(window.location.href)}><ExternalLink size={14} />Chia sẻ</button>
                        {e.registered && <button type="button" className="btn btn-ghost btn-sm" style={{ color: T.teal }} onClick={() => reg.mutate(false)} disabled={reg.isPending}><Check size={14} />Đã đăng ký</button>}
                      </div>
                    </div>
                  </div>
                  {e.registered && <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px]" style={{ background: T.goldSoft, color: T.goldDark }}><Bell size={16} /><span className="flex-grow">Nhắc trước 1 giờ và khi bắt đầu qua thông báo và email. Link phòng chỉ hiện cho người đã đăng ký.</span></div>}
                  <Markdown md={e.descriptionMd} />
                  {e.recordings.length > 0 && <div className="flex gap-2.5 flex-wrap">{e.recordings.map((r) => <a key={r.id} href={r.videoUrl} target="_blank" rel="noreferrer" className="chip"><Play size={16} />{r.title}{r.durationSeconds ? ` · ${fmtDuration(r.durationSeconds, true)}` : ''}</a>)}</div>}
                </div>
              </div>
              {e.allowQuestions && !e.premiumLocked && <Questions e={e} />}
              <CommentThread targetType="event" targetId={e.id} title={(n) => <>Thảo luận <span className="muted font-medium">· {n}</span></>} />
            </div>
            <aside className="rail flex flex-col gap-4">
              <div className="card p-4 flex flex-col gap-3">
                <div className="flex items-center"><span className="font-semibold">Người tham gia</span><span className="muted text-[12px] ml-auto">{e.registrationCount} đăng ký</span></div>
                {e.attendeesVisible ? (
                  <div className="grid grid-cols-6 gap-2">{e.attendees.map((a) => <Link key={a.id} to={`/u/${a.handle}`} className="inline-flex"><Avatar name={a.name} src={a.avatarUrl} color={a.coverColor ?? T.ink} size={40} /></Link>)}{e.registrationCount > e.attendees.length && <span className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[12px] font-bold" style={{ background: T.bg, color: T.ink2 }}>+{e.registrationCount - e.attendees.length}</span>}</div>
                ) : <div className="muted text-[12px]">Chỉ thành viên Premium và cộng sự thấy danh sách này.</div>}
              </div>
              {e.series.length > 1 && (
                <div className="card p-4 flex flex-col gap-2.5">
                  <div className="font-semibold">Trong chuỗi này</div>
                  {e.series.map((s) => { const done = new Date(s.startsAt) < new Date() && s.id !== e.id; return <Link key={s.id} to={`/${slug}/su-kien/${s.id}`} className="flex gap-2.5 items-center" style={{ color: T.ink }}><span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center flex-shrink-0" style={done ? { background: T.teal, color: '#fff' } : { border: `1.5px solid ${s.id === e.id ? T.accent : T.line2}` }}>{done && <Check size={12} />}</span><div className="min-w-0"><div className="text-[13px] font-medium truncate">{s.seriesIndex ? `Buổi ${s.seriesIndex} · ` : ''}{s.title}</div><div className="muted text-[12px]">{fmtDate(s.startsAt).slice(0, 5)}{s.id === e.id ? ' · buổi này' : ` · ${s.registrationCount} đăng ký`}</div></div></Link>; })}
                </div>
              )}
              {e.canManage && (
                <div className="card p-4 flex flex-col gap-2">
                  <div className="font-semibold text-[13px]">Dành cho người tổ chức</div>
                  <Link to={`/${slug}/su-kien/${e.id}/sua`} className="btn btn-ghost btn-sm justify-start"><Settings size={14} />Sửa sự kiện</Link>
                  <button type="button" className="btn btn-ghost btn-sm justify-start" onClick={() => void api.get<Array<{ name: string; email: string; handle: string }>>(`/v1/events/${e.id}/attendees`).then((rows) => saveBlob(toCsvBlob([['Tên', 'Email', 'Handle'], ...rows.map((r) => [r.name, r.email, r.handle])]), `nguoi-dang-ky-${e.id.slice(0, 8)}.csv`))}><Download size={14} />Xuất danh sách</button>
                </div>
              )}
            </aside>
          </div>
        );
      }}
    </QueryState>
  );
}
