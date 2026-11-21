// Mảnh trang Affiliate, phần lấy link: chọn chương trình (nền tảng, từng hội), chọn trang muốn chia sẻ (trang hội
// hoặc từng sản phẩm), ô link với nút sao chép lớn; thông báo có lối đi tiếp khi chương trình chưa bật.
import { CommunityMark, Radio, T, Tag, money } from '@hoiminh/ui';
import { Check, Copy, Search, Share2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copyText, earnLine, estimateCommission, filterTargets, ratePercent, type AffiliateProgram, type LinkTarget } from '@/lib/affiliate-link';

/** Số ô hiện sẵn trước khi phải bấm "Xem thêm". */
const PROGRAMS_SHOWN = 6;
const TARGETS_SHOWN = 6;
const KIND_LABEL: Record<NonNullable<LinkTarget['productKind']>, string> = { course: 'Khóa học', bundle: 'Combo', digital: 'Sản phẩm số' };

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[14px] font-bold flex-shrink-0" style={{ background: T.ink, color: T.surface }}>{n}</span>
      <span className="font-semibold text-[16px]">{children}</span>
    </div>
  );
}

function ProgramMark({ p }: { p: AffiliateProgram }) {
  if (p.community) return <CommunityMark mark={p.community.logoMark} color={p.community.logoColor} url={p.community.logoUrl} size={40} />;
  return (
    <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: T.bg }}>
      <svg width={26} height={26} viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill={T.gold} /><circle cx="17" cy="13" r="7" fill={T.primary} fillOpacity="0.9" /></svg>
    </span>
  );
}

/** Bước 1: chọn nơi muốn giới thiệu. Luôn hiện, kể cả khi chỉ có một chương trình, để người dùng biết mình đang lấy link của đâu. */
export function ProgramPicker({ programs, current, onPick }: { programs: AffiliateProgram[]; current: string | null; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const head = programs.slice(0, PROGRAMS_SHOWN);
  const picked = programs.find((p) => p.id === current);
  // Chương trình đang chọn nằm ngoài phần hiện sẵn thì vẫn phải thấy được.
  const shown = all || programs.length <= PROGRAMS_SHOWN ? programs : picked && !head.includes(picked) ? [...head, picked] : head;
  return (
    <section className="flex flex-col gap-3">
      <StepTitle n={1}>Bạn muốn giới thiệu gì?</StepTitle>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2" role="radiogroup" aria-label="Chương trình affiliate">
        {shown.map((p) => {
          const on = p.id === current;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(p.id)} className="card flex items-center gap-3 text-left" style={{ padding: '12px 14px', minHeight: 64, borderColor: on ? T.primary : undefined, boxShadow: on ? `0 0 0 1px ${T.primary}` : undefined }}>
              <ProgramMark p={p} />
              <span className="flex-grow min-w-0 flex flex-col">
                <span className="font-semibold text-[15px] truncate">{p.name}</span>
                <span className="muted text-[13px] truncate">{p.scope === 'platform' ? 'Mời người mở hội riêng' : 'Mời người vào hội, mua sản phẩm'}</span>
              </span>
              {p.enabled ? <Tag tone="teal">{ratePercent(p.rateBps)}</Tag> : <Tag>Chưa bật</Tag>}
            </button>
          );
        })}
      </div>
      {shown.length < programs.length && <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAll(true)}>Xem thêm {programs.length - shown.length} hội</button>}
    </section>
  );
}

