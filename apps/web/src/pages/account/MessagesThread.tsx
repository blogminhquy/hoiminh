// Khung chat của một hội thoại (kiểu Zalo): đầu khung có trạng thái truy cập, luồng tin dồn về đáy, thao tác trên từng tin
// (trả lời, cảm xúc, sao chép, thu hồi), ô nhập nhiều dòng có thanh công cụ (ảnh, tệp đính kèm tối đa 5MB, biểu tượng cảm xúc),
// dán / thả ảnh và tệp để gửi, menu ba chấm (xem hồ sơ, chặn, báo cáo). Nút gửi luôn ở góc phải, mờ khi chưa gõ gì.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageReaction } from '@hoiminh/contracts';
import { Avatar, T } from '@hoiminh/ui';
import { ArrowDown, ArrowLeft, Image as ImageIcon, PanelRight, Paperclip, Send, Smile, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { ATTACHMENT_ACCEPT, checkAttachment, deliveryStatus, linksIn, sameGroup, seenLabel } from '@/lib/chat';
import { usePollInterval } from '@/lib/realtime';
import { ChatMenu, ReportDialog } from './MessagesMenus';
import { DayDivider, InfoPanel, MessageItem, replySnippet, type Message, type MessageFile, type Panel, type Person } from './MessagesParts';

interface Thread { items: Message[]; other: Person | null; community: { id: string; name: string; slug: string } | null; panel: Panel | null; pinned: boolean; archived: boolean; blocked: { byMe: boolean; byThem: boolean } }
interface Outgoing { body: string; imageFileId?: string; imageUrl?: string | null; fileId?: string; file?: MessageFile | null; replyTo: Message | null }

const EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😅', '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🎉', '🔥', '❤️', '💯', '✅', '🌹'];
/** Cách đáy dưới ngần này thì coi như đang đọc tin mới nhất: có tin tới sẽ tự cuộn theo. */
const STICK_PX = 80;

export function ThreadView({ id, meId, info, onInfo, onBack, onArchived }: { id: string; meId: string; info: boolean; onInfo: (open: boolean) => void; onBack: () => void; onArchived: () => void }) {
  const qc = useQueryClient();
  const key = useMemo(() => ['thread', id], [id]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [uploading, setUploading] = useState<'' | 'ảnh' | 'tệp'>('');
  const [reporting, setReporting] = useState(false);
  const [problem, setProblem] = useState('');
  const [jump, setJump] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const refetchInterval = usePollInterval(15_000);
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Thread>(`/v1/me/conversations/${id}/messages`), refetchInterval });
  const patch = useCallback((fn: (items: Message[]) => Message[]) => qc.setQueryData<Thread>(key, (d) => (d ? { ...d, items: fn(d.items) } : d)), [qc, key]);
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['conversations'] }); void qc.invalidateQueries({ queryKey: ['badges'] }); };

  // Gửi: tin hiện ngay trong khung với trạng thái "Đang gửi", máy chủ trả lời xong thì thay bằng tin thật.
  const send = useMutation({
    mutationFn: (p: Outgoing) => api.post(`/v1/me/messages`, { conversationId: id, body: p.body, imageFileId: p.imageFileId, fileId: p.fileId, replyToId: p.replyTo?.id }),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: key });
      const tmpId = `tmp-${Date.now()}`;
      const r = p.replyTo;
      stick.current = true;
      patch((items) => [...items, { id: tmpId, senderUserId: meId, body: p.body, imageUrl: p.imageUrl ?? null, automated: false, deliveredAt: null, readAt: null, createdAt: new Date().toISOString(), recalled: false, reactions: {}, replyTo: r ? { id: r.id, senderUserId: r.senderUserId, body: r.body.slice(0, 160), hasImage: Boolean(r.imageUrl), fileName: r.file?.name ?? null, recalled: false } : null, file: p.file ?? null, pending: true }]);
      return { tmpId };
    },
    onError: (err, p, c) => { patch((items) => items.filter((m) => m.id !== c?.tmpId)); setProblem(errorMessage(err)); setText((t) => t || p.body); },
    onSettled: refresh,
  });
  const react = useMutation({
    mutationFn: (p: { messageId: string; emoji: MessageReaction | null }) => api.post(`/v1/me/messages/${p.messageId}/reaction`, { emoji: p.emoji }),
    onMutate: (p) => { patch((items) => items.map((m) => { if (m.id !== p.messageId) return m; const reactions = { ...m.reactions }; if (p.emoji) reactions[meId] = p.emoji; else delete reactions[meId]; return { ...m, reactions }; })); },
    onError: (err) => setProblem(errorMessage(err)),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const recall = useMutation({ mutationFn: (messageId: string) => api.post(`/v1/me/messages/${messageId}/recall`, {}), onError: (err) => setProblem(errorMessage(err)), onSettled: refresh });
  const pin = useMutation({ mutationFn: (pinned: boolean) => api.post(`/v1/me/conversations/${id}/pin`, { pinned }), onError: (err) => setProblem(errorMessage(err)), onSettled: refresh });
  const archive = useMutation({ mutationFn: (archived: boolean) => api.post(`/v1/me/conversations/${id}/archive`, { archived }), onSuccess: (_r, archived) => { if (archived) onArchived(); else refresh(); }, onError: (err) => setProblem(errorMessage(err)) });
  const block = useMutation({ mutationFn: (on: boolean) => (on ? api.post(`/v1/me/users/${q.data?.other?.id}/block`, {}) : api.del(`/v1/me/users/${q.data?.other?.id}/block`)), onError: (err) => setProblem(errorMessage(err)), onSettled: refresh });

  const items = q.data?.items;
  const lastId = items?.at(-1)?.id;
  const toBottom = useCallback(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; stick.current = true; setJump(false); }, []);
  // Có tin mới: đang ở đáy thì cuộn theo, đang đọc tin cũ thì chỉ hiện nút "Tin nhắn mới" để không giật trang.
  useLayoutEffect(() => { if (!lastId) return; if (stick.current) toBottom(); else setJump(true); }, [lastId, toBottom]);
  // Ô nhập tự cao theo nội dung (tối đa khoảng 5 dòng).
  useLayoutEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 132)}px`; }, [text]);
  // Mở hội thoại là máy chủ đánh dấu đã đọc: tải lại danh sách và chấm đỏ trên header để số chưa đọc biến mất ngay.
  const loaded = q.isSuccess;
  useEffect(() => { if (!loaded) return; void qc.invalidateQueries({ queryKey: ['conversations'] }); void qc.invalidateQueries({ queryKey: ['badges'] }); }, [loaded, qc]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1600); return () => clearTimeout(t); }, [flash]);

  const images = useMemo(() => (items ?? []).flatMap((m) => (m.imageUrl && !m.pending ? [m.imageUrl] : [])).reverse(), [items]);
  const files = useMemo(() => (items ?? []).flatMap((m) => (m.file && !m.pending ? [{ id: m.id, ...m.file }] : [])).reverse(), [items]);
  const links = useMemo(() => [...new Set((items ?? []).flatMap((m) => linksIn(m.body)).reverse())], [items]);

  if (q.isLoading) return <section className="chat-main"><div className="p-6"><LoadingBlock /></div></section>;
  if (q.isError || !q.data?.other) return <section className="chat-main"><div className="chat-empty">{q.isError ? errorMessage(q.error) : 'Không mở được hội thoại này'}</div></section>;
  const d = q.data;
  const other = d.other!;
  const firstName = other.name.trim().split(/\s+/).pop() ?? other.name;
  const seen = seenLabel(other.lastSeenAt);

  const submit = () => { const body = text.trim(); if (!body || send.isPending) return; setProblem(''); setEmoji(false); send.mutate({ body, replyTo }); setText(''); setReplyTo(null); };
  const sendImage = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/') || uploading) return;
    setProblem(''); setUploading('ảnh');
    try { const r = await api.upload(file, 'message_image'); send.mutate({ body: text.trim(), imageFileId: r.fileId, imageUrl: r.url, replyTo }); setText(''); setReplyTo(null); }
    catch (err) { setProblem(errorMessage(err)); }
    finally { setUploading(''); }
  };
  // Tệp đính kèm: kiểm loại và giới hạn 5MB ngay tại máy (khỏi tải lên rồi mới bị từ chối); ảnh thì đi đường gửi ảnh.
  const sendFile = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (file.type.startsWith('image/')) return sendImage(file);
    const check = checkAttachment(file);
    if (!check.ok) { setProblem(check.reason); return; }
    setProblem(''); setUploading('tệp');
    try { const r = await api.upload(new File([file], file.name, { type: check.mimeType }), 'message_file'); send.mutate({ body: text.trim(), fileId: r.fileId, file: { name: file.name, sizeBytes: file.size }, replyTo }); setText(''); setReplyTo(null); }
    catch (err) { setProblem(errorMessage(err)); }
    finally { setUploading(''); }
  };
  // Link tải lấy lúc bấm (sống 5 phút) và tải về với tên gốc, trang chat không bị rời đi.
  const download = async (messageId: string) => {
    try { const r = await api.get<{ url: string }>(`/v1/me/messages/${messageId}/file`); window.location.assign(r.url); }
    catch (err) { setProblem(errorMessage(err)); }
  };
  const onBlock = (on: boolean) => { if (!on || window.confirm(`Chặn ${other.name}? Hai bên sẽ không nhắn được cho nhau cho tới khi bạn bỏ chặn.`)) block.mutate(on); };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Máy tính: Enter gửi, Shift+Enter xuống dòng. Điện thoại: Enter xuống dòng, gửi bằng nút (như Zalo). Đang gõ dấu (IME) thì không gửi.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && replyTo) setReplyTo(null);
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); void sendImage(f); } };
  const onDrop = (e: DragEvent<HTMLElement>) => { const f = e.dataTransfer.files[0]; if (f) { e.preventDefault(); void sendFile(f); } };
  const addEmoji = (ch: string) => {
    const el = inputRef.current;
    const at = el ? el.selectionStart : text.length;
    setText(text.slice(0, at) + ch + text.slice(el ? el.selectionEnd : at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + ch.length, at + ch.length); });
  };
  // Chạm (bấm) vào tin để hiện thao tác; thao tác hiện ra có thể làm tin cao thêm, nên đưa cả tin vào tầm nhìn.
  const activate = (messageId: string) => {
    setActive((v) => (v === messageId ? null : messageId));
    requestAnimationFrame(() => document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: 'nearest' }));
  };
  const startReply = (m: Message) => { setReplyTo(m); inputRef.current?.focus(); };
  const jumpTo = (messageId: string) => { const el = document.getElementById(`msg-${messageId}`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(messageId); };
  const onRecall = (m: Message) => { if (window.confirm('Thu hồi tin nhắn này? Cả hai bên sẽ không còn xem được nội dung.')) recall.mutate(m.id); };
  const onScroll = () => { const el = scroller.current; if (!el) return; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX; if (stick.current) setJump(false); };
  const last = d.items.at(-1);
  const lastStatus = last && last.senderUserId === meId && !last.recalled ? deliveryStatus(last) : null;
  const blocked = d.blocked.byMe || d.blocked.byThem;

  return (
    <>
      <section className="chat-main" aria-label={`Hội thoại với ${other.name}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <header className="chat-head">
          <button type="button" className="chat-icon chat-back" aria-label="Về danh sách hội thoại" onClick={onBack}><ArrowLeft size={22} /></button>
          <Avatar name={other.name} src={other.avatarUrl} color={other.coverColor ?? T.ink} size={44} />
          <div className="flex-grow min-w-0">
            <div className="font-bold text-[16px] truncate">{other.name}</div>
            <div className="muted text-[14px] flex items-center gap-1.5 min-w-0">
              {d.panel?.tier && <span className="tag flex-shrink-0" style={{ background: T.goldSoft, color: T.goldText }}>{d.panel.tier.name}</span>}
              <span className="truncate">{seen || d.community?.name || `@${other.handle}`}</span>
            </div>
          </div>
          <button type="button" className={`chat-icon${info ? ' on' : ''}`} aria-label="Thông tin hội thoại" aria-pressed={info} title="Thông tin hội thoại" onClick={() => onInfo(!info)}><PanelRight size={20} /></button>
          <ChatMenu other={other} blockedByMe={d.blocked.byMe} pinned={d.pinned} archived={d.archived} onPin={() => pin.mutate(!d.pinned)} onArchive={() => archive.mutate(!d.archived)} onBlock={onBlock} onReport={() => setReporting(true)} />
        </header>
        <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
          {d.items.length === 0 && <div className="chat-empty">Chưa có tin nhắn nào. Gửi lời chào tới {firstName} nhé.</div>}
          {d.items.map((m, i) => {
            const prev = d.items[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            return (
              <div key={m.id} className="chat-item">
                {newDay && <DayDivider date={m.createdAt} />}
                <MessageItem m={m} mine={m.senderUserId === meId} myId={meId} other={other} first={newDay || !sameGroup(prev, m)} status={m === last ? lastStatus : null} flash={flash === m.id} active={active === m.id} onActivate={() => activate(m.id)}
                  onReply={() => startReply(m)} onReact={(e) => react.mutate({ messageId: m.id, emoji: e })} onRecall={() => onRecall(m)} onJump={jumpTo} onImageLoad={() => { if (stick.current) toBottom(); }} onDownload={() => void download(m.id)} />
              </div>
            );
          })}
        </div>
        {jump && <button type="button" className="chat-jump" onClick={toBottom}><ArrowDown size={16} />Tin nhắn mới</button>}
        <div className="chat-composer">
          {blocked ? (
            <div className="chat-blocked" role="status">
              <span>{d.blocked.byMe ? `Bạn đã chặn ${other.name}. Bỏ chặn để nhắn tin lại.` : 'Bạn không thể nhắn tin cho người này.'}</span>
              {d.blocked.byMe && <button type="button" className="btn btn-ghost btn-sm" disabled={block.isPending} onClick={() => block.mutate(false)}>Bỏ chặn</button>}
              {problem && <span className="w-full text-[14px]" style={{ color: T.accentText }}>{problem}</span>}
            </div>
          ) : (
            <>
            {(problem || uploading) && <div className="px-4 pt-2 text-[14px]" role="status" style={{ color: problem ? T.accentText : T.ink3 }}>{problem || `Đang tải ${uploading} lên…`}</div>}
            {replyTo && (
              <div className="chat-replying">
                <div className="chat-quote flex-grow min-w-0"><b>Trả lời {replyTo.senderUserId === meId ? 'chính bạn' : other.name}</b><span>{replySnippet({ body: replyTo.body, hasImage: Boolean(replyTo.imageUrl), fileName: replyTo.file?.name, recalled: false })}</span></div>
                <button type="button" className="chat-icon" aria-label="Bỏ trả lời" onClick={() => setReplyTo(null)}><X size={18} /></button>
              </div>
            )}
            <div className="chat-tools">
              <button type="button" className="chat-icon" aria-label="Gửi ảnh" title="Gửi ảnh" disabled={Boolean(uploading)} onClick={() => fileRef.current?.click()}><ImageIcon size={20} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void sendImage(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="chat-icon" aria-label="Đính kèm tệp (tối đa 5MB)" title="Đính kèm tệp (tối đa 5MB)" disabled={Boolean(uploading)} onClick={() => docRef.current?.click()}><Paperclip size={20} /></button>
              <input ref={docRef} type="file" accept={ATTACHMENT_ACCEPT} hidden onChange={(e) => { void sendFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className={`chat-icon${emoji ? ' on' : ''}`} aria-label="Chèn biểu tượng cảm xúc" aria-expanded={emoji} title="Biểu tượng cảm xúc" onClick={() => setEmoji((v) => !v)}><Smile size={20} /></button>
              {emoji && <div className="chat-emoji" role="group" aria-label="Biểu tượng cảm xúc">{EMOJIS.map((ch) => <button key={ch} type="button" aria-label={`Chèn ${ch}`} onClick={() => addEmoji(ch)}>{ch}</button>)}</div>}
            </div>
            <div className="chat-inputrow">
              <textarea ref={inputRef} className="chat-input" rows={1} value={text} maxLength={4000} placeholder={`Nhập tin nhắn tới ${firstName}`} aria-label={`Nhập tin nhắn tới ${other.name}`} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} />
              <button type="button" className="chat-send" aria-label="Gửi" title="Gửi (Enter)" disabled={!text.trim() || send.isPending} onClick={submit}><Send size={20} /></button>
            </div>
            </>
          )}
        </div>
      </section>
      {info && <InfoPanel other={other} panel={d.panel} community={d.community} images={images} files={files} links={links} onDownload={(mid) => void download(mid)} onClose={() => onInfo(false)} />}
      <ReportDialog other={other} conversationId={id} open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}
