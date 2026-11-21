// Mảnh trang giới thiệu hội (aboutBody trong build.mjs): kiểu dữ liệu, tab, bộ ảnh và video, lợi ích, người dẫn dắt, khóa học, FAQ.
import type { PricingPromo, TierTerm } from '@hoiminh/contracts';
import { COMMUNITY_CATEGORY_LABELS, type AboutMediaItem } from '@hoiminh/contracts';
import { Avatar, T } from '@hoiminh/ui';
import { BookOpen, Calendar, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Lock, MessageCircle, Pencil, Play, Store, Trophy, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { videoInfo } from '@/lib/about-media';
import { fmtCount } from '@/lib/format';
import type { InviteInfo } from '@/lib/invite';

export interface AboutPage {
  community: { id: string; workspaceId: string; name: string; slug: string; shortDescription: string; description: string; category: string; logoUrl: string | null; logoMark: string; logoColor: string; coverUrl: string | null; coverColor: string; coverTagline: string; introVideoUrl: string | null; aboutMedia?: AboutMediaItem[]; links: Array<{ label: string; url: string }>; status: string; /** Hội mở ('public'): người chưa vào hội cũng xem được bên trong. Bản API cũ không trả thì coi là hội kín. */ visibility?: 'private' | 'public'; pricingMode: string; doorsOpen: boolean; memberCount: number; paidMemberCount: number; tabs: Record<string, boolean>; customDomain: string | null };
  tiers: Array<{ id: string; key: string; name: string; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null; benefits: string[] }>;
  owner: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; bio: string } | null;
  courses: Array<{ id: string; title: string; slug: string; coverColor: string; coverUrl: string | null; lessonCount: number; accessMode: string; priceMinor: number | null }>;
  sampleMembers: Array<{ id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }>;
  joinQuestions: Array<{ id: string; question: string; required: boolean; sortOrder: number }>;
  referrer: { name: string } | null;
  /** Có khi link mang mã mời (`?invite=`): lời mời còn dùng được không và trao vai trò gì. */
  invite?: InviteInfo | null;
  stats: { members: number; online: number; courses: number; paid: number };
  viewer: { role: string; memberStatus: string | null; tierId: string | null } | null;
  pricing: { mode: string; doorsOpen: boolean; paymentsReady: boolean; premiumMonthlyMinor: number | null; premiumYearlyMinor: number | null; oneTimeMinor: number | null; /** Các kỳ hạn của gói Premium và khuyến mãi đang chạy. */ premiumTerms: TierTerm[]; promo: PricingPromo | null };
}

export function categoryLabel(key: string): string {
  return (COMMUNITY_CATEGORY_LABELS as Record<string, string>)[key] ?? key;
}

export function isViewerMember(d: AboutPage): boolean {
  const v = d.viewer;
  if (!v) return false;
  return v.role === 'owner' || v.role === 'admin' || v.memberStatus === 'active' || v.memberStatus === 'cancelling';
}

export function AboutTabs({ d, member }: { d: AboutPage; member: boolean }) {
  const slug = d.community.slug;
  const tabs = d.community.tabs;
  const items: Array<[string, string, boolean]> = [['Bảng tin', 'bang-tin', tabs.feed !== false], ['Khóa học', 'khoa-hoc', tabs.courses !== false], ['Sự kiện', 'su-kien', tabs.events !== false], ['Thành viên', 'thanh-vien', tabs.members !== false]];
  const cls = 'inline-flex items-center gap-1.5 text-[15px] whitespace-nowrap';
  const tab = (label: string, path: string, locked: boolean) => (locked
    ? <span key={label} className={cls} style={{ padding: '12px 4px', borderBottom: '2px solid transparent', fontWeight: 500, color: T.ink3 }}>{label}<Lock size={14} /></span>
    : <Link key={label} to={`/${slug}/${path}`} className={cls} style={{ padding: '12px 4px', borderBottom: '2px solid transparent', fontWeight: 500, color: T.ink2 }}>{label}</Link>);
  return (
    <div className="flex gap-5 overflow-x-auto" style={{ borderBottom: `1px solid ${T.line}` }}>
      <span className={cls} style={{ padding: '12px 4px', borderBottom: `2px solid ${T.ink}`, fontWeight: 700, color: T.ink }}>Giới thiệu</span>
      {/* Hội mở: người chưa vào hội cũng mở được các tab, ở chế độ chỉ xem. */}
      {items.filter(([, , on]) => on).map(([label, path]) => tab(label, path, !member && d.community.visibility !== 'public'))}
      {tabs.store !== false && tab('Cửa hàng', 'cua-hang', false)}
    </div>
  );
}

