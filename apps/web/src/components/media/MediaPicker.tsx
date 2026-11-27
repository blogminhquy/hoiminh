// Khung chọn dùng chung cho ô bình luận và ô chat: ba tab Nhãn dán, Emoji, GIF (tab GIF chỉ hiện khi hệ thống đã có
// khóa GIPHY). Tab nào cũng có mục "Gần đây" ở đầu. Hàng nút dưới đáy nhảy nhanh tới từng bộ nhãn / nhóm emoji, như Zalo.
// Máy tính: bảng nổi cạnh ô soạn (mở lên trên nếu đủ chỗ, không thì mở xuống). Điện thoại: bảng trượt từ đáy màn hình.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { Clock, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { EMOJI_GROUPS } from './emoji-data';
import { pushRecent, readRecent } from './recent';
import { useStickers } from './stickers';
import type { GifItem, PickedMedia, Sticker } from './types';

export type PickerTab = 'sticker' | 'emoji' | 'gif';

const WIDTH = 344;
const HEIGHT = 400;

/** Vị trí bảng trên máy tính, tính theo nút đã mở nó. Điện thoại để CSS lo (bảng trượt từ đáy). */
function placeNear(anchor: HTMLElement | null): CSSProperties | undefined {
  if (!anchor || !window.matchMedia('(min-width: 768px)').matches) return undefined;
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8));
  return r.top - HEIGHT - 8 >= 8 ? { left, top: r.top - HEIGHT - 6 } : { left, top: Math.min(r.bottom + 6, window.innerHeight - HEIGHT - 8) };
}

export function MediaPicker({ tab, onTab, anchor, onEmoji, onPick, onClose }: { tab: PickerTab; onTab: (t: PickerTab) => void; anchor: HTMLElement | null; onEmoji?: (ch: string) => void; onPick: (m: PickedMedia) => void; onClose: () => void }) {
  const stickers = useStickers();
  const gifOn = Boolean(stickers.data?.gifEnabled);
  const [pos, setPos] = useState<CSSProperties | undefined>(() => placeNear(anchor));
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => setPos(placeNear(anchor)), [anchor]);
  // Esc đóng bảng; bắt ở pha capture và chặn lại để trong khung bật lên của bài viết, Esc không đóng luôn khung bài.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', onKey, true);
    // Máy tính: bảng nằm theo vị trí nút, đổi cỡ cửa sổ thì đóng cho khỏi lệch chỗ.
    const onResize = () => { if (window.matchMedia('(min-width: 768px)').matches) close.current(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); };
  }, []);
  useEffect(() => { if (tab === 'gif' && stickers.isSuccess && !gifOn) onTab('sticker'); }, [tab, gifOn, stickers.isSuccess, onTab]);

  const tabs: Array<[PickerTab, string]> = [['sticker', 'Nhãn dán'], ['emoji', 'Emoji'], ...(gifOn ? [['gif', 'GIF'] as [PickerTab, string]] : [])];
  return (
    <>
      <button type="button" className="media-picker-backdrop" aria-label="Đóng bảng chọn" onClick={onClose} />
      <div ref={panel} className="media-picker" role="dialog" aria-label="Chọn nhãn dán, emoji hoặc GIF" style={pos}>
        <div className="media-picker-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>{label}</button>
          ))}
          <button type="button" className="media-picker-close" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        {tab === 'sticker' && <StickerTab loading={stickers.isLoading} error={stickers.isError ? errorMessage(stickers.error) : ''} packs={stickers.data?.packs ?? []} gifOn={gifOn} onPick={(s) => onPick({ kind: 'sticker', sticker: s })} />}
        {tab === 'emoji' && <EmojiTab onEmoji={(ch) => onEmoji?.(ch)} />}
        {tab === 'gif' && gifOn && <GifTab onPick={(g) => onPick({ kind: 'gif', gif: g })} />}
      </div>
    </>
  );
}

