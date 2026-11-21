// Trang Affiliate của thành viên trong một hội (/:slug/xep-hang, giữ địa chỉ cũ của trang Xếp hạng affiliate vì link
// đã chia sẻ và thông báo đang dẫn tới đó). Gom về một chỗ: tab "Link của tôi" (lấy link, số liệu, tóm tắt ví) và tab
// "Xếp hạng" (bảng xếp hạng của hội); tab đang mở nằm trên địa chỉ (?tab=link, ?tab=xep-hang). Cột phải: người giới
// thiệu của bạn, cách tính, tổng affiliate của tháng. Phần chủ hội quản lý chương trình nằm ở trang khác (/:slug/cong-su).
import { useQuery } from '@tanstack/react-query';
import { CommunityMark, Prog, T, Tag, WalletBox, money } from '@hoiminh/ui';
import { Clock, Link as LinkIcon, ShieldCheck, UserCheck, Users, Wallet as WalletIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { ratePercent, type LinkTarget } from '@/lib/affiliate-link';
import { AFFILIATE_TAB_LABEL, affiliateHeadline, affiliateTabs, currentAffiliateTab, leaderboardAudience, type AffiliateTab } from '@/lib/affiliate-nav';
import { api } from '@/lib/api';
import { useShell, type Shell } from '@/lib/community';
import { LinkCard } from '@/pages/account/AffiliateLinkParts';
import { RankBoard, type Board, type Period } from './AffiliateRank';
import { ReferrerCard } from './ReferrerCard';

/** Ví của tôi trong chương trình của hội này (GET /v1/me/affiliate/:programId). Gọi API này là mở tài khoản affiliate. */
interface Wallet { programId: string; enabled: boolean; commissionDurationMonths: number | null; targets: LinkTarget[]; communityName: string; payerName: string; affiliateCode: string; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; pendingMinor: number; availableMinor: number; clicks: number; signups: number; paid: number }

/** Hội chưa bật affiliate (hoặc gói của hội không có): nói rõ vì sao chưa có link và đưa lối đi tiếp. */
function ProgramOff({ name, slug, canManage, canConfigure, walletProgramId }: { name: string; slug: string; canManage: boolean; canConfigure: boolean; walletProgramId: string | null }) {
  return (
    <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px', background: T.goldSoft, borderColor: 'transparent' }}>
      <div className="font-semibold text-[16px]">{name} chưa bật affiliate</div>
      <div className="text-[14px]" style={{ color: T.ink2 }}>
        {canManage
          ? 'Bạn quản lý hội này. Bật chương trình và chọn mức hoa hồng, thành viên sẽ thấy mục Affiliate trên thanh bên và lấy được link giới thiệu ngay tại trang này.'
          : 'Chủ hội chưa bật chương trình affiliate nên hội này chưa có link giới thiệu. Bạn có thể nhắn chủ hội đề nghị bật.'}
        {walletProgramId && ' Hoa hồng bạn đã có vẫn xem và rút được trong ví.'}
      </div>
      {(canManage || walletProgramId) && (
        <div className="flex gap-2 flex-wrap">
          {canManage && <Link to={canConfigure ? `/${slug}/cai-dat/cong-su` : `/${slug}/cong-su`} className="btn btn-dark">{canConfigure ? 'Bật affiliate cho hội' : 'Mở trang quản lý affiliate'}</Link>}
          {walletProgramId && <Link to={`/tai-khoan/cong-su/${walletProgramId}`} className="btn btn-ghost">Xem ví và rút tiền</Link>}
        </div>
      )}
    </div>
  );
}

/**
 * Tab "Link của tôi": lấy link (LinkCard dùng chung với khu Tài khoản), rồi tóm tắt ví và lối sang trang ví đầy đủ.
 * LinkCard đánh số bước từ 2 (ở khu Tài khoản bước 1 là chọn chương trình), nên ở đây bước 1 nói rõ đang giới thiệu
 * hội nào và đưa lối sang link của hội khác hoặc của nền tảng.
 */
function MyLink({ w, community }: { w: Wallet; community: Shell['community'] }) {
  return (
    <>
      {w.enabled && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[14px] font-bold flex-shrink-0" style={{ background: T.ink, color: T.surface }}>1</span>
            <span className="font-semibold text-[16px]">Bạn đang giới thiệu hội này</span>
          </div>
          <div className="card flex items-center gap-3" style={{ padding: '12px 14px', minHeight: 64 }}>
            <CommunityMark mark={community.logoMark} color={community.logoColor} url={community.logoUrl} size={40} />
            <span className="flex-grow min-w-0 flex flex-col">
              <span className="font-semibold text-[15px] leading-snug" style={{ overflowWrap: 'anywhere' }}>{community.name}</span>
              <span className="muted text-[13px]">Mời người vào hội, mua sản phẩm</span>
            </span>
            <Tag tone="teal">{ratePercent(w.commissionRateBps)}</Tag>
          </div>
          <Link to="/tai-khoan/cong-su" className="self-start inline-flex items-center min-h-[44px] text-[14px] font-semibold" style={{ color: T.primaryText }}>Lấy link của hội khác hoặc của nền tảng Hội Mình</Link>
        </section>
      )}
      {w.enabled && <LinkCard key={w.programId} program={{ scope: 'community', rateBps: w.commissionRateBps, durationMonths: w.commissionDurationMonths, name: w.communityName }} targets={w.targets} code={w.affiliateCode} stats={{ clicks: w.clicks, signups: w.signups, paid: w.paid }} />}
      <div className="pt-1">
        <h2 className="m-0 text-[18px] font-bold">Ví hoa hồng của bạn</h2>
        <div className="muted text-[14px]">Hoa hồng từ hội này về một ví riêng. {w.payerName} chuyển khoản khi bạn gửi yêu cầu rút.</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <WalletBox label="Đang giữ" value={money(w.pendingMinor)} hint={`chờ hết ${w.holdDays} ngày đối soát`} />
        <WalletBox label="Có thể rút" value={money(w.availableMinor)} hint={`rút từ ${money(w.minWithdrawalMinor)}`} strong />
      </div>
      <Link to={`/tai-khoan/cong-su/${w.programId}`} className="btn btn-ghost w-full sm:w-auto sm:self-start"><WalletIcon size={18} />Xem ví và rút tiền</Link>
    </>
  );
}

