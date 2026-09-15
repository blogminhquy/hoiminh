// Cài đặt · Chung (generalMain): logo, tên, đường dẫn, mô tả ngắn, danh mục, quy tắc, tên miền riêng, lưu trữ hội.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMMUNITY_CATEGORY_LABELS, toSlug } from '@hoiminh/contracts';
import { Button, CommunityMark, Field, Input, SaveBar, Select, T, Textarea } from '@hoiminh/ui';
import { Check, Globe, Image as ImageIcon, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';

interface About { community: { name: string; slug: string; shortDescription: string; description: string; category: string; rules: string[]; logoUrl: string | null; logoMark: string; logoColor: string; customDomain: string | null; customDomainVerifiedAt: string | null; discoverable: boolean } }
interface Form { name: string; slug: string; shortDescription: string; description: string; category: string; rules: string[]; logoFileId: string | null | undefined; logoUrl: string | null; customDomain: string; discoverable: boolean }

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['about', shell.community.slug], queryFn: () => api.get<About>(`/v1/communities/by-slug/${shell.community.slug}`) });
  const [f, setF] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !f) { const c = q.data.community; setF({ name: c.name, slug: c.slug, shortDescription: c.shortDescription, description: c.description, category: c.category, rules: c.rules, logoFileId: undefined, logoUrl: c.logoUrl, customDomain: c.customDomain ?? '', discoverable: c.discoverable }); } }, [q.data, f]);
  const patch = (p: Partial<Form>) => setF((prev) => (prev ? { ...prev, ...p } : prev));
  const save = useMutation({
    mutationFn: () => api.patch<{ slug: string }>(`/v1/communities/${shell.community.id}/general`, { name: f?.name.trim(), slug: f?.slug, shortDescription: f?.shortDescription.trim(), description: f?.description, category: f?.category, rules: f?.rules.filter((r) => r.trim()), customDomain: f?.customDomain.trim() || null, discoverable: f?.discoverable, ...(f?.logoFileId !== undefined ? { logoFileId: f.logoFileId } : {}) }),
    onSuccess: (c) => { setSaved(true); setTimeout(() => setSaved(false), 2000); void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) }); void qc.invalidateQueries({ queryKey: ['about'] }); if (c.slug !== shell.community.slug) navigate(`/${c.slug}/cai-dat/chung`); },
  });
  const archive = useMutation({ mutationFn: () => api.post(`/v1/communities/${shell.community.id}/archive`, {}), onSuccess: () => navigate('/admin') });
  const onLogo = async (file: File) => { setUploading(true); try { const r = await api.upload(file, 'avatar', { communityId: shell.community.id }); patch({ logoFileId: r.fileId, logoUrl: r.url }); } finally { setUploading(false); } };
  if (!f) return <LoadingBlock rows={5} />;
  return (
    <>
      <SaveBar title="Chung" sub="Tên, đường dẫn, mô tả và quy tắc của cộng đồng" saving={save.isPending} saved={saved} onSave={() => save.mutate()} onCancel={() => setF(null)} />
      {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      <div className="card p-6 flex flex-col gap-[18px]">
        <div className="flex gap-5 items-center">
          <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={f.logoUrl} size={88} radius={20} />
          <div className="flex flex-col gap-2"><span className="font-semibold">Logo</span><div className="flex gap-2"><Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><ImageIcon size={14} />Tải ảnh lên</Button>{f.logoUrl && <Button size="sm" onClick={() => patch({ logoFileId: null, logoUrl: null })}>Xóa</Button>}</div><span className="muted text-[12px]">PNG hoặc JPG, vuông, tối thiểu 256px</span><input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void onLogo(file); e.target.value = ''; }} /></div>
        </div>
        <Field label="Tên cộng đồng"><Input value={f.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Đường dẫn" hint="Người lạ mở link này sẽ thấy trang giới thiệu hội trước, đổi đường dẫn sẽ làm link cũ ngừng hoạt động">
          <div className="flex gap-2 items-center flex-wrap"><div className="input flex-grow" style={{ color: T.ink }}><span className="muted">hoiminh.vn/</span><input value={f.slug} onChange={(e) => patch({ slug: toSlug(e.target.value) })} className="flex-grow min-w-0" />{f.slug === shell.community.slug && <span style={{ color: T.teal }}><Check size={16} /></span>}</div><Link to={`/${shell.community.slug}`} className="btn btn-ghost"><Globe size={16} />Xem trang giới thiệu</Link></div>
        </Field>
        <Field label="Mô tả ngắn" hint="160 ký tự, hiện trên trang Khám phá và thẻ chia sẻ"><Input value={f.shortDescription} maxLength={160} onChange={(e) => patch({ shortDescription: e.target.value })} /></Field>
        <Field label="Giới thiệu đầy đủ" hint="Hiện trên trang giới thiệu hội, hỗ trợ Markdown"><Textarea rows={5} value={f.description} maxLength={5000} onChange={(e) => patch({ description: e.target.value })} /></Field>
        <Field label="Danh mục"><Select value={f.category} onChange={(e) => patch({ category: e.target.value })} style={{ width: 320, maxWidth: '100%' }}>{Object.entries(COMMUNITY_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" checked={f.discoverable} onChange={(e) => patch({ discoverable: e.target.checked })} />Hiện trên trang Khám phá</label>
      </div>
      <div className="card p-6 flex flex-col gap-3">
        <div className="flex items-center"><span className="font-semibold">Quy tắc cộng đồng</span><span className="flex-grow" /><Button size="sm" disabled={f.rules.length >= 10} onClick={() => patch({ rules: [...f.rules, ''] })}><Plus size={14} />Thêm quy tắc</Button></div>
        {f.rules.map((r, i) => <div key={i} className="flex items-center gap-3 px-3.5 py-2 rounded-[10px]" style={{ background: T.bg }}><span className="font-bold" style={{ color: T.ink3 }}>{i + 1}</span><input value={r} maxLength={200} onChange={(e) => patch({ rules: f.rules.map((x, j) => (j === i ? e.target.value : x)) })} className="flex-grow text-[14px] bg-transparent min-w-0" placeholder="Nội dung quy tắc" /><button type="button" aria-label="Xóa" onClick={() => patch({ rules: f.rules.filter((_, j) => j !== i) })} style={{ color: T.ink3 }}><X size={16} /></button></div>)}
      </div>
      <div className="card flex flex-col gap-3.5" style={{ padding: '20px 24px' }}>
        <span className="font-semibold">Nâng cao</span>
        <Field label="Tên miền riêng" hint="Trỏ bản ghi CNAME về app.hoiminh.vn, SSL cấp tự động"><div className="flex gap-2 items-center flex-wrap"><Input value={f.customDomain} onChange={(e) => patch({ customDomain: e.target.value })} placeholder="hoc.tenmien.vn" style={{ width: 320, maxWidth: '100%' }} />{q.data?.community.customDomainVerifiedAt ? <span className="tag" style={{ background: T.tealSoft, color: T.tealText, height: 26 }}><Check size={12} />DNS đã trỏ</span> : f.customDomain ? <span className="tag" style={{ background: T.goldSoft, color: T.goldText, height: 26 }}>Chờ DNS</span> : null}</div></Field>
      </div>
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ border: `1px dashed ${T.line2}` }}><div className="flex-grow"><div className="font-semibold" style={{ color: T.accentText }}>Lưu trữ cộng đồng</div><div className="muted text-[12px]">Ẩn khỏi mọi người, giữ toàn bộ dữ liệu, có thể mở lại</div></div><Button size="sm" style={{ color: T.accentText }} loading={archive.isPending} onClick={() => { if (window.confirm('Lưu trữ hội này? Thành viên sẽ không vào được cho tới khi mở lại.')) archive.mutate(); }}>Lưu trữ</Button></div>
    </>
  );
}