/** Thân tab có hàng nút nhảy nhanh dưới đáy. */
function Scroller({ top, sections, nav }: { top?: ReactNode; sections: Array<{ key: string; title: string; body: ReactNode }>; nav: Array<{ key: string; label: string; icon: ReactNode }> }) {
  const box = useRef<HTMLDivElement>(null);
  const jump = (key: string) => box.current?.querySelector<HTMLElement>(`[data-sec="${key}"]`)?.scrollIntoView({ block: 'start' });
  return (
    <>
      <div ref={box} className="media-picker-body">
        {top}
        {sections.map((s) => (
          <section key={s.key} data-sec={s.key}>
            <div className="media-picker-sec">{s.title}</div>
            {s.body}
          </section>
        ))}
      </div>
      {nav.length > 1 && (
        <div className="media-picker-nav">
          {nav.map((n) => <button key={n.key} type="button" aria-label={n.label} title={n.label} onClick={() => jump(n.key)}>{n.icon}</button>)}
        </div>
      )}
    </>
  );
}

/** Nhãn GIPHY đổi về dạng nhãn chung; id có tiền tố "giphy:" để lúc gửi biết đây là nhãn của GIPHY. */
const fromGiphy = (g: GifItem): Sticker => ({ id: `giphy:${g.id}`, url: g.url, keywords: [], width: g.width, height: g.height });

function useGiphy(type: 'gifs' | 'stickers', q: string, enabled = true) {
  return useQuery({ queryKey: ['giphy', type, q], queryFn: () => api.get<{ enabled: boolean; items: GifItem[] }>(`/v1/gifs?type=${type}&q=${encodeURIComponent(q)}`), staleTime: 5 * 60_000, enabled });
}

/** Ô tìm có đợi người dùng ngừng gõ một chút rồi mới tìm, đỡ tốn lượt gọi GIPHY. */
function useDebounced(text: string, ms = 400) {
  const [v, setV] = useState('');
  useEffect(() => { const t = setTimeout(() => setV(text.trim()), ms); return () => clearTimeout(t); }, [text, ms]);
  return v;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="gif-search">
      <Search size={18} style={{ color: T.ink3 }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" aria-label="Xóa ô tìm" onClick={() => onChange('')}><X size={16} /></button>}
    </label>
  );
}

function StickerGrid({ list, onPick }: { list: Sticker[]; onPick: (s: Sticker) => void }) {
  return (
    <div className="sticker-grid">
      {list.map((s, i) => <button key={s.id} type="button" aria-label={`Gửi nhãn ${s.keywords[0] ?? i + 1}`} onClick={() => onPick(s)}><img src={s.url} alt="" loading="lazy" draggable={false} /></button>)}
    </div>
  );
}

function StickerTab({ packs, loading, error, gifOn, onPick }: { packs: Array<{ id: string; name: string; stickers: Sticker[] }>; loading: boolean; error: string; gifOn: boolean; onPick: (s: Sticker) => void }) {
  const [recent, setRecent] = useState(() => readRecent('sticker'));
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const giphy = useGiphy('stickers', q, gifOn);
  // Nhãn gần đây mà bộ đã bị tắt hay nhãn đã bị xóa thì không hiện nữa (nhãn GIPHY thì luôn giữ).
  const live = useMemo(() => new Map(packs.flatMap((p) => p.stickers).map((s) => [s.id, s])), [packs]);
  const recentLive = recent.map((r) => (r.id.startsWith('giphy:') ? r : live.get(r.id))).filter((s): s is Sticker => Boolean(s));
  const pick = (s: Sticker) => { setRecent(pushRecent('sticker', s)); onPick(s); };
  const giphyList = (giphy.data?.items ?? []).map(fromGiphy);
  const giphyBody = giphy.isLoading ? <div className="media-picker-empty">Đang tải nhãn GIPHY…</div> : giphy.isError ? <div className="media-picker-empty">{errorMessage(giphy.error)}</div> : giphyList.length ? <><StickerGrid list={giphyList} onPick={pick} /><div className="gif-credit">Nhãn động từ GIPHY</div></> : <div className="media-picker-empty">Không có nhãn nào, thử từ khác</div>;

  if (q) {
    return <div className="media-picker-body"><SearchBox value={text} onChange={setText} placeholder="Tìm nhãn dán" /><div className="media-picker-sec">Kết quả cho “{q}”</div>{giphyBody}</div>;
  }
  if (loading) return <div className="media-picker-body media-picker-empty">Đang tải nhãn dán…</div>;
  if (error) return <div className="media-picker-body media-picker-empty">{error}</div>;
  const sections = [
    ...(recentLive.length ? [{ key: 'recent', title: 'Gần đây', body: <StickerGrid list={recentLive} onPick={pick} /> }] : []),
    ...packs.map((p) => ({ key: p.id, title: p.name, body: <StickerGrid list={p.stickers} onPick={pick} /> })),
    ...(gifOn ? [{ key: 'giphy', title: 'Thịnh hành trên GIPHY', body: giphyBody }] : []),
  ];
  if (!sections.length) return <div className="media-picker-body media-picker-empty">Chưa có bộ nhãn nào</div>;
  const nav = [
    ...(recentLive.length ? [{ key: 'recent', label: 'Gần đây', icon: <Clock size={20} /> }] : []),
    ...packs.map((p) => ({ key: p.id, label: p.name, icon: <img src={p.stickers[0]!.url} alt="" /> })),
    ...(gifOn ? [{ key: 'giphy', label: 'GIPHY', icon: <span className="media-picker-giphy">GIPHY</span> }] : []),
  ];
  return <Scroller top={gifOn ? <SearchBox value={text} onChange={setText} placeholder="Tìm nhãn dán" /> : null} sections={sections} nav={nav} />;
}

