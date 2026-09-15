// Tin nhắn (messagesMain): danh sách hội thoại 340px (tìm, lọc), luồng tin thời gian thực qua SSE
// (tin mới, đã xem, đang gõ, chấm online), polling giãn nhịp làm dự phòng, ô nhập + ảnh, panel thành viên 280px.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, T } from '@hoiminh/ui';
import { Image as ImageIcon, Search, Send, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingBlock, QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtimeEvent, usePollInterval } from '@/lib/realtime';
import { Bubble, ConvoRow, DayDivider, MemberPanel, PresenceAvatar, TypingBubble, type Conversation, type Message, type Panel, type Person } from './MessagesParts';

interface ConvoList { items: Conversation[]; unreadConversations: number }
interface Thread { items: Message[]; other: Person | null; community: { id: string; name: string; slug: string } | null; panel: Panel | null }
type Filter = 'all' | 'unread' | 'automated';

/** Gửi "đang gõ" tối đa một lần mỗi 3 giây để không dội API mỗi phím. */
const TYPING_PING_MS = 3_000;

function ThreadView({ id, meId, onArchived }: { id: string; meId: string; onArchived: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [typingUntil, setTypingUntil] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef(0);
  const q = useQuery({ queryKey: ['thread', id], queryFn: () => api.get<Thread>(`/v1/me/conversations/${id}/messages`), refetchInterval: usePollInterval() });
  const send = useMutation({
    mutationFn: (p: { body: string; imageFileId?: string }) => api.post(`/v1/me/messages`, { conversationId: id, body: p.body, imageFileId: p.imageFileId }),
    onSuccess: () => { setText(''); void qc.invalidateQueries({ queryKey: ['thread', id] }); void qc.invalidateQueries({ queryKey: ['conversations'] }); void qc.invalidateQueries({ queryKey: ['badges'] }); },
  });
  const archive = useMutation({ mutationFn: () => api.post(`/v1/me/conversations/${id}/archive`, {}), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['conversations'] }); onArchived(); } });

  // Sự kiện đẩy về: chèn tin mới vào đúng luồng, cập nhật "Đã xem", bật/tắt "đang gõ", đổi chấm online.
  useRealtimeEvent(useCallback((e) => {
    if (e.type === 'message.new' && e.conversationId === id) {
      qc.setQueryData<Thread>(['thread', id], (prev) => (prev && !prev.items.some((m) => m.id === e.message.id) ? { ...prev, items: [...prev.items, e.message] } : prev));
      setTypingUntil(0);
      if (e.message.senderUserId !== meId) void api.post(`/v1/me/conversations/${id}/read`, {}).catch(() => null);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } else if (e.type === 'message.read' && e.conversationId === id && e.byUserId !== meId) {
      qc.setQueryData<Thread>(['thread', id], (prev) => (prev ? { ...prev, items: prev.items.map((m) => (m.senderUserId === meId && !m.readAt ? { ...m, readAt: e.readAt } : m)) } : prev));
    } else if (e.type === 'conversation.typing' && e.conversationId === id && e.byUserId !== meId) {
      setTypingUntil(new Date(e.expiresAt).getTime());
    } else if (e.type === 'presence.changed') {
      qc.setQueryData<Thread>(['thread', id], (prev) => (prev?.other?.id === e.userId ? { ...prev, other: { ...prev.other, online: e.online } } : prev));
    }
  }, [id, meId, qc]));

  // Chỉ báo "đang gõ" tự tắt khi hết hạn, kể cả khi người kia đóng tab giữa chừng.
  const typing = typingUntil > Date.now();
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTypingUntil(0), typingUntil - Date.now());
    return () => clearTimeout(t);
  }, [typing, typingUntil]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [q.data?.items.length, typing]);

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingPing.current > TYPING_PING_MS) {
      lastTypingPing.current = now;
      void api.post(`/v1/me/conversations/${id}/typing`, {}).catch(() => null);
    }
  };
  const pickImage = async (file: File) => { const r = await api.upload(file, 'message_image'); send.mutate({ body: text.trim(), imageFileId: r.fileId }); };
  if (q.isLoading) return <div className="card flex-grow p-6"><LoadingBlock /></div>;
  if (q.isError || !q.data?.other) return <div className="card flex-grow p-6 muted text-[13px]">{errorMessage(q.error)}</div>;
  const d = q.data;
  const other = d.other!;
  return (
    <>
      <div className="card flex-grow flex flex-col overflow-hidden min-w-0" style={{ minHeight: 520 }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${T.line}` }}>
          <PresenceAvatar person={other} size={40} />
          <div className="flex-grow min-w-0"><div className="font-semibold truncate">{other.name}</div><div className="muted text-[12px] flex items-center gap-1.5 flex-wrap">{d.panel?.tier && <span className="tag" style={{ background: T.goldSoft, color: T.goldText, height: 18, padding: '0 6px' }}>{d.panel.tier.name}</span>}{typing ? 'Đang gõ…' : other.online ? 'Đang hoạt động' : d.community?.name}</div></div>
          <Link to={`/u/${other.handle}`} className="btn btn-ghost btn-sm"><User size={14} />Hồ sơ</Link>
        </div>
        <div className="flex-grow px-4 py-5 md:px-6 flex flex-col gap-3.5 overflow-y-auto" style={{ maxHeight: 560 }}>
          {d.items.map((m, i) => { const prev = d.items[i - 1]; const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString(); return <div key={m.id} className="flex flex-col gap-3.5">{newDay && <DayDivider date={m.createdAt} />}<Bubble m={m} mine={m.senderUserId === meId} /></div>; })}
          {typing && <TypingBubble name={other.name.split(' ').pop() ?? other.name} />}
          <div ref={bottom} />
        </div>
        {send.isError && <div className="px-4 text-[13px]" style={{ color: T.accentText }}>{errorMessage(send.error)}</div>}
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${T.line}` }}>
          <button type="button" aria-label="Gửi ảnh" className="w-9 h-9 inline-flex items-center justify-center" style={{ color: T.ink2 }} onClick={() => fileRef.current?.click()}><ImageIcon size={20} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickImage(f); e.target.value = ''; }} />
          <div className="input flex-grow" style={{ height: 44, borderRadius: 12 }}><input value={text} onChange={(e) => onType(e.target.value)} placeholder={`Nhắn cho ${other.name.split(' ').pop()}…`} className="flex-grow min-w-0" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); send.mutate({ body: text.trim() }); } }} /></div>
          <button type="button" aria-label="Gửi" className="btn btn-primary" style={{ width: 44, height: 44, padding: 0, borderRadius: 12 }} disabled={!text.trim() || send.isPending} onClick={() => send.mutate({ body: text.trim() })}><Send size={18} /></button>
        </div>
      </div>
      <div className="hide-mobile"><MemberPanel other={other} panel={d.panel} community={d.community} onArchive={() => archive.mutate()} /></div>
    </>
  );
}

