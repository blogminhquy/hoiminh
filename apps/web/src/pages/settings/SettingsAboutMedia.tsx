// Cài đặt · Chung: bộ ảnh và video của trang giới thiệu hội. Bố cục giống chính trang giới thiệu: một khung to
// hiện mục đang chọn, bên dưới là hàng ảnh nhỏ, cuối hàng là hai ô thêm ảnh và thêm video.
// Đổi thứ tự bằng cách nhấn giữ một ảnh nhỏ rồi kéo thả. Mỗi thay đổi lưu ngay (PUT /about-media).
import { ABOUT_MEDIA_MAX, type AboutMediaItem } from '@hoiminh/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, T } from '@hoiminh/ui';
import { ImagePlus, Pencil, Play, Trash2, Video } from 'lucide-react';
import { useRef, useState } from 'react';
import { VIDEO_SOURCES, videoInfo } from '@/lib/about-media';
import { api, errorMessage } from '@/lib/api';
import { moveItem, positionAfterMove, useDragSort } from '@/lib/use-drag-sort';

const toPayload = (rows: AboutMediaItem[]) => ({ items: rows.map((r) => (r.kind === 'image' ? { kind: 'image' as const, fileId: r.fileId } : { kind: 'video' as const, url: r.url })) });
/** Ảnh nhỏ tự chia đều theo bề ngang: điện thoại 3 ô một dòng, máy tính 7 đến 8 ô. */
const THUMB = { width: '100%', aspectRatio: '16 / 9' } as const;

