// Mảnh trang bán (productDetailMain): rail giá + CTA, tải tệp sản phẩm số đã mua, thẻ Premium, combo chứa, link cộng sự; khối lợi ích, giáo trình, FAQ.
import { useQuery } from '@tanstack/react-query';
import { Avatar, T, money } from '@hoiminh/ui';
import { BadgeCheck, Check, ChevronDown, ChevronRight, Clock, Copy, Download, FileText, Link as LinkIcon, Lock, MessageCircle, Play, QrCode, ShieldCheck, Sparkles, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { fmtBytes, fmtDuration } from '@/lib/format';

export interface CurriculumModule { id: string; title: string; lessons: Array<{ id: string; title: string; durationSeconds: number | null; isPreview: boolean; kind: string }> }
export interface Product {
  id: string; kind: 'course' | 'bundle' | 'digital'; name: string; slug: string; shortDescription: string; coverUrl: string | null; coverColor: string; priceMinor: number; compareAtMinor: number | null; salesCount: number; ratingAvg: number | null; ratingCount: number; launchDiscountEndsAt: string | null; status: string;
  page: { headline: string; subheadline: string; introVideoUrl: string | null; benefits: string[]; faq: Array<{ q: string; a: string }>; ctaText: string; guarantee: string; salesMode: 'native' | 'external_landing'; externalLandingUrl: string | null } | null;
  course: { id: string; lessonCount: number; totalDurationSeconds: number; accessMode: string; updatedAt: string } | null; curriculum: CurriculumModule[];
  bundleItems: Array<{ id: string; name: string; slug: string; coverColor: string; priceMinor: number }>; inBundles: Array<{ id: string; name: string; slug: string; coverColor: string; priceMinor: number; count: number; discountPercent: number }>;
  instructor: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; bio: string | null } | null; discountPercent: number; owned: boolean; viewerTier: string | null; affiliateLink: string | null; communitySlug: string; communityName: string; canManage: boolean;
}

export function Benefits({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="card flex flex-col gap-3.5" style={{ padding: '22px 24px' }}>
      <div className="font-bold text-[16px]">Sau khóa này bạn làm được gì</div>
      <div className="grid-2 text-[14px]" style={{ gap: '10px 24px' }}>{items.map((b) => <div key={b} className="flex gap-2.5 items-start"><span className="flex-shrink-0 mt-0.5" style={{ color: T.teal }}><Check size={16} /></span>{b}</div>)}</div>
    </div>
  );
}

