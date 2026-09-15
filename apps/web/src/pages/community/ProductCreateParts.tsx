// Khối con màn Sản phẩm mới: chọn loại, ô nhập tiền, tải tệp sản phẩm số, chọn sản phẩm trong combo.
import { Button, T, money } from '@hoiminh/ui';
import { Check, FileText, Package, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fmtBytes } from '@/lib/format';

export interface Draft {
  kind: 'digital' | 'bundle';
  name: string;
  shortDescription: string;
  coverColor: string;
  priceMinor: number;
  compareAtMinor: number | null;
  status: 'draft' | 'published';
  digitalFileIds: string[];
  bundleItemProductIds: string[];
}
export interface StoreItem { id: string; slug: string; kind: string; name: string; priceMinor: number; coverColor: string; status: string; bundleItems?: Array<{ id: string }>; digitalFileIds?: string[]; shortDescription: string; compareAtMinor: number | null }
export interface UploadedFile { id: string; name: string; sizeBytes: number }

const KINDS: Array<{ key: Draft['kind']; label: string; hint: string; icon: typeof FileText }> = [
  { key: 'digital', label: 'Sản phẩm số', hint: 'PDF, template, bộ prompt — người mua tải về ngay', icon: FileText },
  { key: 'bundle', label: 'Combo', hint: 'Gộp nhiều khóa học hoặc tài liệu, bán một giá', icon: Package },
];

export function KindPicker({ value, onChange }: { value: Draft['kind']; onChange: (k: Draft['kind']) => void }) {
  return (
    <div className="grid-2">
      {KINDS.map((k) => {
        const Icon = k.icon;
        const on = value === k.key;
        return (
          <button key={k.key} type="button" onClick={() => onChange(k.key)} className="card p-5 flex gap-3.5 items-start text-left" style={{ borderColor: on ? T.ink : T.line, borderWidth: on ? 2 : 1 }}>
            <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: on ? T.ink : T.bg, color: on ? T.surface : T.ink2 }}><Icon size={20} /></span>
            <span className="flex flex-col gap-1 min-w-0">
              <span className="font-semibold">{k.label}</span>
              <span className="muted text-[12px] leading-[1.5]">{k.hint}</span>
            </span>
            {on && <Check size={18} style={{ color: T.teal }} />}
          </button>
        );
      })}
    </div>
  );
}

/** Ô nhập tiền VND, hiện nghìn có dấu chấm. */
export function MoneyInput({ value, onChange, nullable }: { value: number | null; onChange: (v: number | null) => void; nullable?: boolean }) {
  const show = value === null ? '' : value.toLocaleString('vi-VN');
  return (
    <div className="input" style={{ color: T.ink }}>
      <input
        inputMode="numeric"
        value={show}
        placeholder={nullable ? 'Không có' : '0'}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits === '' ? (nullable ? null : 0) : Number(digits));
        }}
        className="flex-grow min-w-0"
      />
      <span className="muted font-medium">đ</span>
    </div>
  );
}

export function DigitalFiles({ communityId, files, fileIds, onChange }: { communityId: string; files: UploadedFile[]; fileIds: string[]; onChange: (ids: string[], files: UploadedFile[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const added: UploadedFile[] = [];
      for (const file of Array.from(list).slice(0, 20 - fileIds.length)) {
        const r = await api.upload(file, 'digital_product', { communityId });
        added.push({ id: r.fileId, name: file.name, sizeBytes: file.size });
      }
      onChange([...fileIds, ...added.map((a) => a.id)], [...files, ...added]);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const known = new Map(files.map((f) => [f.id, f]));
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">Tệp người mua tải về</span>
        <span className="muted text-[12px]">tối đa 20 tệp</span>
        <span className="flex-grow" />
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
          <Plus size={14} />{busy ? 'Đang tải…' : 'Thêm tệp'}
          <input type="file" multiple hidden disabled={busy} onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {fileIds.length === 0 && <span className="muted text-[13px]">Chưa có tệp nào. Người mua sẽ thấy đúng những tệp bạn tải lên đây, qua link ký hạn 15 phút.</span>}
      {fileIds.map((id) => {
        const f = known.get(id);
        return (
          <div key={id} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px]" style={{ background: T.bg }}>
            <FileText size={16} style={{ color: T.ink3 }} />
            <span className="flex-grow truncate text-[13px] font-medium">{f?.name ?? 'Tệp đã tải lên trước đó'}</span>
            {f?.sizeBytes ? <span className="muted text-[12px]">{fmtBytes(f.sizeBytes)}</span> : null}
            <button type="button" aria-label="Bỏ tệp" style={{ color: T.ink3 }} onClick={() => onChange(fileIds.filter((x) => x !== id), files.filter((x) => x.id !== id))}><X size={16} /></button>
          </div>
        );
      })}
      {err && <span className="text-[13px]" style={{ color: T.accentText }}>{err}</span>}
    </div>
  );
}

export function BundlePicker({ items, selected, onToggle }: { items: StoreItem[]; selected: string[]; onToggle: (id: string) => void }) {
  const total = items.filter((i) => selected.includes(i.id)).reduce((s, i) => s + i.priceMinor, 0);
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">Sản phẩm trong combo</span>
        <span className="flex-grow" />
        {selected.length > 0 && <span className="muted text-[13px]">Tổng giá lẻ {money(total)}</span>}
      </div>
      {items.length === 0 && <span className="muted text-[13px]">Chưa có sản phẩm lẻ nào để gộp. Tạo khóa học hoặc tài liệu trước.</span>}
      {items.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} type="button" onClick={() => onToggle(p.id)} className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left" style={{ background: on ? T.tealSoft : T.bg }}>
            <span className="w-8 h-8 rounded-md flex-shrink-0" style={{ background: p.coverColor }} />
            <span className="flex-grow min-w-0"><span className="block font-medium text-[14px] truncate">{p.name}</span><span className="muted text-[12px]">{money(p.priceMinor)}</span></span>
            {on && <Check size={18} style={{ color: T.tealText }} />}
          </button>
        );
      })}
      {selected.length === 1 && <span className="text-[12px]" style={{ color: T.accentText }}>Chọn thêm ít nhất một sản phẩm nữa.</span>}
      <Button size="sm" className="self-start" disabled>{selected.length} sản phẩm đã chọn</Button>
    </div>
  );
}
