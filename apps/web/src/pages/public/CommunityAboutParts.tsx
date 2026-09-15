// Mảnh trang giới thiệu hội (aboutBody trong build.mjs): kiểu dữ liệu, tab, ảnh bìa, lợi ích, người dẫn dắt, khóa học, FAQ.
import { COMMUNITY_CATEGORY_LABELS } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Avatar, T } from '@hoiminh/ui';
import { BookOpen, Calendar, ChevronDown, Lock, MessageCircle, Play, Store, Trophy, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { fmtCount } from '@/lib/format';

export interface AboutPage {
  community: { id: string; workspaceId: string; name: string; slug: string; shortDescription: string; description: string; category: string; logoUrl: string | null; logoMark: string; logoColor: string; coverUrl: string | null; coverColor: string; coverTagline: string; introVideoUrl: string | null; links: Array<{ label: string; url: string }>; status: string; pricingMode: string; doorsOpen: boolean; memberCount: number; paidMemberCount: number; tabs: Record<string, boolean>; customDomain: string | null };
  tiers: Array<{ id: string; key: string; name: string; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null; benefits: string[] }>;
  owner: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; bio: string } | null;
  courses: Array<{ id: string; title: string; slug: string; coverColor: string; coverUrl: string | null; lessonCount: number; accessMode: string; priceMinor: number | null }>;
  sampleMembers: Array<{ id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }>;
  joinQuestions: Array<{ id: string; question: string; required: boolean; sortOrder: number }>;
  referrer: { name: string } | null;
  stats: { members: number; online: number; courses: number; paid: number };
  viewer: { role: string; memberStatus: string | null; tierId: string | null } | null;
  pricing: { mode: string; doorsOpen: boolean; premiumMonthlyMinor: number | null; premiumYearlyMinor: number | null; oneTimeMinor: number | null };
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
      {items.filter(([, , on]) => on).map(([label, path]) => tab(label, path, !member))}
      {tabs.store !== false && tab('Cửa hàng', 'cua-hang', false)}
    </div>
  );
}

export function AboutHero({ d }: { d: AboutPage }) {
  const c = d.community;
  const slides = [{ color: c.coverColor, url: c.coverUrl, title: c.coverTagline || c.name }, ...d.courses.slice(0, 3).map((k) => ({ color: k.coverColor, url: k.coverUrl, title: k.title }))];
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const parse = useMutation({ mutationFn: (url: string) => api.post<{ embed: { embedUrl: string } | null }>('/v1/video/parse', { url }) });
  const cur = slides[i] ?? slides[0]!;
  const play = () => {
    if (!c.introVideoUrl) return;
    setPlaying(true);
    if (!parse.data) parse.mutate(c.introVideoUrl);
  };
  const embedUrl = parse.data?.embed?.embedUrl ?? null;
  return (
    <>
      <div className="relative overflow-hidden flex items-center justify-center rounded-[18px]" style={{ aspectRatio: '16 / 9', background: cur.url ? `url(${cur.url}) center/cover` : cur.color }}>
        {playing && embedUrl ? (
          <iframe src={embedUrl} title="Video giới thiệu" className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : (
          <>
            <div className="absolute left-4 bottom-4 md:left-7 md:bottom-7" style={{ color: T.surface }}>
              <div className="serif font-extrabold leading-[1.05] text-[24px] md:text-[40px]" style={{ maxWidth: 520, textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>{cur.title}</div>
              {c.introVideoUrl && i === 0 && <div className="text-[14px] mt-2" style={{ opacity: 0.85 }}>{playing && parse.isError ? 'Không mở được video, thử mở trực tiếp' : 'Video giới thiệu'}</div>}
            </div>
            {c.introVideoUrl && i === 0 && (
              playing && parse.isError
                ? <a href={c.introVideoUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Mở video</a>
                : <button type="button" aria-label="Phát video giới thiệu" onClick={play} className="rounded-full flex items-center justify-center" style={{ width: 72, height: 72, background: T.accent, color: T.surface }}>{playing && parse.isPending ? <span className="inline-block w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Play size={30} />}</button>
            )}
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto">
          {slides.map((s, k) => (
            <button key={k} type="button" aria-label={s.title} onClick={() => { setI(k); setPlaying(false); }} className="flex-shrink-0 rounded-[10px]" style={{ width: 120, height: 68, background: s.url ? `url(${s.url}) center/cover` : s.color, opacity: k === i ? 1 : 0.55, outline: k === i ? `2px solid ${T.ink}` : undefined, outlineOffset: 2 }} />
          ))}
        </div>
      )}
    </>
  );
}

export function Benefits({ d }: { d: AboutPage }) {
  const first = d.courses[0];
  const items: Array<[ReactNode, string, string]> = [
    [<BookOpen size={18} key="b" />, first ? `Lộ trình ${first.title}` : 'Khóa học theo lộ trình', first ? `${first.lessonCount} bài${first.accessMode === 'free' ? ', học miễn phí' : d.pricing.mode === 'freemium' ? ', module 1 miễn phí' : ''}` : 'Sắp ra mắt'],
    [<MessageCircle size={18} key="c" />, 'Hỏi đáp có người trả lời', d.owner ? `${d.owner.name} và cộng sự` : 'Người dẫn dắt và cộng sự'],
    [<Calendar size={18} key="e" />, 'Sự kiện trực tiếp', 'Q&A, workshop, có bản ghi'],
    [<Trophy size={18} key="t" />, 'Chương trình cộng sự', 'Giới thiệu bạn bè, nhận hoa hồng mỗi kỳ'],
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
    [free ? 'Vào miễn phí thì học được gì?' : 'Tôi nhận được gì sau khi thanh toán?', free ? 'Bảng tin, Hỏi đáp, sự kiện công khai và phần miễn phí của mọi khóa học.' : 'Toàn bộ bảng tin, khóa học, sự kiện và quyền trở thành cộng sự của hội.'],
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
