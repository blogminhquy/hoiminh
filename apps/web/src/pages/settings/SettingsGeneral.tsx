// Cài đặt · Chung (generalMain): logo, ảnh bìa, tên, đường dẫn, mô tả ngắn, danh mục, hội kín hay hội mở, ảnh và video trang giới thiệu, quy tắc, câu hỏi khi tham gia, tên miền riêng (sắp ra mắt ở Gói bổ sung), lưu trữ hội.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMMUNITY_CATEGORY_LABELS, toSlug, type AboutMediaItem, type CommunityVisibility } from '@hoiminh/contracts';
import { Button, CommunityMark, Field, Input, SaveBar, Select, T, Textarea } from '@hoiminh/ui';
import { Check, Globe, Image as ImageIcon, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADDONS_PATH } from '@/lib/addons';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';
import { AboutMediaCard } from './SettingsAboutMedia';
import { JoinQuestionsCard } from './SettingsJoinQuestions';
import { VisibilityPicker } from './SettingsVisibility';

interface About { community: { name: string; slug: string; shortDescription: string; description: string; category: string; rules: string[]; logoUrl: string | null; logoMark: string; logoColor: string; coverUrl: string | null; coverColor: string; coverTagline: string; aboutMedia?: AboutMediaItem[]; customDomain: string | null; customDomainVerifiedAt: string | null; discoverable: boolean; visibility?: CommunityVisibility }; joinQuestions: Array<{ id: string; question: string; required: boolean; sortOrder: number }> }
interface Form { name: string; slug: string; shortDescription: string; description: string; category: string; rules: string[]; logoFileId: string | null | undefined; logoUrl: string | null; coverFileId: string | null | undefined; coverUrl: string | null; discoverable: boolean; visibility: CommunityVisibility }

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['about', shell.community.slug], queryFn: () => api.get<About>(`/v1/communities/by-slug/${shell.community.slug}`) });
  const [f, setF] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !f) { const c = q.data.community; setF({ name: c.name, slug: c.slug, shortDescription: c.shortDescription, description: c.description, category: c.category, rules: c.rules, logoFileId: undefined, logoUrl: c.logoUrl, coverFileId: undefined, coverUrl: c.coverUrl, discoverable: c.discoverable, visibility: c.visibility ?? 'private' }); } }, [q.data, f]);
  const patch = (p: Partial<Form>) => setF((prev) => (prev ? { ...prev, ...p } : prev));
  const save = useMutation({
    mutationFn: () => api.patch<{ slug: string }>(`/v1/communities/${shell.community.id}/general`, { name: f?.name.trim(), slug: f?.slug, shortDescription: f?.shortDescription.trim(), description: f?.description, category: f?.category, rules: f?.rules.filter((r) => r.trim()), discoverable: f?.discoverable, visibility: f?.visibility, ...(f?.logoFileId !== undefined ? { logoFileId: f.logoFileId } : {}), ...(f?.coverFileId !== undefined ? { coverFileId: f.coverFileId } : {}) }),
    onSuccess: (c) => { setSaved(true); setTimeout(() => setSaved(false), 2000); patch({ logoFileId: undefined, coverFileId: undefined }); void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) }); void qc.invalidateQueries({ queryKey: ['about'] }); if (c.slug !== shell.community.slug) navigate(`/${c.slug}/cai-dat/chung`); },
  });
  const domain = q.data?.community.customDomain ?? null;
  const archive = useMutation({ mutationFn: () => api.post(`/v1/communities/${shell.community.id}/archive`, {}), onSuccess: () => navigate('/admin') });
  const onLogo = async (file: File) => { setUploading(true); setUploadError(null); try { const r = await api.upload(file, 'avatar', { communityId: shell.community.id }); if (f?.logoFileId) void api.discardUpload(f.logoFileId); patch({ logoFileId: r.fileId, logoUrl: r.url }); } catch (e) { setUploadError(errorMessage(e)); } finally { setUploading(false); } };
  const onCover = async (file: File) => { setCoverUploading(true); setUploadError(null); try { const r = await api.upload(file, 'cover', { communityId: shell.community.id }); if (f?.coverFileId) void api.discardUpload(f.coverFileId); patch({ coverFileId: r.fileId, coverUrl: r.url }); } catch (e) { setUploadError(errorMessage(e)); } finally { setCoverUploading(false); } };
  // Trang giới thiệu dẫn chủ hội tới thẳng mục ảnh và video (#anh-video).
  const ready = Boolean(f);
  useEffect(() => { if (ready && (hash === '#anh-video' || hash === '#che-do')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }); }, [ready, hash]);
  if (!f) return <LoadingBlock rows={5} />;
  return (
    <>
      <SaveBar title="Chung" sub="Tên, đường dẫn, mô tả và quy tắc của cộng đồng" saving={save.isPending} saved={saved} onSave={() => save.mutate()} onCancel={() => setF(null)} />
      {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      <div className="card p-6 flex flex-col gap-[18px]">
        <div className="flex gap-5 items-center">
          <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={f.logoUrl} size={88} radius={20} />
          <div className="flex flex-col gap-2"><span className="font-semibold">Logo vuông</span><div className="flex gap-2"><Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><ImageIcon size={14} />Tải ảnh lên</Button>{f.logoUrl && <Button size="sm" onClick={() => { if (f.logoFileId) void api.discardUpload(f.logoFileId); patch({ logoFileId: null, logoUrl: null }); }}>Xóa</Button>}</div><span className="muted text-[13px]">Hiện cạnh tên hội ở mọi nơi. PNG hoặc JPG, vuông, tối thiểu 256px</span><input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void onLogo(file); e.target.value = ''; }} /></div>
        </div>
        <div className="flex gap-5 items-center flex-wrap">
          <div className="rounded-[12px] overflow-hidden flex items-end p-3 flex-shrink-0" style={{ width: 240, maxWidth: '100%', aspectRatio: '16 / 9', background: f.coverUrl ? `url(${f.coverUrl}) center/cover` : q.data?.community.coverColor ?? T.teal }}>
            {!f.coverUrl && <span className="serif font-extrabold leading-[1.1] text-[16px]" style={{ color: T.invertInk }}>{q.data?.community.coverTagline || f.name}</span>}
          </div>
          <div className="flex flex-col gap-2 min-w-0" style={{ flex: '1 1 220px' }}><span className="font-semibold">Ảnh bìa</span><div className="flex gap-2"><Button size="sm" loading={coverUploading} onClick={() => coverRef.current?.click()}><ImageIcon size={14} />{f.coverUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}</Button>{f.coverUrl && <Button size="sm" onClick={() => { if (f.coverFileId) void api.discardUpload(f.coverFileId); patch({ coverFileId: null, coverUrl: null }); }}>Xóa</Button>}</div><span className="muted text-[13px]">Hiện trọn, không bị cắt, ở thẻ hội bên phải trang giới thiệu, trên trang Khám phá và trang Tạo hội. Ảnh ngang 16:9, nên từ 1280 x 720px. Chưa có ảnh thì hiện nền màu kèm tên hội hoặc logo.</span><input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void onCover(file); e.target.value = ''; }} /></div>
        </div>
        {uploadError && <div className="text-[13px]" style={{ color: T.accentText }}>{uploadError}</div>}
        <Field label="Tên cộng đồng"><Input value={f.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Đường dẫn" hint="Người lạ mở link này sẽ thấy trang giới thiệu hội trước, đổi đường dẫn sẽ làm link cũ ngừng hoạt động">
          <div className="flex gap-2 items-center flex-wrap"><div className="input flex-grow" style={{ color: T.ink }}><span className="muted">hoiminh.com/</span><input value={f.slug} onChange={(e) => patch({ slug: toSlug(e.target.value) })} className="flex-grow min-w-0" />{f.slug === shell.community.slug && <span style={{ color: T.teal }}><Check size={16} /></span>}</div><Link to={`/${shell.community.slug}`} className="btn btn-ghost"><Globe size={16} />Xem trang giới thiệu</Link></div>
        </Field>
        <Field label="Mô tả ngắn" hint="160 ký tự, hiện trên trang Khám phá và thẻ chia sẻ"><Input value={f.shortDescription} maxLength={160} onChange={(e) => patch({ shortDescription: e.target.value })} /></Field>
        <Field label="Giới thiệu đầy đủ" hint="Hiện trên trang giới thiệu hội, hỗ trợ Markdown"><Textarea rows={5} value={f.description} maxLength={5000} onChange={(e) => patch({ description: e.target.value })} /></Field>
        <Field label="Danh mục"><Select value={f.category} onChange={(e) => patch({ category: e.target.value })} style={{ width: 320, maxWidth: '100%' }}>{Object.entries(COMMUNITY_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <div id="che-do" className="flex flex-col gap-2"><span className="font-semibold text-[13px]">Ai xem được bên trong hội</span><VisibilityPicker value={f.visibility} onChange={(visibility) => patch({ visibility })} /></div>
        <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" checked={f.discoverable} onChange={(e) => patch({ discoverable: e.target.checked })} />Hiện trên trang Khám phá</label>
      </div>
      <AboutMediaCard communityId={shell.community.id} initial={q.data?.community.aboutMedia ?? []} />
      <div className="card p-6 flex flex-col gap-3">
        <div className="flex items-center"><span className="font-semibold">Quy tắc cộng đồng</span><span className="flex-grow" /><Button size="sm" disabled={f.rules.length >= 10} onClick={() => patch({ rules: [...f.rules, ''] })}><Plus size={14} />Thêm quy tắc</Button></div>
        {f.rules.map((r, i) => <div key={i} className="flex items-center gap-3 px-3.5 py-2 rounded-[10px]" style={{ background: T.bg }}><span className="font-bold" style={{ color: T.ink3 }}>{i + 1}</span><input value={r} maxLength={200} onChange={(e) => patch({ rules: f.rules.map((x, j) => (j === i ? e.target.value : x)) })} className="flex-grow text-[14px] bg-transparent min-w-0" placeholder="Nội dung quy tắc" /><button type="button" aria-label="Xóa" onClick={() => patch({ rules: f.rules.filter((_, j) => j !== i) })} style={{ color: T.ink3 }}><X size={16} /></button></div>)}
      </div>
      <JoinQuestionsCard communityId={shell.community.id} slug={shell.community.slug} initial={q.data?.joinQuestions ?? []} />
      <div className="card flex flex-col gap-3.5" style={{ padding: '20px 24px' }}>
        <span className="font-semibold">Nâng cao</span>
        {/* Tên miền riêng đã rời khỏi các gói, thành gói bổ sung đang sắp ra mắt (chủ dự án chốt ngày 23/11/2026): chưa gắn
            được tên miền mới. Hội đã gắn tên miền từ trước vẫn giữ và thấy tên miền đó ở đây. */}
        <Field label="Tên miền riêng" hint="Tên miền riêng sắp ra mắt ở Gói bổ sung. Khi ra mắt, bạn mua và gắn tên miền của bạn ngay tại đó.">
          <div className="flex gap-2 items-center flex-wrap" data-testid="custom-domain-soon">
            {domain ? <span className="font-semibold text-[15px]" style={{ color: T.ink }}>{domain}</span> : null}
            {domain && q.data?.community.customDomainVerifiedAt ? <span className="tag" style={{ background: T.tealSoft, color: T.tealText, height: 26 }}><Check size={12} />DNS đã trỏ</span> : null}
            <span className="tag" style={{ background: T.goldSoft, color: T.goldText, height: 26 }}>Sắp ra mắt</span>
            {shell.viewer.role === 'owner' && <Link to={`${ADDONS_PATH}?hoi=${shell.community.slug}`} className="btn btn-ghost btn-sm">Xem Gói bổ sung</Link>}
          </div>
        </Field>
      </div>
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ border: `1px dashed ${T.line2}` }}><div className="flex-grow"><div className="font-semibold" style={{ color: T.accentText }}>Lưu trữ cộng đồng</div><div className="muted text-[12px]">Ẩn khỏi mọi người, giữ toàn bộ dữ liệu, có thể mở lại</div></div><Button size="sm" style={{ color: T.accentText }} loading={archive.isPending} onClick={() => { if (window.confirm('Lưu trữ hội này? Thành viên sẽ không vào được cho tới khi mở lại.')) archive.mutate(); }}>Lưu trữ</Button></div>
    </>
  );
}
