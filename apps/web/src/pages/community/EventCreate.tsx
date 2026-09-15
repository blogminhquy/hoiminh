// Tạo / sửa sự kiện (eventCreateMain): 4 khối form + rail; POST /v1/communities/:id/events hoặc PATCH /v1/events/:id.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/EditorBits';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { EventRail, WhatBlock, WhenBlock, WhereBlock, WhoBlock, durationLabel, type EventForm } from './EventCreateParts';

interface Existing { id: string; title: string; coverColor: string; descriptionMd: string; startsAt: string; endsAt: string; recurrence: EventForm['recurrence']; kind: EventForm['kind']; meetingUrl: string | null; location: string | null; hostUserIds: string[]; capacity: number | null; access: EventForm['access']; allowQuestions: boolean; autoPublishRecording: boolean; reminders: EventForm['reminders'] }

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const nextDay = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d); };
const EMPTY: EventForm = { title: '', coverColor: T.teal, seriesTitle: '', descriptionMd: '', date: nextDay(), start: '20:00', end: '21:30', recurrence: 'none', occurrences: 8, kind: 'online', meetingUrl: '', location: '', hostUserIds: [], capacity: '', access: 'all_members', allowQuestions: true, autoPublishRecording: true, reminders: ['1d', '1h', 'start'], announceOnFeed: true, broadcastEmail: false };

function fromExisting(e: Existing): EventForm {
  const s = new Date(e.startsAt);
  return { ...EMPTY, title: e.title, coverColor: e.coverColor, descriptionMd: e.descriptionMd, date: localDate(s), start: localTime(s), end: localTime(new Date(e.endsAt)), recurrence: 'none', kind: e.kind, meetingUrl: e.meetingUrl ?? '', location: e.location ?? '', hostUserIds: e.hostUserIds, capacity: e.capacity ? String(e.capacity) : '', access: e.access, allowQuestions: e.allowQuestions, autoPublishRecording: e.autoPublishRecording, reminders: e.reminders, announceOnFeed: false };
}

function toPayload(f: EventForm) {
  const startsAt = new Date(`${f.date}T${f.start}:00`).toISOString();
  const endsAt = new Date(`${f.date}T${f.end}:00`).toISOString();
  return { title: f.title.trim(), descriptionMd: f.descriptionMd, coverColor: f.coverColor, seriesTitle: f.seriesTitle.trim() || null, startsAt, endsAt, timezone: 'Asia/Ho_Chi_Minh', recurrence: f.recurrence, occurrences: f.occurrences, kind: f.kind, meetingUrl: f.kind !== 'offline' && f.meetingUrl.trim() ? f.meetingUrl.trim() : null, location: f.kind !== 'online' && f.location.trim() ? f.location.trim() : null, hostUserIds: f.hostUserIds, capacity: f.capacity ? Number(f.capacity) : null, access: f.access, allowQuestions: f.allowQuestions, autoPublishRecording: f.autoPublishRecording, reminders: f.reminders, announceOnFeed: f.announceOnFeed, broadcastEmail: f.broadcastEmail };
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const slug = shell.community.slug;
  const { eventId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ['event', eventId], queryFn: () => api.get<Existing>(`/v1/events/${eventId}`), enabled: Boolean(eventId) });
  const [f, setF] = useState<EventForm>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (existing.data && !loaded) { setF(fromExisting(existing.data)); setLoaded(true); } }, [existing.data, loaded]);
  const patch = (p: Partial<EventForm>) => setF((prev) => ({ ...prev, ...p }));
  const save = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (eventId) { const r = await api.patch<{ id: string }>(`/v1/events/${eventId}`, toPayload(f)); return r.id; }
      const r = await api.post<{ event: { id: string }; created: number }>(`/v1/communities/${shell.community.id}/events`, toPayload(f));
      return r.event?.id ?? null;
    },
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: ['events'] }); void qc.invalidateQueries({ queryKey: ['event'] }); navigate(id ? `/${slug}/su-kien/${id}` : `/${slug}/su-kien`); },
  });
  if (!can('event.manage')) return <Navigate to={`/${slug}/su-kien`} replace />;
  if (eventId && existing.isLoading) return <LoadingBlock rows={5} />;
  const valid = f.title.trim().length >= 3 && Boolean(f.date) && Boolean(durationLabel(f.start, f.end)) && (f.kind === 'offline' ? Boolean(f.location.trim()) : true);
  return (
    <div className="two-col">
      <div className="main flex flex-col gap-5">
        <Breadcrumb to={`/${slug}/su-kien`} label="Sự kiện" title={eventId ? 'Sửa sự kiện' : 'Tạo sự kiện'}>
          <span className="flex-grow" />
          <Button size="sm" onClick={() => navigate(-1)}>Hủy</Button>
          <Button size="sm" variant="primary" loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}><Check size={14} />{eventId ? 'Lưu thay đổi' : 'Đăng sự kiện'}</Button>
        </Breadcrumb>
        {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
        <WhatBlock f={f} patch={patch} />
        <WhenBlock f={f} patch={patch} />
        <WhereBlock f={f} patch={patch} communityId={shell.community.id} />
        <WhoBlock f={f} patch={patch} />
      </div>
      <EventRail f={f} patch={patch} editing={Boolean(eventId)} />
    </div>
  );
}