export function Curriculum({ p, slug }: { p: Product; slug: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (p.curriculum[0] ? { [p.curriculum[0].id]: true } : {}));
  const [all, setAll] = useState(false);
  if (!p.curriculum.length) return null;
  const mins = (m: CurriculumModule) => fmtDuration(m.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0), true);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center flex-wrap gap-2" style={{ padding: '18px 24px 10px' }}><span className="font-bold text-[16px]">Nội dung khóa học</span><span className="muted text-[13px]">{p.curriculum.length} module · {p.course?.lessonCount ?? 0} bài · {fmtDuration(p.course?.totalDurationSeconds, true)}</span><span className="flex-grow" /><button type="button" className="text-[13px] font-semibold" style={{ color: T.teal }} onClick={() => setAll((a) => !a)}>{all ? 'Thu gọn' : 'Mở tất cả'}</button></div>
      <div className="flex flex-col gap-1 px-3 pb-3">
        {p.curriculum.map((m, i) => {
          const isOpen = all || (open[m.id] ?? false);
          const previews = m.lessons.filter((l) => l.isPreview).length;
          return (
            <div key={m.id}>
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id]: !isOpen }))} className="flex items-center gap-2.5 w-full text-left" style={{ padding: '14px 12px 8px' }}><span style={{ color: T.ink3 }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span><span className="flex-grow font-semibold">{i + 1}. {m.title}</span><span className="muted text-[12px]">{m.lessons.length} bài{mins(m) ? ` · ${mins(m)}` : ''}{previews ? ' · xem thử' : ''}</span></button>
              {isOpen && m.lessons.map((l, li) => (
                <div key={l.id} className="flex items-center gap-3 text-[14px]" style={{ padding: '9px 12px' }}>
                  <span style={{ color: l.isPreview || p.owned ? T.teal : T.ink3 }}>{l.isPreview || p.owned ? <Play size={16} /> : <Lock size={16} />}</span>
                  {l.isPreview || p.owned ? <Link to={`/${slug}/bai/${l.id}`} className="flex-grow" style={{ color: T.ink }}>{i + 1}.{li + 1} {l.title}</Link> : <span className="flex-grow">{i + 1}.{li + 1} {l.title}</span>}
                  {l.isPreview && !p.owned && <span className="tag" style={{ background: T.tealSoft, color: T.tealText, height: 20 }}>Xem thử</span>}
                  <span className="muted text-[12px] w-11 text-right">{l.kind === 'task' ? 'Bài tập' : fmtDuration(l.durationSeconds)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;
  return (
    <div className="card flex flex-col gap-1" style={{ padding: '22px 24px' }}>
      <div className="font-bold text-[16px] pb-2">Câu hỏi thường gặp</div>
      {items.map((f, i) => (
        <div key={f.q} className="flex flex-col gap-1 py-3" style={{ borderTop: `1px solid ${i ? T.line : 'transparent'}` }}>
          <button type="button" className="flex items-center gap-2 font-semibold text-[14px] text-left w-full" onClick={() => setOpen(open === i ? null : i)}><span className="flex-grow">{f.q}</span><ChevronDown size={16} /></button>
          {open === i && <div className="text-[13px] leading-[1.6]" style={{ color: T.ink2 }}>{f.a}</div>}
        </div>
      ))}
    </div>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="flex items-center gap-2.5"><span style={{ color: T.ink3 }}>{icon}</span>{children}</div>;
}

interface DigitalFile { id: string; name: string; sizeBytes: number | null; url: string }

/** Danh sách tệp của sản phẩm số đã mua. Link là signed URL sống 15 phút nên lấy khi mở trang. */
export function DigitalDownloads({ productId }: { productId: string }) {
  const q = useQuery({
    queryKey: ['downloads', productId],
    queryFn: () => api.get<DigitalFile[]>(`/v1/products/${productId}/downloads`),
    staleTime: 10 * 60_000,
    retry: false,
  });
  if (q.isLoading) return <span className="muted text-[13px]">Đang lấy link tải…</span>;
  if (q.isError) return <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(q.error)}</span>;
  const files = q.data ?? [];
  if (files.length === 0) return <span className="muted text-[13px]">Chủ hội chưa đính kèm tệp nào. Nhắn cho họ để được gửi.</span>;
  return (
    <div className="flex flex-col gap-2">
      {files.map((f) => (
        <a key={f.id} href={f.url} download={f.name} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-[13px]" style={{ background: T.bg, color: T.ink }}>
          <FileText size={16} style={{ color: T.ink3 }} />
          <span className="flex-grow truncate font-medium">{f.name}</span>
          {f.sizeBytes ? <span className="muted text-[12px] flex-shrink-0">{fmtBytes(f.sizeBytes)}</span> : null}
          <Download size={15} style={{ color: T.teal }} />
        </a>
      ))}
    </div>
  );
}

export function PriceRail({ p, slug, premium }: { p: Product; slug: string; premium: { monthlyMinor: number | null } | null }) {
  const [copied, setCopied] = useState(false);
  const external = p.page?.salesMode === 'external_landing' && p.page.externalLandingUrl;
  const buyTo = `/${slug}/thanh-toan?product=${p.id}`;
  const firstPreview = p.curriculum.flatMap((m) => m.lessons).find((l) => l.isPreview);
  const showPremium = premium?.monthlyMinor && p.kind === 'course' && (p.course?.accessMode === 'premium_and_store') && p.viewerTier !== 'premium' && p.viewerTier !== 'vip' && !p.owned;
  return (
    <aside className="rail flex flex-col gap-3.5">
      <div className="card p-5 flex flex-col gap-3.5">
        {p.owned ? (
          <><div className="inline-flex items-center gap-1.5 font-semibold" style={{ color: T.teal }}><Check size={16} />Bạn đã sở hữu</div>{p.course && <Link to={`/${slug}/khoa-hoc/${p.course.id}`} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 12 }}>Vào học</Link>}{p.kind === 'digital' && <DigitalDownloads productId={p.id} />}</>
        ) : (
          <>
            <div className="flex items-baseline gap-2.5 flex-wrap"><span className="serif text-[30px] font-extrabold">{money(p.priceMinor)}</span>{p.compareAtMinor ? <span className="muted line-through text-[14px]">{money(p.compareAtMinor)}</span> : null}{p.discountPercent > 0 && <span className="tag" style={{ background: T.ink, color: T.surface }}>-{p.discountPercent}%</span>}</div>
            {p.launchDiscountEndsAt && new Date(p.launchDiscountEndsAt) > new Date() && <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: T.accentText }}><Clock size={14} />Ưu đãi ra mắt còn {Math.max(1, Math.ceil((new Date(p.launchDiscountEndsAt).getTime() - Date.now()) / 86_400_000))} ngày</div>}
            {external ? <a href={p.page?.externalLandingUrl ?? '#'} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 12 }}>{p.page?.ctaText ?? 'Mua ngay'}</a> : <Link to={buyTo} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 12 }}>{p.page?.ctaText ?? 'Mua ngay'}</Link>}
            {firstPreview && <Link to={`/${slug}/bai/${firstPreview.id}`} className="btn btn-ghost" style={{ height: 44, borderRadius: 12 }}><Play size={16} />Xem thử bài miễn phí</Link>}
          </>
        )}
        <div className="flex flex-col gap-2 text-[13px] pt-3" style={{ color: T.ink2, borderTop: `1px solid ${T.line}` }}>
          {p.course && <Row icon={<Video size={15} />}>{p.course.lessonCount} bài video · {fmtDuration(p.course.totalDurationSeconds, true)}</Row>}
          {p.kind === 'bundle' && <Row icon={<FileText size={15} />}>{p.bundleItems.length} khóa học trong combo</Row>}
          <Row icon={<Clock size={15} />}>Truy cập trọn đời, cập nhật miễn phí</Row>
          {p.kind !== 'digital' && <Row icon={<MessageCircle size={15} />}>Thảo luận theo từng bài</Row>}
          {p.kind === 'course' && <Row icon={<BadgeCheck size={15} />}>Chứng nhận hoàn thành</Row>}
          <Row icon={<ShieldCheck size={15} />}>{p.page?.guarantee || 'Hoàn tiền trong 7 ngày'}</Row>
        </div>
        <div className="muted text-[12px] flex items-center gap-1.5"><QrCode size={14} />Chuyển khoản QR, MoMo, VNPAY · mở khóa tự động</div>
      </div>
      {showPremium && (
        <div className="card card-invert p-[18px] flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={14} />Rẻ hơn với Premium</div>
          <div className="serif text-[18px] font-extrabold leading-[1.3]">Premium {money(premium.monthlyMinor)}/tháng mở khóa này và mọi khóa Premium khác</div>
          <div className="text-[13px]" style={{ color: T.sideText }}>Bạn đang ở gói {p.viewerTier ? 'Tiêu chuẩn' : 'khách'}. Hủy bất cứ lúc nào.</div>
          <Link to={`/${slug}/thanh-toan?tier=premium&cycle=monthly`} className="btn btn-primary btn-sm self-start">Nâng cấp Premium</Link>
        </div>
      )}
      {p.inBundles.length > 0 && (
        <div className="card p-4 flex flex-col gap-2">
          <div className="font-semibold text-[13px]">Có trong combo</div>
          {p.inBundles.map((b) => <Link key={b.id} to={`/${slug}/cua-hang/${b.slug}`} className="flex gap-2.5 items-center" style={{ color: T.ink }}><div className="w-11 h-11 rounded-[10px] flex-shrink-0" style={{ background: b.coverColor }} /><div><div className="text-[13px] font-semibold">{b.name}</div><div className="muted text-[12px]">{b.count} khóa · {money(b.priceMinor)}{b.discountPercent ? ` · tiết kiệm ${b.discountPercent}%` : ''}</div></div></Link>)}
        </div>
      )}
      {p.affiliateLink && (
        <div className="card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold"><LinkIcon size={14} />Bạn là cộng sự</div>
          <div className="input text-[12px]" style={{ height: 36, color: T.ink }}><span className="flex-grow truncate">{p.affiliateLink.replace(/^https?:\/\//, '')}</span><button type="button" aria-label="Sao chép" onClick={() => { void navigator.clipboard?.writeText(p.affiliateLink ?? '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={{ color: copied ? T.teal : T.ink3 }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>
          <div className="muted text-[12px]">Hoa hồng theo cấu hình hội · tính mỗi đơn qua link này</div>
        </div>
      )}
      {p.canManage && p.course && <Link to={`/${slug}/khoa-hoc/${p.course.id}/sua`} className="btn btn-ghost btn-sm">Sửa trang bán và khóa học</Link>}
      {p.instructor && (
        <div className="card p-4 flex gap-3 items-center">
          <Avatar name={p.instructor.name} src={p.instructor.avatarUrl} color={p.instructor.coverColor ?? T.ink} size={44} />
          <div className="flex-grow min-w-0"><div className="font-semibold text-[13px] truncate">{p.instructor.name} <span className="muted font-medium">· Giảng viên</span></div><Link to={`/u/${p.instructor.handle}`} className="text-[12px] font-semibold" style={{ color: T.teal }}>Xem hồ sơ</Link></div>
        </div>
      )}
    </aside>
  );
}
