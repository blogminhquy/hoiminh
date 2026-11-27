// Hệ thống · Nhãn dán (/he-thong/nhan-dan): các bộ nhãn dán dùng chung cho mọi hội, hiện trong tab Nhãn dán của ô bình luận
// và ô chat (chủ dự án yêu cầu ngày 27/11/2026). Tạo bộ, đổi tên, bật tắt, đổi thứ tự, xóa bộ; kéo thả hoặc chọn nhiều ảnh
// một lúc để thêm nhãn (GIF, WebP động giữ nguyên chuyển động; PNG nền trong cũng được); gõ từ khóa gợi ý cho từng nhãn
// (gõ đúng từ đó ở ô bình luận, ô chat thì nhãn hiện lên để chọn, như Zalo). Chữ tối thiểu 16px cho dễ đọc trên điện thoại.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, T, Tag } from '@hoiminh/ui';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';

interface AdminSticker { id: string; url: string; keywords: string[] }
interface AdminPack { id: string; name: string; active: boolean; stickers: AdminSticker[] }

const KEY = ['admin', 'sticker-packs'];
const ACCEPT = 'image/gif,image/webp,image/png,image/jpeg';

function useRefresh() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ['stickers'] }); };
}

/** Đổi chỗ phần tử i với phần tử i+dir, trả mảng id mới. */
const moved = <X extends { id: string }>(list: X[], i: number, dir: -1 | 1) => {
  const ids = list.map((x) => x.id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return ids;
};

/** Từ khóa gõ cách nhau bằng dấu phẩy. */
const parseKeywords = (s: string) => s.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);

function StickerCard({ s, i, list, packId, onError }: { s: AdminSticker; i: number; list: AdminSticker[]; packId: string; onError: (m: string) => void }) {
  const refresh = useRefresh();
  const [kw, setKw] = useState(s.keywords.join(', '));
  const save = useMutation({ mutationFn: (keywords: string[]) => api.patch(`/v1/admin/stickers/${s.id}`, { keywords }), onSuccess: refresh, onError: (e) => onError(errorMessage(e)) });
  const del = useMutation({ mutationFn: () => api.del(`/v1/admin/stickers/${s.id}`), onSuccess: refresh, onError: (e) => onError(errorMessage(e)) });
  const move = useMutation({ mutationFn: (ids: string[]) => api.post(`/v1/admin/sticker-packs/${packId}/reorder`, { ids }), onSuccess: refresh, onError: (e) => onError(errorMessage(e)) });
  const dirty = kw.trim() !== s.keywords.join(', ');
  const commit = () => { if (dirty) save.mutate(parseKeywords(kw)); };
  return (
    <div className="admin-sticker">
      <img src={s.url} alt={s.keywords[0] ?? 'Nhãn dán'} loading="lazy" />
      <input value={kw} onChange={(e) => setKw(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} placeholder="Từ khóa, cách nhau dấu phẩy" aria-label={`Từ khóa gợi ý của nhãn thứ ${i + 1}`} />
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Chuyển lên trước" disabled={i === 0 || move.isPending} onClick={() => { const ids = moved(list, i, -1); if (ids) move.mutate(ids); }}><ArrowLeft size={18} /></button>
        <button type="button" aria-label="Chuyển ra sau" disabled={i === list.length - 1 || move.isPending} onClick={() => { const ids = moved(list, i, 1); if (ids) move.mutate(ids); }}><ArrowRight size={18} /></button>
        <span className="flex-grow text-[14px]" style={{ color: save.isPending ? T.ink3 : T.tealText }}>{save.isPending ? 'Đang lưu…' : save.isSuccess && !dirty ? 'Đã lưu' : ''}</span>
        <button type="button" aria-label="Xóa nhãn" disabled={del.isPending} style={{ color: T.accentText }} onClick={() => { if (window.confirm('Xóa nhãn này? Bình luận, tin nhắn đã gửi nhãn này vẫn giữ nguyên.')) del.mutate(); }}><Trash2 size={18} /></button>
      </div>
    </div>
  );
}

function PackCard({ p, i, packs }: { p: AdminPack; i: number; packs: AdminPack[] }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(i === 0);
  const [name, setName] = useState(p.name);
  const [problem, setProblem] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const update = useMutation({ mutationFn: (body: { name?: string; active?: boolean }) => api.patch(`/v1/admin/sticker-packs/${p.id}`, body), onSuccess: refresh, onError: (e) => setProblem(errorMessage(e)) });
  const del = useMutation({ mutationFn: () => api.del(`/v1/admin/sticker-packs/${p.id}`), onSuccess: refresh, onError: (e) => setProblem(errorMessage(e)) });
  const move = useMutation({ mutationFn: (ids: string[]) => api.post('/v1/admin/sticker-packs/reorder', { ids }), onSuccess: refresh, onError: (e) => setProblem(errorMessage(e)) });

  // Tải lần lượt từng ảnh (để báo tiến độ và không dồn một lúc), xong thì thêm cả loạt vào bộ.
  const upload = async (list: FileList | File[]) => {
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    if (!files.length || progress) return;
    setProblem(''); setOpen(true);
    const items: Array<{ fileId: string; keywords: string[] }> = [];
    try {
      for (const [n, f] of files.entries()) {
        setProgress({ done: n, total: files.length });
        const r = await api.upload(f, 'sticker');
        items.push({ fileId: r.fileId, keywords: [] });
      }
      for (let k = 0; k < items.length; k += 60) await api.post(`/v1/admin/sticker-packs/${p.id}/stickers`, { items: items.slice(k, k + 60) });
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setProgress(null);
      refresh();
    }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); };

  return (
    <section className="card p-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" className="inline-flex items-center gap-2 min-w-0" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${open ? 'Thu gọn' : 'Mở'} bộ ${p.name}`}>
          {p.stickers[0] ? <img src={p.stickers[0].url} alt="" className="w-12 h-12 object-contain" /> : <span className="w-12 h-12 rounded-xl" style={{ background: T.bg }} />}
          <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
        <div className="flex-grow min-w-[180px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== p.name) update.mutate({ name: name.trim() }); }} aria-label="Tên bộ nhãn" style={{ fontSize: 16 }} />
        </div>
        <span className="text-[16px] muted">{p.stickers.length} nhãn</span>
        {p.active ? <Tag tone="teal">Đang bật</Tag> : <Tag>Đang tắt</Tag>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button icon={p.active ? <EyeOff size={18} /> : <Eye size={18} />} loading={update.isPending} onClick={() => update.mutate({ active: !p.active })} style={{ fontSize: 16 }}>{p.active ? 'Tắt bộ' : 'Bật bộ'}</Button>
        <Button icon={<ArrowUp size={18} />} disabled={i === 0 || move.isPending} onClick={() => { const ids = moved(packs, i, -1); if (ids) move.mutate(ids); }} aria-label="Đưa bộ lên trước" />
        <Button icon={<ArrowDown size={18} />} disabled={i === packs.length - 1 || move.isPending} onClick={() => { const ids = moved(packs, i, 1); if (ids) move.mutate(ids); }} aria-label="Đưa bộ ra sau" />
        <span className="flex-grow" />
        <Button icon={<Trash2 size={18} />} loading={del.isPending} onClick={() => { if (window.confirm(`Xóa cả bộ "${p.name}" (${p.stickers.length} nhãn)? Bình luận, tin nhắn đã gửi vẫn giữ nhãn.`)) del.mutate(); }} style={{ fontSize: 16, color: T.accentText }}>Xóa bộ</Button>
      </div>
      {problem && <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: T.accentSoft, color: T.accentText }}>{problem}</div>}
      {open && (
        <>
          <label className={`admin-sticker-drop${drag ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            <Upload size={22} />
            <span className="text-[16px] font-semibold">{progress ? `Đang tải ${progress.done + 1}/${progress.total}…` : 'Kéo thả ảnh vào đây, hoặc bấm để chọn nhiều ảnh'}</span>
            <span className="text-[15px] muted">GIF, WebP động giữ nguyên chuyển động. PNG nền trong cũng được. Nên dùng ảnh vuông khoảng 240 đến 512px.</span>
            <input type="file" accept={ACCEPT} multiple hidden disabled={Boolean(progress)} onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
          </label>
          {p.stickers.length > 0 && <div className="admin-sticker-grid">{p.stickers.map((s, n) => <StickerCard key={s.id} s={s} i={n} list={p.stickers} packId={p.id} onError={setProblem} />)}</div>}
        </>
      )}
    </section>
  );
}

