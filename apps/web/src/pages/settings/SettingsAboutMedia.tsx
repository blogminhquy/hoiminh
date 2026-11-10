// Cài đặt · Chung: bộ ảnh và video của trang giới thiệu hội. Thêm, đổi, xóa, xếp thứ tự; mỗi thay đổi lưu ngay (PUT /about-media).
import { ABOUT_MEDIA_MAX, type AboutMediaItem } from '@hoiminh/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, T } from '@hoiminh/ui';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Play, Trash2, Video } from 'lucide-react';
import { useRef, useState } from 'react';
import { VIDEO_SOURCES, videoInfo } from '@/lib/about-media';
import { api, errorMessage } from '@/lib/api';

const toPayload = (rows: AboutMediaItem[]) => ({ items: rows.map((r) => (r.kind === 'image' ? { kind: 'image' as const, fileId: r.fileId } : { kind: 'video' as const, url: r.url })) });

export function AboutMediaCard({ communityId, initial }: { communityId: string; initial: AboutMediaItem[] }) {
  const qc = useQueryClient();
  const addRef = useRef<HTMLInputElement>(null);
  const swapRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AboutMediaItem[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  /** id của video đang sửa link; null là đang thêm video mới. */
  const [editing, setEditing] = useState<string | null>(null);
  /** id của ảnh đang chờ chọn tệp thay thế. */
  const [swapping, setSwapping] = useState<string | null>(null);

  const save = useMutation({ mutationFn: (next: AboutMediaItem[]) => api.put<{ items: AboutMediaItem[] }>(`/v1/communities/${communityId}/about-media`, toPayload(next)) });
  const busy = uploading || save.isPending;
  const full = rows.length >= ABOUT_MEDIA_MAX;

  /** Hiện thay đổi ngay rồi lưu; lưu hỏng thì trả danh sách về như cũ và bỏ các ảnh vừa tải lên. */
  const commit = async (next: AboutMediaItem[], uploadedFileIds: string[] = []): Promise<boolean> => {
    const prev = rows;
    setError(null);
    setRows(next);
    try {
      const r = await save.mutateAsync(next);
      setRows(r.items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      void qc.invalidateQueries({ queryKey: ['about'] });
      return true;
    } catch (e) {
      setRows(prev);
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
    const room = ABOUT_MEDIA_MAX - rows.length;
    const { done, failed } = await upload(list.slice(0, room));
    const ok = done.length ? await commit([...rows, ...done], done.map((a) => a.fileId!)) : true;
    if (!ok) return;
    if (failed) setError(list.length > 1 ? `Đã thêm ${done.length}/${Math.min(list.length, room)} ảnh. Ảnh tiếp theo không tải lên được: ${failed}` : failed);
    else if (list.length > room) setError(`Chỉ thêm được ${room} ảnh nữa, tối đa ${ABOUT_MEDIA_MAX} ảnh và video.`);
  };

  const onSwapImage = async (file: File) => {
    const id = swapping;
    setSwapping(null);
    if (!id) return;
    const { done: [fresh], failed } = await upload([file]);
    if (fresh) await commit(rows.map((r) => (r.id === id ? fresh : r)), [fresh.fileId!]);
    else if (failed) setError(failed);
  };

  const onSubmitLink = async () => {
    const url = link.trim();
    if (!url) return;
    if (!videoInfo(url)) { setError(`Link này chưa nhận diện được. Dán link ${VIDEO_SOURCES}.`); return; }
    const next = editing ? rows.map((r) => (r.id === editing ? { ...r, url } : r)) : [...rows, { id: `moi-${Date.now()}`, kind: 'video' as const, url, fileId: null }];
    if (await commit(next)) { setLink(''); setEditing(null); }
  };

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void commit(next);
  };

  const remove = (r: AboutMediaItem) => {
    if (!window.confirm(r.kind === 'image' ? 'Xóa ảnh này khỏi trang giới thiệu?' : 'Xóa video này khỏi trang giới thiệu?')) return;
    if (editing === r.id) { setEditing(null); setLink(''); }
    void commit(rows.filter((x) => x.id !== r.id));
  };

  const iconBtn = 'inline-flex items-center justify-center rounded-[8px] flex-1 disabled:opacity-40';
  return (
    <div id="anh-video" className="card p-4 sm:p-6 flex flex-col gap-3.5" style={{ scrollMarginTop: 16 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-[16px]">Ảnh và video trang giới thiệu</span>
        {saved && <span className="text-[14px] font-semibold" style={{ color: T.teal }}>Đã lưu</span>}
        <span className="flex-grow" />
        <span className="muted text-[14px]">{rows.length}/{ABOUT_MEDIA_MAX}</span>
      </div>
      <span className="muted text-[14px] leading-[1.6]">Người lạ mở link hội sẽ thấy các ảnh và video này trước tiên, mục số 1 hiện đầu. Ảnh ngang 16:9 là đẹp nhất. Thay đổi ở đây được lưu ngay.</span>

      {rows.length === 0 && (
        <div className="rounded-[12px] px-4 py-5 text-[14px] leading-[1.6]" style={{ border: `1px dashed ${T.line2}`, color: T.ink2 }}>
          Chưa có ảnh hay video nào, trang giới thiệu đang hiện nền màu và ảnh bìa khóa học. Thêm vài ảnh chụp bên trong hội và một video ngắn để người mới dễ quyết định tham gia hơn.
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map((r, i) => {
            const v = r.kind === 'video' ? videoInfo(r.url) : null;
            const bg = r.kind === 'image' ? r.url : v?.thumb ?? null;
            const name = `${r.kind === 'image' ? 'ảnh' : 'video'} số ${i + 1}`;
            return (
              <div key={r.id} className="flex flex-col gap-1.5 min-w-0">
                <div className="relative rounded-[10px] overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16 / 9', backgroundColor: T.side, backgroundImage: bg ? `url(${bg})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', outline: editing === r.id ? `2px solid ${T.primary}` : undefined, outlineOffset: 2 }}>
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center justify-center rounded-full text-[13px] font-bold" style={{ minWidth: 24, height: 24, padding: '0 6px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{i + 1}</span>
                  {r.kind === 'video' && (
                    <>
                      <span className="inline-flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: 'rgba(0,0,0,0.6)', color: '#fff' }}><Play size={18} /></span>
                      <span className="absolute right-1.5 bottom-1.5 rounded-[6px] text-[12px] font-semibold" style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{v?.label ?? 'Video'}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <button type="button" className={iconBtn} style={{ height: 36, background: T.bg, color: T.ink2 }} disabled={busy || i === 0} aria-label={`Đưa ${name} lên trước`} onClick={() => move(i, -1)}><ChevronLeft size={18} /></button>
                  <button type="button" className={iconBtn} style={{ height: 36, background: T.bg, color: T.ink2 }} disabled={busy || i === rows.length - 1} aria-label={`Đưa ${name} ra sau`} onClick={() => move(i, 1)}><ChevronRight size={18} /></button>
                  <button type="button" className={iconBtn} style={{ height: 36, background: T.bg, color: T.ink2 }} disabled={busy} aria-label={r.kind === 'image' ? `Đổi ${name}` : `Sửa link ${name}`} onClick={() => { if (r.kind === 'image') { setSwapping(r.id); swapRef.current?.click(); } else { setEditing(r.id); setLink(r.url); setError(null); } }}><Pencil size={16} /></button>
                  <button type="button" className={iconBtn} style={{ height: 36, background: T.bg, color: T.accentText }} disabled={busy} aria-label={`Xóa ${name}`} onClick={() => remove(r)}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const list = [...(e.target.files ?? [])]; e.target.value = ''; if (list.length) void onAddImages(list); }} />
      <input ref={swapRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void onSwapImage(file); else setSwapping(null); }} />

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex"><Button loading={uploading} disabled={busy || full} icon={<ImageIcon size={16} />} onClick={() => addRef.current?.click()}>Thêm ảnh</Button></div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="min-w-0" style={{ flex: '1 1 240px' }}><Input left={<Video size={16} style={{ color: T.ink3 }} />} value={link} placeholder="Dán link video, ví dụ youtube.com/watch?v=…" aria-label="Link video" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onSubmitLink(); } }} /></div>
          <Button variant="dark" loading={save.isPending && !uploading} disabled={busy || !link.trim() || (full && !editing)} onClick={() => void onSubmitLink()}>{editing ? 'Cập nhật link' : 'Thêm video'}</Button>
          {editing && <Button disabled={busy} onClick={() => { setEditing(null); setLink(''); setError(null); }}>Thôi</Button>}
        </div>
        <span className="muted text-[13px]">Video không tải tệp lên mà dùng link: {VIDEO_SOURCES}.</span>
      </div>
      {error && <span className="text-[14px]" style={{ color: T.accentText }}>{error}</span>}
    </div>
  );
}