/** Chương trình chưa bật: nói rõ vì sao chưa có link và đưa lối đi tiếp, thay cho một màn hình trống. */
export function ProgramOffNotice({ p, hasWallet }: { p: AffiliateProgram; hasWallet: boolean }) {
  const platform = p.scope === 'platform';
  const to = platform ? '/he-thong/cong-su' : p.community ? `/${p.community.slug}/cai-dat/cong-su` : null;
  return (
    <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px', background: T.goldSoft, borderColor: 'transparent' }}>
      <div className="font-semibold text-[16px]">{platform ? 'Chương trình affiliate nền tảng đang tạm dừng' : `${p.name} chưa bật affiliate`}</div>
      <div className="text-[14px]" style={{ color: T.ink2 }}>
        {platform
          ? 'Link giới thiệu Hội Mình tạm thời chưa tính hoa hồng.'
          : p.canManage
            ? 'Bạn quản lý hội này. Bật chương trình và chọn mức hoa hồng, thành viên sẽ lấy được link giới thiệu ngay tại trang này.'
            : 'Chủ hội chưa bật chương trình affiliate nên hội này chưa có link giới thiệu. Bạn có thể nhắn chủ hội đề nghị bật.'}
        {hasWallet && ' Hoa hồng bạn đã có vẫn xem và rút được ở bên dưới.'}
      </div>
      {p.canManage && to && <Link to={to} className="btn btn-dark self-start">{platform ? 'Mở cài đặt affiliate nền tảng' : 'Bật affiliate cho hội'}</Link>}
    </div>
  );
}

/** Dòng phụ dưới tên trang: nói rõ trang đó dành cho ai, hoặc giá và hoa hồng ước tính của sản phẩm. */
function targetHint(t: LinkTarget, rateBps: number): string {
  if (t.kind === 'platform') return t.key === 'home' ? 'Cho người chưa biết Hội Mình' : 'Cho người muốn mở hội riêng';
  if (t.kind === 'community') return 'Người xem thấy phần giới thiệu và các gói thành viên';
  const kind = t.productKind ? KIND_LABEL[t.productKind] : 'Sản phẩm';
  if (!t.priceMinor) return `${kind} · Miễn phí`;
  return `${kind} · ${money(t.priceMinor)} · ${t.commission ? `bạn nhận khoảng ${money(estimateCommission(t.priceMinor, rateBps))}` : 'không tính hoa hồng bán lẻ'}`;
}

function TargetPicker({ targets, current, rateBps, onPick }: { targets: LinkTarget[]; current: string; rateBps: number; onPick: (key: string) => void }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const found = filterTargets(targets, query);
  const head = found.slice(0, TARGETS_SHOWN);
  const picked = found.find((t) => t.key === current);
  const shown = all || query.trim() || found.length <= TARGETS_SHOWN ? found : picked && !head.includes(picked) ? [...head, picked] : head;
  return (
    <div className="flex flex-col gap-3">
      <StepTitle n={2}>Chọn trang muốn chia sẻ</StepTitle>
      {targets.length > TARGETS_SHOWN + 2 && (
        <span className="input"><Search size={16} style={{ color: T.ink3 }} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm sản phẩm, khóa học" aria-label="Tìm trang muốn chia sẻ" /></span>
      )}
      <div role="radiogroup" aria-label="Trang muốn chia sẻ" className="flex flex-col overflow-hidden" style={{ border: `1px solid ${T.line}`, borderRadius: 12 }}>
        {shown.map((t, i) => {
          const on = t.key === current;
          return (
            <button key={t.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(t.key)} className="flex items-center gap-3 text-left" style={{ padding: '11px 14px', minHeight: 56, borderTop: i ? `1px solid ${T.line}` : undefined, background: on ? T.primarySoft : undefined }}>
              <Radio on={on} />
              <span className="flex-grow min-w-0 flex flex-col">
                <span className="text-[15px] truncate" style={{ fontWeight: on ? 600 : 500 }}>{t.label}</span>
                <span className="text-[13px]" style={{ color: on ? T.primaryText : T.ink3 }}>{targetHint(t, rateBps)}</span>
              </span>
            </button>
          );
        })}
        {found.length === 0 && <div className="muted text-[14px]" style={{ padding: '14px' }}>Không có trang nào khớp với "{query.trim()}".</div>}
      </div>
      {shown.length < found.length && <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAll(true)}>Xem thêm {found.length - shown.length} sản phẩm</button>}
    </div>
  );
}