export function AboutMediaCard({ communityId, initial }: { communityId: string; initial: AboutMediaItem[] }) {
  const qc = useQueryClient();
  const addRef = useRef<HTMLInputElement>(null);
  const swapRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AboutMediaItem[]>(initial);
  /** Vị trí mục đang hiện ở khung to. Chọn theo vị trí vì id của mục mới chỉ có sau khi lưu. */
  const [sel, setSel] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  /** Ô dán link đang mở để thêm video mới ('add') hay sửa link của video đang chọn ('edit'). */
  const [linkMode, setLinkMode] = useState<'add' | 'edit' | null>(null);

  const save = useMutation({ mutationFn: (next: AboutMediaItem[]) => api.put<{ items: AboutMediaItem[] }>(`/v1/communities/${communityId}/about-media`, toPayload(next)) });
  const busy = uploading || save.isPending;
  const full = rows.length >= ABOUT_MEDIA_MAX;
  const at = Math.min(sel, Math.max(0, rows.length - 1));
  const cur = rows[at];
  const closeLink = () => { setLinkMode(null); setLink(''); };
  const select = (i: number) => { setSel(i); closeLink(); setError(null); };

  /** Hiện thay đổi ngay rồi lưu; lưu hỏng thì trả danh sách và mục đang chọn về như cũ, bỏ các ảnh vừa tải lên. */
  const commit = async (next: AboutMediaItem[], nextSel: number, uploadedFileIds: string[] = []): Promise<boolean> => {
    const prev = rows;
    const prevSel = at;
    setError(null);
    setRows(next);
    setSel(nextSel);
    try {
      const r = await save.mutateAsync(next);
      setRows(r.items);
      setSel(Math.min(nextSel, Math.max(0, r.items.length - 1)));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      void qc.invalidateQueries({ queryKey: ['about'] });
      return true;
    } catch (e) {
      setRows(prev);
      setSel(prevSel);
      setError(errorMessage(e));
      for (const id of uploadedFileIds) void api.discardUpload(id);
      return false;
    }
  };

  /** Tải từng ảnh; ảnh nào hỏng thì dừng ở đó, các ảnh đã xong vẫn được dùng. `failed` là lý do của ảnh hỏng. */
  const upload = async (list: File[]): Promise<{ done: AboutMediaItem[]; failed: string | null }> => {
    const done: AboutMediaItem[] = [];
    let failed: string | null = null;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        const r = await api.upload(file, 'cover', { communityId });
        if (r.url) done.push({ id: `moi-${r.fileId}`, kind: 'image', url: r.url, fileId: r.fileId });
      }
    } catch (e) {
      failed = errorMessage(e);
    } finally {
      setUploading(false);
    }
    return { done, failed };
  };

  const onAddImages = async (list: File[]) => {
    closeLink();
    const room = ABOUT_MEDIA_MAX - rows.length;
    const { done, failed } = await upload(list.slice(0, room));
    // Thêm xong thì khung to hiện ngay ảnh đầu tiên vừa thêm.
    const ok = done.length ? await commit([...rows, ...done], rows.length, done.map((a) => a.fileId!)) : true;
    if (!ok) return;
    if (failed) setError(list.length > 1 ? `Đã thêm ${done.length}/${Math.min(list.length, room)} ảnh. Ảnh tiếp theo không tải lên được: ${failed}` : failed);
    else if (list.length > room) setError(`Chỉ thêm được ${room} ảnh nữa, tối đa ${ABOUT_MEDIA_MAX} ảnh và video.`);
  };

  const onSwapImage = async (file: File) => {
    const i = at;
    const { done: [fresh], failed } = await upload([file]);
    if (fresh) await commit(rows.map((r, k) => (k === i ? fresh : r)), i, [fresh.fileId!]);
    else if (failed) setError(failed);
  };

  const onSubmitLink = async () => {
    const url = link.trim();
    if (!url) return;
    if (!videoInfo(url)) { setError(`Link này chưa nhận diện được. Dán link ${VIDEO_SOURCES}.`); return; }
    const editing = linkMode === 'edit' && cur?.kind === 'video';
    const next = editing ? rows.map((r, k) => (k === at ? { ...r, url } : r)) : [...rows, { id: `moi-${Date.now()}`, kind: 'video' as const, url, fileId: null }];
    if (await commit(next, editing ? at : rows.length)) closeLink();
  };

  /** Đưa mục ở vị trí `from` tới `to` (kéo thả, hoặc Shift + phím mũi tên). Khung to đi theo mục vừa chuyển. */
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || to === from) return;
    closeLink();
    void commit(moveItem(rows, from, to), to);
  };
  const sort = useDragSort({ count: rows.length, disabled: busy, onDrop: moveTo });

  const remove = () => {
    if (!cur) return;
    if (!window.confirm(cur.kind === 'image' ? 'Xóa ảnh này khỏi trang giới thiệu?' : 'Xóa video này khỏi trang giới thiệu?')) return;
    closeLink();
    void commit(rows.filter((_, k) => k !== at), Math.max(0, Math.min(at, rows.length - 2)));
  };

  const nameOf = (r: AboutMediaItem, i: number) => `${r.kind === 'image' ? 'ảnh' : 'video'} số ${i + 1}`;
  const curVideo = cur?.kind === 'video' ? videoInfo(cur.url) : null;
  const curName = cur ? nameOf(cur, at) : '';
  const tool = 'inline-flex items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold disabled:opacity-40 whitespace-nowrap';
  const toolStyle = { height: 40, padding: '0 12px', background: T.surface, color: T.ink, boxShadow: '0 2px 10px rgba(0,0,0,0.25)' };
  const dragging = sort.drag ? rows[sort.drag.from] : undefined;
  const dragBg = dragging ? (dragging.kind === 'image' ? dragging.url : videoInfo(dragging.url)?.thumb ?? null) : null;
  const addTile = 'rounded-[10px] flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold leading-tight disabled:opacity-40';
  const addTileStyle = { ...THUMB, border: `1.5px dashed ${T.line2}`, color: T.ink2 };

  return (
    <div id="anh-video" className="card p-4 sm:p-6 flex flex-col gap-3.5" style={{ scrollMarginTop: 16 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-[16px]">Ảnh và video trang giới thiệu</span>
        {saved && <span className="text-[14px] font-semibold" style={{ color: T.teal }}>Đã lưu</span>}
        <span className="flex-grow" />
        <span className="muted text-[14px]">{rows.length}/{ABOUT_MEDIA_MAX}</span>
      </div>
      <span className="muted text-[14px] leading-[1.6]">Người lạ mở link hội sẽ thấy đúng khung này, mục số 1 hiện đầu. Ảnh ngang 16:9 là đẹp nhất. Thay đổi ở đây được lưu ngay.</span>

      {/* Khung to: mục đang chọn, hiện như người xem sẽ thấy. */}
      <div className="relative overflow-hidden rounded-[14px] flex items-center justify-center" style={{ aspectRatio: '16 / 9', backgroundColor: cur ? T.side : T.bg, backgroundImage: curVideo?.thumb ? `url(${curVideo.thumb})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', border: cur ? undefined : `1.5px dashed ${T.line2}` }}>
        {!cur && (
          <div className="flex flex-col items-center gap-3 text-center px-5">
            <span className="text-[15px] leading-[1.6]" style={{ color: T.ink2, maxWidth: 420 }}>Chưa có ảnh hay video nào, trang giới thiệu đang hiện nền màu và ảnh bìa khóa học. Thêm vài ảnh chụp bên trong hội và một video ngắn để người mới dễ quyết định tham gia hơn.</span>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="primary" loading={uploading} disabled={busy} icon={<ImagePlus size={16} />} onClick={() => addRef.current?.click()}>Thêm ảnh</Button>
              <Button disabled={busy} icon={<Video size={16} />} onClick={() => { setLinkMode('add'); setLink(''); setError(null); }}>Thêm video</Button>
            </div>
          </div>
        )}
        {cur?.kind === 'image' && <img src={cur.url} alt={`Xem trước ${curName}`} className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain' }} />}
        {cur?.kind === 'video' && (
          <>
            <span className="relative inline-flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: T.primary, color: T.onPrimary, boxShadow: '0 6px 24px rgba(0,0,0,0.3)' }}><Play size={28} /></span>
            <span className="absolute right-3 bottom-3 rounded-[8px] text-[13px] font-semibold" style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{curVideo?.label ?? 'Video'}</span>
          </>
        )}
        {cur && <span className="absolute left-3 top-3 rounded-full text-[13px] font-bold" style={{ padding: '4px 10px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{at + 1}/{rows.length}</span>}
        {cur && (
          <div className="absolute right-3 top-3 flex gap-2">
            <button type="button" className={tool} style={toolStyle} disabled={busy} aria-label={cur.kind === 'image' ? `Đổi ${curName}` : `Sửa link ${curName}`} onClick={() => { if (cur.kind === 'image') { closeLink(); swapRef.current?.click(); } else { setLinkMode('edit'); setLink(cur.url); setError(null); } }}><Pencil size={16} />{cur.kind === 'image' ? 'Đổi ảnh' : 'Sửa link'}</button>
            <button type="button" className={tool} style={{ ...toolStyle, color: T.accentText }} disabled={busy} aria-label={`Xóa ${curName}`} onClick={remove}><Trash2 size={16} />Xóa</button>
          </div>
        )}
        {uploading && <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>Đang tải ảnh lên…</span>}
      </div>

      {/* Hàng ảnh nhỏ: bấm để chọn, nhấn giữ rồi kéo để đổi thứ tự; hai ô cuối để thêm. */}
      {rows.length > 0 && (
        <div ref={sort.container} className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
          {rows.map((r, i) => {
            const bg = r.kind === 'image' ? r.url : videoInfo(r.url)?.thumb ?? null;
            const held = sort.drag?.from === i;
            const shown = sort.drag ? positionAfterMove(i, sort.drag.from, sort.drag.over) : i;
            return (
              <button
                key={r.id} type="button" {...sort.itemProps(i)}
                aria-label={`Chọn ${nameOf(r, i)}`} aria-current={i === at ? 'true' : undefined} aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
                title={rows.length > 1 ? 'Nhấn giữ rồi kéo để đổi thứ tự' : undefined}
                onClick={() => { if (!sort.wasDragged()) select(i); }}
                onKeyDown={(e) => { if (!e.shiftKey || busy) return; if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(i, i - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(i, i + 1); } }}
                className="relative rounded-[10px] flex items-center justify-center"
                style={{ ...THUMB, ...sort.itemStyle(i), backgroundColor: T.side, backgroundImage: bg ? `url(${bg})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', opacity: held ? 0.3 : i === at || sort.drag ? 1 : 0.65, outline: held ? `2px dashed ${T.ink2}` : i === at && !sort.drag ? `2px solid ${T.ink}` : undefined, outlineOffset: 2 }}
              >
                <span className="absolute left-1 top-1 inline-flex items-center justify-center rounded-full text-[12px] font-bold" style={{ minWidth: 20, height: 20, padding: '0 5px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{shown + 1}</span>
                {r.kind === 'video' && <span className="inline-flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: 'rgba(0,0,0,0.6)', color: '#fff' }}><Play size={13} /></span>}
              </button>
            );
          })}
          <button type="button" className={addTile} style={{ ...addTileStyle, order: rows.length }} disabled={busy || full} onClick={() => addRef.current?.click()}><ImagePlus size={18} />Thêm ảnh</button>
          <button type="button" className={addTile} style={{ ...addTileStyle, order: rows.length + 1 }} disabled={busy || full} onClick={() => { setLinkMode('add'); setLink(''); setError(null); }}><Video size={18} />Thêm video</button>
        </div>
      )}
      {rows.length > 1 && <span className="muted text-[13px]">Nhấn giữ một ảnh nhỏ rồi kéo để đổi thứ tự.</span>}
      {/* Bản sao của ô đang kéo, đi theo ngón tay hoặc con trỏ. */}
      {sort.drag && (
        <div aria-hidden className="rounded-[10px] flex items-center justify-center" style={{ position: 'fixed', left: sort.drag.x - sort.drag.width / 2, top: sort.drag.y - sort.drag.height / 2, width: sort.drag.width, height: sort.drag.height, zIndex: 1000, pointerEvents: 'none', transform: 'scale(1.08)', backgroundColor: T.side, backgroundImage: dragBg ? `url(${dragBg})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.35)', outline: `2px solid ${T.surface}` }}>
          {dragging?.kind === 'video' && <span className="inline-flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: 'rgba(0,0,0,0.6)', color: '#fff' }}><Play size={13} /></span>}
        </div>
      )}

      <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const list = [...(e.target.files ?? [])]; e.target.value = ''; if (list.length) void onAddImages(list); }} />
      <input ref={swapRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void onSwapImage(file); }} />

      {linkMode && (
        <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: T.bg }}>
          <span className="text-[14px] font-semibold">{linkMode === 'edit' ? `Sửa link ${curName}` : 'Thêm video bằng link'}</span>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="min-w-0" style={{ flex: '1 1 240px' }}><Input autoFocus left={<Video size={16} style={{ color: T.ink3 }} />} value={link} placeholder="Dán link video, ví dụ youtube.com/watch?v=…" aria-label="Link video" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onSubmitLink(); } }} /></div>
            <Button variant="dark" loading={save.isPending} disabled={busy || !link.trim()} onClick={() => void onSubmitLink()}>{linkMode === 'edit' ? 'Cập nhật link' : 'Thêm'}</Button>
            <Button disabled={busy} onClick={() => { closeLink(); setError(null); }}>Thôi</Button>
          </div>
          <span className="muted text-[13px]">Video không tải tệp lên mà dùng link: {VIDEO_SOURCES}.</span>
        </div>
      )}
      {error && <span className="text-[14px]" style={{ color: T.accentText }}>{error}</span>}
    </div>
  );
}