export default function Page() {
  const shell = useShell();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>('month');
  const c = shell.community;
  const aff = shell.affiliate ?? null;
  const running = Boolean(aff?.enabled);
  const canManage = shell.viewer.permissions.includes('affiliates.manage');
  const param = params.get('tab');

  // Ví chỉ tải khi người xem mở tab "Link của tôi": gọi API ví là mở tài khoản affiliate cho họ.
  const wantsLink = currentAffiliateTab(param, affiliateTabs(shell)) === 'link';
  const wallet = useQuery({ queryKey: ['wallet', aff?.programId], queryFn: () => api.get<Wallet>(`/v1/me/affiliate/${aff!.programId}`), enabled: wantsLink && Boolean(aff) });
  // Bảng xếp hạng "chỉ cho affiliate": vừa có tài khoản affiliate (ví vừa tải xong) là tab Xếp hạng hiện ra, không chờ tải lại khung hội.
  const tabs = affiliateTabs(shell, wallet.isSuccess);
  const tab = currentAffiliateTab(param, tabs);
  const board = useQuery({ queryKey: ['leaderboard', c.id, period], queryFn: () => api.get<Board>(`/v1/communities/${c.id}/leaderboard?period=${period}`), enabled: tab === 'xep-hang', retry: false });
  const open = (t: AffiliateTab) => setParams({ tab: t });
  // Địa chỉ trỏ vào tab người xem không có (bảng xếp hạng đang tắt, link cũ): sửa địa chỉ theo tab đang mở thật, để
  // khi tab kia hiện ra sau đó (vừa có tài khoản affiliate) trang không tự nhảy sang.
  useEffect(() => { if (param && tab && param !== tab) setParams({ tab }, { replace: true }); }, [param, tab, setParams]);

  // Cách tính: số ngày giữ và mức rút tối thiểu lấy từ dữ liệu của tab đang mở.
  const rules = tab === 'link' ? wallet.data : board.data?.program;
  const how: Array<[ReactNode, string]> = aff && rules ? [
    [<WalletIcon size={16} key="w" className="flex-shrink-0" />, `Hoa hồng ${ratePercent(aff.rateBps)} mỗi kỳ thanh toán`],
    [<Clock size={16} key="c" className="flex-shrink-0" />, `Giữ ${rules.holdDays} ngày, rồi gửi yêu cầu rút từ ${money(rules.minWithdrawalMinor)}`],
    [<WalletIcon size={16} key="w2" className="flex-shrink-0" />, 'Chủ hội chuyển khoản trong 3 ngày làm việc'],
    [<ShieldCheck size={16} key="s" className="flex-shrink-0" />, 'Không tính tự giới thiệu và hoàn tiền'],
    [<LinkIcon size={16} key="l" className="flex-shrink-0" />, 'Link của bạn tính cho người mới vào hội trong 30 ngày sau lượt bấm cuối'],
    [<UserCheck size={16} key="r" className="flex-shrink-0" />, 'Hoa hồng luôn về người giới thiệu của thành viên, trừ khi thành viên tự đổi'],
    [<Users size={16} key="u" className="flex-shrink-0" />, 'Xếp hạng theo hoa hồng đã duyệt trong kỳ'],
  ] : [];

  return (
    <div className="two-col">
      <div className="main">
        <div className="flex items-start gap-x-3 gap-y-2 flex-wrap">
          <div className="flex-grow min-w-0 flex flex-col gap-1" style={{ flexBasis: 320 }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="serif m-0 text-[28px] font-extrabold page-title">Affiliate</h1>
              {running && aff && <Tag tone="gold">Hoa hồng {ratePercent(aff.rateBps)}</Tag>}
            </div>
            <div className="text-[14px]" style={{ color: T.ink2 }}>{running && aff ? affiliateHeadline(aff, c.name) : `Link giới thiệu và bảng xếp hạng affiliate của ${c.name}.`}</div>
          </div>
          {canManage && running && <Link to={`/${c.slug}/cong-su`} className="btn btn-ghost">Quản lý chương trình</Link>}
        </div>
        {!running && <ProgramOff name={c.name} slug={c.slug} canManage={canManage} canConfigure={shell.viewer.permissions.includes('settings.manage')} walletProgramId={aff?.hasAccount ? aff.programId : null} />}
        {tabs.length > 1 && (
          <div className="seg w-full sm:w-auto sm:self-start" role="tablist" aria-label="Các phần của trang Affiliate">
            {tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : undefined} onClick={() => open(t)}>{AFFILIATE_TAB_LABEL[t]}</button>)}
          </div>
        )}
        {tab === 'link' && <QueryState q={wallet} rows={3}>{(w) => <MyLink w={w} community={c} />}</QueryState>}
        {tab === 'xep-hang' && (
          <RankBoard
            q={board}
            period={period}
            onPeriod={setPeriod}
            note={canManage && leaderboardAudience(shell) === 'managers' ? <div className="text-[14px] rounded-[10px] px-3.5 py-2.5" style={{ background: T.goldSoft, color: T.goldText }}>Chỉ người quản lý hội thấy bảng này. Bảng xếp hạng đang tắt với thành viên.</div> : undefined}
            fallback={tabs.includes('link') ? <button type="button" className="btn btn-dark" onClick={() => open('link')}>Mở link của tôi</button> : undefined}
          />
        )}
      </div>
      <aside className="rail">
        <ReferrerCard communityId={c.id} />
        {how.length > 0 && (
          <div className="card p-4 flex flex-col gap-2.5">
            <div className="font-semibold">Cách tính</div>
            {how.map(([icon, text], i) => <div key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.5]" style={{ color: T.ink2 }}><span className="pt-0.5">{icon}</span>{text}</div>)}
          </div>
        )}
        {tab === 'xep-hang' && board.data && (
          <div className="card p-4 flex flex-col gap-2">
            <div className="font-semibold">Tổng affiliate tháng này</div>
            <div className="flex items-baseline gap-2"><span className="serif text-[26px] font-extrabold">{board.data.stats.activeAffiliates}</span><span className="muted text-[13px]">affiliate có phát sinh</span></div>
            {/* Máy chủ trả sẵn số phần trăm (0 đến 100), không phải tỷ lệ 0 đến 1. */}
            <Prog value={board.data.stats.referredRevenueShare} />
            <div className="muted text-[12px]">{board.data.stats.referredRevenueShare}% doanh thu tháng này đến từ giới thiệu</div>
          </div>
        )}
      </aside>
    </div>
  );
}