export interface LinkCardProps {
  program: Pick<AffiliateProgram, 'scope' | 'rateBps' | 'durationMonths' | 'name'>;
  targets: LinkTarget[];
  code: string;
  stats: { clicks: number; signups: number; paid: number };
}

/** Bước 2 và 3: chọn trang (khi chương trình có nhiều trang) rồi sao chép link. Đổi chương trình thì gắn `key` mới để chọn lại từ đầu. */
export function LinkCard({ program, targets, code, stats }: LinkCardProps) {
  const [key, setKey] = useState(targets[0]?.key ?? '');
  const [copied, setCopied] = useState<'link' | 'code' | 'failed' | null>(null);
  const target = targets.find((t) => t.key === key) ?? targets[0];
  if (!target) return null;
  const many = targets.length > 1;
  const flash = (state: 'link' | 'code' | 'failed') => { setCopied(state); setTimeout(() => setCopied(null), 2000); };
  const copy = (text: string, what: 'link' | 'code') => { void copyText(text).then((ok) => flash(ok ? what : 'failed')); };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = () => { void navigator.share({ title: target.label, url: target.url }).catch(() => { /* người dùng đóng bảng chia sẻ */ }); };
  return (
    <section className="card flex flex-col gap-5" style={{ padding: '18px 20px' }}>
      {many && <TargetPicker targets={targets} current={target.key} rateBps={program.rateBps} onPick={setKey} />}
      <div className="flex flex-col gap-3">
        <StepTitle n={many ? 3 : 2}>Sao chép link và gửi cho người bạn muốn mời</StepTitle>
        <div className="text-[14px]" style={{ color: T.ink2 }}>{earnLine(program)}</div>
        <div className="flex gap-2.5 flex-col md:flex-row md:items-stretch">
          <div className="input flex-grow" style={{ height: 'auto', minHeight: 50, padding: '10px 14px' }}>
            <span data-testid="affiliate-link" className="flex-grow font-semibold text-[15px]" style={{ color: T.primaryText, wordBreak: 'break-all', userSelect: 'all' }}>{target.url}</span>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => copy(target.url, 'link')}>{copied === 'link' ? <Check size={18} /> : <Copy size={18} />}{copied === 'link' ? 'Đã sao chép' : 'Sao chép link'}</button>
          {canShare && <button type="button" className="btn btn-ghost btn-lg" onClick={share}><Share2 size={18} />Chia sẻ</button>}
        </div>
        {copied === 'failed' && <div className="text-[14px]" style={{ color: T.accentText }}>Trình duyệt không cho sao chép tự động. Bạn nhấn giữ vào link ở trên để sao chép.</div>}
        {!target.commission && <div className="text-[14px]" style={{ color: T.goldText }}>Chủ hội đã tắt hoa hồng bán lẻ cho sản phẩm này. Người vào hội qua link này vẫn được tính cho bạn.</div>}
        <div className="text-[14px] flex items-center gap-2 flex-wrap" style={{ color: T.ink2 }}>
          <span>Mã giới thiệu của bạn: <b style={{ color: T.ink }}>{code}</b></span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(code, 'code')}>{copied === 'code' ? 'Đã sao chép' : 'Sao chép mã'}</button>
          {program.scope === 'community' && <span className="muted text-[13px] basis-full">Thành viên đã ở trong hội nhập mã này ở trang Xếp hạng affiliate để chọn bạn làm người giới thiệu.</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
        {([[stats.clicks, 'Lượt bấm'], [stats.signups, 'Đăng ký'], [stats.paid, 'Trả phí']] as const).map(([v, l]) => <div key={l} className="text-center"><div className="font-bold text-[20px]">{v}</div><div className="muted text-[13px]">{l}</div></div>)}
      </div>
    </section>
  );
}