export default function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['conversations', filter, search], queryFn: () => api.get<ConvoList>(`/v1/me/conversations?filter=${filter}${search ? `&q=${encodeURIComponent(search)}` : ''}`), refetchInterval: usePollInterval() });

  // Danh sách bên trái cũng cần sống: tin mới đổi thứ tự và số chưa đọc, chấm online đổi theo phiên.
  useRealtimeEvent(useCallback((e) => {
    if (e.type === 'message.new') void qc.invalidateQueries({ queryKey: ['conversations'] });
    else if (e.type === 'presence.changed') {
      qc.setQueriesData<ConvoList>({ queryKey: ['conversations'] }, (prev) => (prev ? { ...prev, items: prev.items.map((c) => (c.other.id === e.userId ? { ...c, other: { ...c.other, online: e.online } } : c)) } : prev));
    }
  }, [qc]));

  const selected = sp.get('c') ?? q.data?.items[0]?.id ?? null;
  const select = (id: string | null) => setSp(id ? { c: id } : {});
  return (
    <div className="flex gap-5 flex-col md:flex-row">
      <div className={`card w-full md:w-[340px] flex flex-col overflow-hidden flex-shrink-0 ${selected ? 'hide-mobile' : ''}`}>
        <div className="flex flex-col gap-3" style={{ padding: '16px 16px 12px' }}>
          <h1 className="serif m-0 text-[22px] font-extrabold">Tin nhắn</h1>
          <div className="input" style={{ height: 38 }}><Search size={16} style={{ color: T.ink3 }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm người…" className="flex-grow min-w-0" /></div>
          <div className="flex gap-1.5"><Chip on={filter === 'all'} onClick={() => setFilter('all')} style={{ height: 28, fontSize: 12 }}>Tất cả</Chip><Chip on={filter === 'unread'} onClick={() => setFilter('unread')} style={{ height: 28, fontSize: 12 }}>Chưa đọc{q.data?.unreadConversations ? ` · ${q.data.unreadConversations}` : ''}</Chip><Chip on={filter === 'automated'} onClick={() => setFilter('automated')} style={{ height: 28, fontSize: 12 }}>Tự động</Chip></div>
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-2 overflow-y-auto" style={{ maxHeight: 640 }}>
          <QueryState q={q} rows={4} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có tin nhắn', hint: 'Nhắn cho thành viên từ trang hồ sơ hoặc danh sách thành viên' }}>
            {(d) => <>{d.items.map((c) => <ConvoRow key={c.id} c={c} on={c.id === selected} onClick={() => select(c.id)} />)}</>}
          </QueryState>
        </div>
      </div>
      {selected && user ? <ThreadView key={selected} id={selected} meId={user.id} onArchived={() => select(null)} /> : <div className="card flex-grow p-8 text-center muted text-[13px] hide-mobile">Chọn một hội thoại để xem</div>}
    </div>
  );
}