interface Slide { key: string; label: string; color: string; image: string | null; video: string | null; /** Ảnh chủ hội tải lên hiện trọn ảnh, không đè chữ; nền màu và ảnh bìa khóa học thì đè tiêu đề. */ title: string | null }

/** Chủ hội đã xếp ảnh và video thì hiện đúng bộ đó; chưa có thì hiện nền màu của hội kèm ảnh bìa ba khóa học đầu. */
function slidesOf(d: AboutPage): Slide[] {
  const c = d.community;
  const media = c.aboutMedia ?? [];
  if (media.length) {
    return media.map((m, k) => (m.kind === 'video'
      ? { key: m.id, label: `Video ${k + 1}`, color: T.side, image: videoInfo(m.url)?.thumb ?? null, video: m.url, title: null }
      : { key: m.id, label: `Ảnh ${k + 1}`, color: T.side, image: m.url, video: null, title: null }));
  }
  return [
    { key: 'bia', label: c.coverTagline || c.name, color: c.coverColor, image: c.coverUrl, video: c.introVideoUrl, title: c.coverTagline || c.name },
    ...d.courses.slice(0, 3).map((k) => ({ key: k.id, label: k.title, color: k.coverColor, image: k.coverUrl, video: null, title: k.title })),
  ];
}

export function AboutHero({ d }: { d: AboutPage }) {
  const c = d.community;
  const slides = slidesOf(d);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const at = Math.min(i, slides.length - 1);
  const cur = slides[at]!;
  const video = cur.video ? videoInfo(cur.video) : null;
  const go = (k: number) => { setI((k + slides.length) % slides.length); setPlaying(false); };
  const canEdit = d.viewer?.role === 'owner' || d.viewer?.role === 'admin';
  const editTo = `/${c.slug}/cai-dat/chung#anh-video`;
  const arrow = 'absolute top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center';
  const arrowStyle = { width: 40, height: 40, background: 'rgba(0,0,0,0.45)', color: '#fff' };
  return (
    <>
      <div className="relative overflow-hidden flex items-center justify-center rounded-[18px]" style={{ aspectRatio: '16 / 9', backgroundColor: cur.color, backgroundImage: cur.image && (cur.title || cur.video) ? `url(${cur.image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {playing && video ? (
          <iframe src={video.embedSrc} title="Video giới thiệu" className="absolute inset-0 w-full h-full" style={{ border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : (
          <>
            {!cur.title && !cur.video && cur.image && <img src={cur.image} alt={`Ảnh giới thiệu ${c.name}`} className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain' }} />}
            {cur.title && (
              <div className="absolute left-4 bottom-4 md:left-7 md:bottom-7" style={{ color: T.invertInk }}>
                <div className="serif font-extrabold leading-[1.05] text-[24px] md:text-[40px]" style={{ maxWidth: 520, textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>{cur.title}</div>
                {cur.video && <div className="text-[14px] mt-2" style={{ opacity: 0.85 }}>Video giới thiệu</div>}
              </div>
            )}
            {cur.video && (video
              ? <button type="button" aria-label="Phát video giới thiệu" onClick={() => setPlaying(true)} className="relative rounded-full flex items-center justify-center" style={{ width: 72, height: 72, background: T.primary, color: T.onPrimary, boxShadow: '0 6px 24px rgba(0,0,0,0.3)' }}><Play size={30} /></button>
              : <a href={cur.video} target="_blank" rel="noreferrer" className="btn btn-primary relative">Mở video</a>)}
            {slides.length > 1 && (
              <>
                <button type="button" aria-label="Xem mục trước" onClick={() => go(at - 1)} className={`${arrow} left-3`} style={arrowStyle}><ChevronLeft size={22} /></button>
                <button type="button" aria-label="Xem mục sau" onClick={() => go(at + 1)} className={`${arrow} right-3`} style={arrowStyle}><ChevronRight size={22} /></button>
              </>
            )}
          </>
        )}
        {canEdit && !playing && <Link to={editTo} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[10px] text-[14px] font-semibold" style={{ padding: '8px 12px', background: T.surface, color: T.ink, boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}><Pencil size={15} />Sửa ảnh và video</Link>}
      </div>
      {slides.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto" style={{ padding: 4, margin: -4 }}>
          {slides.map((s, k) => (
            <button key={s.key} type="button" aria-label={s.label} aria-current={k === at ? 'true' : undefined} onClick={() => go(k)} className="relative flex-shrink-0 rounded-[10px] flex items-center justify-center" style={{ width: 120, height: 68, backgroundColor: s.color, backgroundImage: s.image ? `url(${s.image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', opacity: k === at ? 1 : 0.6, outline: k === at ? `2px solid ${T.ink}` : undefined, outlineOffset: 2 }}>
              {s.video && <span className="inline-flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff' }}><Play size={14} /></span>}
            </button>
          ))}
        </div>
      )}
      {canEdit && !(c.aboutMedia ?? []).length && (
        <div className="flex items-center gap-3 flex-wrap rounded-[14px] text-[15px] leading-[1.6]" style={{ padding: '14px 18px', border: `1px dashed ${T.line2}`, color: T.ink2 }}>
          <span style={{ flex: '1 1 260px' }}>Trang giới thiệu chưa có ảnh hay video riêng. Thêm vài ảnh chụp bên trong hội và một video ngắn để người mới dễ quyết định tham gia hơn. Chỉ quản trị thấy dòng này.</span>
          <Link to={editTo} className="btn btn-primary btn-sm"><ImagePlus size={15} />Thêm ảnh và video</Link>
        </div>
      )}
    </>
  );
}

