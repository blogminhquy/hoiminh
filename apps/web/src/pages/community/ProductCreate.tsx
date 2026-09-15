// Cửa hàng · Tạo / sửa sản phẩm số và combo. Sản phẩm loại khóa học vẫn tạo từ màn Tạo khóa học.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AVATAR_COLORS, Button, Field, Input, T, Textarea } from '@hoiminh/ui';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { BundlePicker, DigitalFiles, KindPicker, MoneyInput, type Draft, type StoreItem, type UploadedFile } from './ProductCreateParts';

const EMPTY: Draft = { kind: 'digital', name: '', shortDescription: '', coverColor: '#C89B3C', priceMinor: 199_000, compareAtMinor: null, status: 'published', digitalFileIds: [], bundleItemProductIds: [] };

export default function Page() {
  const shell = useShell();
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const communityId = shell.community.id;
  const slug = shell.community.slug;

  const list = useQuery({ queryKey: ['products', communityId, 'all', ''], queryFn: () => api.get<{ items: StoreItem[] }>(`/v1/communities/${communityId}/products`) });
  const editingId = productSlug ? (list.data?.items.find((p) => p.slug === productSlug)?.id ?? null) : null;
  const existing = useQuery({ queryKey: ['product', editingId], queryFn: () => api.get<StoreItem & Draft>(`/v1/products/${editingId}`), enabled: Boolean(editingId) });

  const [f, setF] = useState<Draft | null>(productSlug ? null : EMPTY);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  useEffect(() => {
    if (!productSlug || f || !existing.data) return;
    const d = existing.data;
    setF({ kind: d.kind === 'bundle' ? 'bundle' : 'digital', name: d.name, shortDescription: d.shortDescription, coverColor: d.coverColor, priceMinor: d.priceMinor, compareAtMinor: d.compareAtMinor ?? null, status: d.status === 'draft' ? 'draft' : 'published', digitalFileIds: d.digitalFileIds ?? [], bundleItemProductIds: (d.bundleItems ?? []).map((b) => b.id) });
  }, [productSlug, f, existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f!, shortDescription: f!.shortDescription.trim(), name: f!.name.trim() };
      return editingId ? api.patch(`/v1/products/${editingId}`, body) : api.post(`/v1/communities/${communityId}/products`, body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['products', communityId] }); navigate(`/${slug}/cua-hang`); },
  });

  if (!f) return <LoadingBlock rows={5} />;
  const patch = (p: Partial<Draft>) => setF({ ...f, ...p });
  const needFiles = f.kind === 'digital' && f.digitalFileIds.length === 0;
  const needItems = f.kind === 'bundle' && f.bundleItemProductIds.length < 2;
  const ok = f.name.trim().length >= 3 && f.priceMinor >= 0 && !needFiles && !needItems;

  return (
    <div className="two-col">
      <div className="main flex flex-col gap-5">
        <Link to={`/${slug}/cua-hang`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: T.ink2 }}><ChevronLeft size={16} />Cửa hàng</Link>
        <h1 className="page-title serif m-0 text-[28px] font-extrabold">{editingId ? 'Sửa sản phẩm' : 'Sản phẩm mới'}</h1>

        {!editingId && <KindPicker value={f.kind} onChange={(kind) => patch({ kind })} />}

        <div className="card p-6 flex flex-col gap-[18px]">
          <Field label="Tên sản phẩm"><Input value={f.name} maxLength={120} placeholder={f.kind === 'digital' ? '120 prompt viết bài bán hàng' : 'Combo trọn bộ khởi nghiệp'} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Mô tả ngắn" hint="Một hai dòng hiện trên thẻ sản phẩm ở Cửa hàng">
            <Textarea rows={2} value={f.shortDescription} maxLength={200} placeholder="Dùng ngay với ChatGPT, Claude hoặc Gemini. Cập nhật miễn phí." onChange={(e) => patch({ shortDescription: e.target.value })} />
          </Field>
          <Field label="Màu bìa">
            <div className="flex gap-1.5 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Màu bìa ${c}`} onClick={() => patch({ coverColor: c })} className="rounded-lg" style={{ width: 34, height: 34, background: c, border: c === f.coverColor ? `2px solid ${T.ink}` : '2px solid transparent', outline: c === f.coverColor ? `2px solid ${T.surface}` : undefined, outlineOffset: -4 }} />
              ))}
            </div>
          </Field>
          <div className="grid-2">
            <Field label="Giá bán"><MoneyInput value={f.priceMinor} onChange={(v) => patch({ priceMinor: v ?? 0 })} /></Field>
            <Field label="Giá gốc" hint="Để trống nếu không muốn hiện giá gạch"><MoneyInput value={f.compareAtMinor} nullable onChange={(compareAtMinor) => patch({ compareAtMinor })} /></Field>
          </div>
        </div>

        {f.kind === 'digital' ? (
          <DigitalFiles
            communityId={communityId}
            files={files}
            fileIds={f.digitalFileIds}
            onChange={(ids, list2) => { patch({ digitalFileIds: ids }); setFiles(list2); }}
          />
        ) : (
          <BundlePicker
            items={(list.data?.items ?? []).filter((p) => p.id !== editingId && p.kind !== 'bundle')}
            selected={f.bundleItemProductIds}
            onToggle={(id) => patch({ bundleItemProductIds: f.bundleItemProductIds.includes(id) ? f.bundleItemProductIds.filter((x) => x !== id) : [...f.bundleItemProductIds, id] })}
          />
        )}

        {save.isError && <div className="text-[13px] px-4 py-3 rounded-[10px]" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(save.error)}</div>}
      </div>

      <aside className="rail flex flex-col gap-3.5">
        <div className="card p-5 flex flex-col gap-3">
          <span className="font-semibold">Đăng bán</span>
          <label className="flex items-center gap-2.5 text-[14px]"><input type="radio" checked={f.status === 'published'} onChange={() => patch({ status: 'published' })} />Đăng ngay lên Cửa hàng</label>
          <label className="flex items-center gap-2.5 text-[14px]"><input type="radio" checked={f.status === 'draft'} onChange={() => patch({ status: 'draft' })} />Lưu nháp, chỉ mình thấy</label>
          {needFiles && <span className="text-[12px]" style={{ color: T.accentText }}>Sản phẩm số cần ít nhất một tệp.</span>}
          {needItems && <span className="text-[12px]" style={{ color: T.accentText }}>Combo cần ít nhất hai sản phẩm.</span>}
          <Button variant="primary" block loading={save.isPending} disabled={!ok} onClick={() => save.mutate()}>{editingId ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</Button>
        </div>
      </aside>
    </div>
  );
}