export default function Page() {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<{ packs: AdminPack[] }>('/v1/admin/sticker-packs') });
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => api.post('/v1/admin/sticker-packs', { name: name.trim() }), onSuccess: () => { setName(''); refresh(); } });
  return (
    <div className="flex flex-col gap-5 max-w-[960px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="serif m-0 text-[28px] font-extrabold">Nhãn dán</h1>
        <p className="m-0 muted text-[16px] leading-relaxed">Các bộ nhãn dán dùng chung cho mọi hội, hiện ở tab Nhãn dán trong ô bình luận và ô chat. Từ khóa gợi ý: người dùng gõ đúng từ đó (có dấu hay không dấu đều được) thì nhãn hiện lên để chọn nhanh. Chỉ tải lên nhãn anh có quyền sử dụng.</p>
      </div>
      <form className="card p-4 md:p-5 flex items-center gap-3 flex-wrap" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <div className="flex-grow min-w-[220px]"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ nhãn mới" aria-label="Tên bộ nhãn mới" maxLength={60} style={{ fontSize: 16 }} /></div>
        <Button type="submit" variant="primary" icon={<Plus size={18} />} loading={create.isPending} disabled={!name.trim()} style={{ fontSize: 16, minHeight: 48 }}>Tạo bộ nhãn</Button>
        {create.isError && <span className="w-full text-[16px]" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
      </form>
      <QueryState q={q} rows={3} isEmpty={(d) => d.packs.length === 0} empty={{ title: 'Chưa có bộ nhãn nào', hint: 'Tạo một bộ rồi kéo thả ảnh vào' }}>
        {(d) => <>{d.packs.map((p, i) => <PackCard key={p.id} p={p} i={i} packs={d.packs} />)}</>}
      </QueryState>
    </div>
  );
}