function EmojiTab({ onEmoji }: { onEmoji: (ch: string) => void }) {
  const [recent, setRecent] = useState(() => readRecent('emoji'));
  const pick = (ch: string) => { setRecent(pushRecent('emoji', ch)); onEmoji(ch); };
  const grid = (list: string[]) => <div className="emoji-grid">{list.map((ch) => <button key={ch} type="button" aria-label={`Chèn ${ch}`} onClick={() => pick(ch)}>{ch}</button>)}</div>;
  const sections = [...(recent.length ? [{ key: 'recent', title: 'Gần đây', body: grid(recent) }] : []), ...EMOJI_GROUPS.map((g) => ({ key: g.key, title: g.label, body: grid(g.items) }))];
  const nav = [...(recent.length ? [{ key: 'recent', label: 'Gần đây', icon: <Clock size={20} /> }] : []), ...EMOJI_GROUPS.map((g) => ({ key: g.key, label: g.label, icon: <span className="text-[20px] leading-none">{g.icon}</span> }))];
  return <Scroller sections={sections} nav={nav} />;
}

function GifTab({ onPick }: { onPick: (g: GifItem) => void }) {
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const [recent, setRecent] = useState(() => readRecent('gif'));
  const res = useGiphy('gifs', q);
  const pick = (g: GifItem) => { setRecent(pushRecent('gif', g)); onPick(g); };
  const grid = (list: GifItem[]) => (
    <div className="gif-grid">
      {list.map((g) => <button key={g.id} type="button" aria-label={`Gửi GIF ${g.title || g.id}`} onClick={() => pick(g)}><img src={g.previewUrl} alt="" loading="lazy" style={{ aspectRatio: `${g.width} / ${g.height}` }} /></button>)}
    </div>
  );
  return (
    <div className="media-picker-body">
      <SearchBox value={text} onChange={setText} placeholder="Tìm GIF" />
      {!q && recent.length > 0 && <><div className="media-picker-sec">Gần đây</div>{grid(recent)}</>}
      <div className="media-picker-sec">{q ? `Kết quả cho “${q}”` : 'Thịnh hành'}</div>
      {res.isLoading && <div className="media-picker-empty">Đang tìm GIF…</div>}
      {res.isError && <div className="media-picker-empty">{errorMessage(res.error)}</div>}
      {res.data && res.data.items.length === 0 && <div className="media-picker-empty">Không có GIF nào, thử từ khác</div>}
      {res.data && grid(res.data.items)}
      <div className="gif-credit">Ảnh động từ GIPHY</div>
    </div>
  );
}
