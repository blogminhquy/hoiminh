// Tin nhắn (kiểu Zalo): ba cột liền nhau lấp đầy màn hình. Trái là danh sách hội thoại (tìm, lọc, ghim), giữa là khung chat,
// phải là "Thông tin hội thoại". Điện thoại: vào thấy danh sách trước, chạm một hội thoại mới mở khung chat (có nút quay lại).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePollInterval } from '@/lib/realtime';
import { ConvoRow, type Conversation } from './MessagesParts';
import { ThreadView } from './MessagesThread';

interface ConvoList { items: Conversation[]; unreadConversations: number }
type Filter = 'all' | 'unread' | 'automated';

/** Dưới bề rộng này (điện thoại, máy tính bảng dọc) mỗi lúc chỉ hiện một màn: danh sách hoặc khung chat. Khớp với styles.css. */
const MOBILE = '(max-width: 1023px)';
/** Từ bề rộng này bảng thông tin đứng thành cột thứ ba; hẹp hơn thì nó trượt đè lên khung chat, nên mặc định đóng. */
const WIDE = '(min-width: 1536px)';

function useMedia(query: string): boolean {
  return useSyncExternalStore((l) => { const m = window.matchMedia(query); m.addEventListener('change', l); return () => m.removeEventListener('change', l); }, () => window.matchMedia(query).matches, () => false);
}

/**
 * Cho khung chat lấp đầy đúng phần màn hình còn lại dưới header, ở mọi khung trang (hội, khu học tập, chưa có hội):
 * đo lề của vùng nội dung để tràn ra sát mép, đo vị trí đỉnh và thanh tab dưới (điện thoại) để tính chiều cao.
 * Chiều cao tính bằng CSS (100dvh trừ các số đo này) nên thanh địa chỉ điện thoại co giãn không cần đo lại.
 */
function useFillViewport(ref: RefObject<HTMLElement>, dep: unknown): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const measure = () => {
      const cs = getComputedStyle(parent);
      const tabs = document.querySelector<HTMLElement>('.mobile-tabs');
      const set = (k: string, v: string) => { if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };
      set('--chat-pt', cs.paddingTop); set('--chat-pr', cs.paddingRight); set('--chat-pb', cs.paddingBottom); set('--chat-pl', cs.paddingLeft);
      set('--chat-top', `${Math.round(parent.getBoundingClientRect().top + window.scrollY)}px`);
      set('--chat-bottom', `${tabs && getComputedStyle(tabs).display !== 'none' ? tabs.offsetHeight : 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref, dep]);
}

export default function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [info, setInfo] = useState(() => window.matchMedia(WIDE).matches);
  const mobile = useMedia(MOBILE);
  const wide = useMedia(WIDE);
  // Thu hẹp cửa sổ xuống dưới 1536px thì bảng thông tin sẽ đè lên khung chat: tự đóng lại, cần thì bấm mở.
  useEffect(() => { if (!wide) setInfo(false); }, [wide]);
  const frame = useRef<HTMLDivElement>(null);
  const refetchInterval = usePollInterval(15_000);
  const q = useQuery({ queryKey: ['conversations', filter, search], queryFn: () => api.get<ConvoList>(`/v1/me/conversations?filter=${filter}${search ? `&q=${encodeURIComponent(search)}` : ''}`), refetchInterval });
  const open = sp.get('c');
  // Máy tính mở sẵn hội thoại đầu tiên. Điện thoại thì không: mở sẵn sẽ che mất danh sách và tự đánh dấu "đã đọc" tin chưa xem.
  // Giữ nguyên hội thoại đã mở sẵn: có tin mới hay ghim làm đổi thứ tự danh sách thì khung chat không tự nhảy sang người khác.
  const [auto, setAuto] = useState<string | null>(null);
  const firstId = q.data?.items[0]?.id ?? null;
  useEffect(() => { if (!auto && firstId) setAuto(firstId); }, [auto, firstId]);
  const selected = open ?? (mobile ? null : auto ?? firstId);
  const select = (id: string | null) => setSp(id ? { c: id } : {}, { replace: !id });
  /** Hội thoại vừa lưu trữ biến khỏi danh sách: về danh sách (điện thoại) hoặc mở hội thoại kế tiếp (máy tính). */
  const leave = (id: string) => { setAuto(q.data?.items.find((c) => c.id !== id)?.id ?? null); if (id === open) select(null); };
  useFillViewport(frame, open);
  const reload = () => void qc.invalidateQueries({ queryKey: ['conversations'] });
  const pin = useMutation({ mutationFn: (c: Conversation) => api.post(`/v1/me/conversations/${c.id}/pin`, { pinned: !c.pinned }), onSuccess: (_r, c) => { reload(); void qc.invalidateQueries({ queryKey: ['thread', c.id] }); } });
  const archive = useMutation({ mutationFn: (c: Conversation) => api.post(`/v1/me/conversations/${c.id}/archive`, {}), onSuccess: (_r, c) => { reload(); if (c.id === selected) leave(c.id); } });
  const tab = (key: Filter, label: string) => <button type="button" role="tab" aria-selected={filter === key} className={`chat-tab${filter === key ? ' on' : ''}`} onClick={() => setFilter(key)}>{label}</button>;
  return (
    <div ref={frame} className={`chat-page${open ? ' open' : ''}`}>
      <section className="chat-list" aria-label="Danh sách hội thoại">
        <div className="flex flex-col gap-3 px-4 pt-4">
          <h1 className="serif m-0 text-[22px] font-extrabold">Tin nhắn</h1>
          <label className="input" style={{ height: 40, background: 'var(--bg)', borderColor: 'transparent' }}><Search size={18} style={{ color: 'var(--ink3)' }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm hội thoại theo tên" className="flex-grow min-w-0" /></label>
        </div>
        <div className="chat-tabs" role="tablist" aria-label="Lọc hội thoại">
          {tab('all', 'Tất cả')}
          {tab('unread', `Chưa đọc${q.data?.unreadConversations ? ` (${q.data.unreadConversations})` : ''}`)}
          {tab('automated', 'Tự động')}
        </div>
        <div className="chat-convos">
          <QueryState q={q} rows={4} isEmpty={(d) => d.items.length === 0} empty={filter === 'all' && !search ? { title: 'Chưa có tin nhắn', hint: 'Nhắn cho thành viên từ trang hồ sơ hoặc danh sách thành viên' } : { title: 'Không có hội thoại nào khớp', hint: 'Thử bỏ bộ lọc hoặc đổi từ khóa tìm kiếm' }}>
            {(d) => <>{d.items.map((c) => <ConvoRow key={c.id} c={c} on={c.id === selected} onClick={() => select(c.id)} onPin={() => pin.mutate(c)} onArchive={() => archive.mutate(c)} />)}</>}
          </QueryState>
        </div>
      </section>
      {selected && user
        ? <ThreadView key={selected} id={selected} meId={user.id} info={info} onInfo={setInfo} onBack={() => select(null)} onArchived={() => { reload(); leave(selected); }} />
        : <section className="chat-main"><div className="chat-empty"><MessageCircle size={40} strokeWidth={1.5} /><span>Chọn một hội thoại để bắt đầu nhắn tin</span></div></section>}
    </div>
  );
}