export function Benefits({ d }: { d: AboutPage }) {
  const first = d.courses[0];
  const items: Array<[ReactNode, string, string]> = [
    [<BookOpen size={18} key="b" />, first ? `Lộ trình ${first.title}` : 'Khóa học theo lộ trình', first ? `${first.lessonCount} bài${first.accessMode === 'free' ? ', học miễn phí' : d.pricing.mode === 'freemium' ? ', module 1 miễn phí' : ''}` : 'Sắp ra mắt'],
    [<MessageCircle size={18} key="c" />, 'Hỏi đáp có người trả lời', d.owner ? `${d.owner.name} và affiliate` : 'Người dẫn dắt và affiliate'],
    [<Calendar size={18} key="e" />, 'Sự kiện trực tiếp', 'Q&A, workshop, có bản ghi'],
    [<Trophy size={18} key="t" />, 'Chương trình affiliate', 'Giới thiệu bạn bè, nhận hoa hồng mỗi kỳ'],
    [<Store size={18} key="s" />, 'Cửa hàng khóa học và tài liệu', 'Combo, prompt, template'],
    [<Users size={18} key="u" />, 'Cộng đồng người làm thật', `${fmtCount(d.stats.members)} thành viên${d.stats.paid ? `, ${fmtCount(d.stats.paid)} đang trả phí` : ''}`],
  ];
  return (
    <div className="card flex flex-col gap-3.5" style={{ padding: '22px 24px' }}>
      <div className="font-bold text-[16px]">Bạn nhận được gì khi tham gia</div>
      <div className="grid-2" style={{ gap: '12px 24px' }}>
        {items.map(([ic, t, s]) => (
          <div key={t} className="flex gap-3 items-start">
            <span className="inline-flex items-center justify-center flex-shrink-0 rounded-[10px]" style={{ width: 36, height: 36, background: T.accentSoft, color: T.accentText }}>{ic}</span>
            <div><div className="font-semibold text-[14px]">{t}</div><div className="muted text-[13px]">{s}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Leader({ d }: { d: AboutPage }) {
  const o = d.owner;
  if (!o) return null;
  return (
    <div className="card flex gap-[18px] items-center flex-wrap" style={{ padding: '22px 24px' }}>
      <Avatar name={o.name} src={o.avatarUrl} color={o.coverColor ?? T.ink} size={64} />
      <div className="flex-grow min-w-0">
        <div className="font-bold text-[16px]">{o.name} <span className="muted font-medium text-[13px]">· Người dẫn dắt</span></div>
        <div className="text-[14px] leading-[1.6] mt-1" style={{ color: T.ink2 }}>{o.bio || `Chủ hội ${d.community.name}.`}</div>
      </div>
      <Link to={`/u/${o.handle}`} className="btn btn-ghost btn-sm">Xem hồ sơ</Link>
    </div>
  );
}

export function CourseList({ d, member }: { d: AboutPage; member: boolean }) {
  if (!d.courses.length) return null;
  const lessons = d.courses.reduce((n, k) => n + k.lessonCount, 0);
  const meta = (k: AboutPage['courses'][number]) => `${k.lessonCount} bài · ${k.accessMode === 'free' ? 'miễn phí' : k.accessMode === 'purchase' ? 'mua riêng' : 'Premium'}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5"><span className="font-bold text-[16px]">Khóa học trong hội</span><span className="muted text-[13px]">{d.courses.length} khóa · {lessons} bài</span></div>
      <div className="grid-3" style={{ gap: 14 }}>
        {d.courses.map((k) => {
          const body = <><div style={{ height: 96, background: k.coverUrl ? `url(${k.coverUrl}) center/cover` : k.coverColor }} /><div style={{ padding: '12px 14px' }}><div className="font-semibold text-[14px]">{k.title}</div><div className="muted text-[12px]">{meta(k)}</div></div></>;
          return member ? <Link key={k.id} to={`/${d.community.slug}/khoa-hoc/${k.id}`} className="card overflow-hidden" style={{ color: T.ink }}>{body}</Link> : <div key={k.id} className="card overflow-hidden">{body}</div>;
        })}
      </div>
    </div>
  );
}

export function Faq({ d }: { d: AboutPage }) {
  const free = d.pricing.mode === 'free' || d.pricing.mode === 'freemium';
  const qa: Array<[string, string]> = [
    [free ? 'Vào miễn phí thì học được gì?' : 'Tôi nhận được gì sau khi thanh toán?', free ? 'Bảng tin, Hỏi đáp, sự kiện công khai và phần miễn phí của mọi khóa học.' : 'Toàn bộ bảng tin, khóa học, sự kiện và quyền trở thành affiliate của hội.'],
    ['Thanh toán bằng cách nào?', 'Chuyển khoản QR, MoMo hoặc VNPAY. Quyền truy cập mở tự động sau khi tiền về, thường dưới 1 phút.'],
    ['Hủy gói có mất dữ liệu không?', 'Không. Bạn giữ quyền đến hết kỳ đã trả, tiến độ học được giữ lại nếu quay lại.'],
  ];
  const [open, setOpen] = useState<number>(0);
  return (
    <div className="card flex flex-col gap-1" style={{ padding: '22px 24px' }}>
      <div className="font-bold text-[16px] pb-2">Câu hỏi thường gặp</div>
      {qa.map(([q, a], i) => (
        <div key={q} className="flex flex-col gap-1 py-3" style={{ borderTop: `1px solid ${i ? T.line : 'transparent'}` }}>
          <button type="button" className="flex items-center gap-2 font-semibold text-[14px] text-left w-full" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span className="flex-grow">{q}</span>
            <ChevronDown size={16} style={{ transform: open === i ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
          </button>
          {open === i && <div className="text-[13px] leading-[1.6]" style={{ color: T.ink2 }}>{a}</div>}
        </div>
      ))}
    </div>
  );
}
