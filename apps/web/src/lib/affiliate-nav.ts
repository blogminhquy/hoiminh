// Affiliate của thành viên trong một hội: khi nào hiện mục "Affiliate" trên thanh bên, trang Affiliate của hội có những
// tab nào, ai xem được bảng xếp hạng. Hàm thuần để test được, không gọi API ở đây. Phần quản lý chương trình của chủ
// hội (nhóm Quản lý trên thanh bên) không nằm ở đây.
import { ratePercent } from './affiliate-link';
import type { Shell, ShellAffiliate } from './community';

/** Phần của khung hội mà các hàm dưới đây cần. `affiliate` có thể thiếu khi web mới gặp máy chủ cũ trong lúc triển khai. */
export interface AffiliateScope {
  viewer: Pick<Shell['viewer'], 'isMember' | 'permissions'>;
  community: Pick<Shell['community'], 'tabs'>;
  affiliate?: ShellAffiliate | null;
}

/**
 * Mục "Affiliate" ở nhóm Hội trên thanh bên: trả nhãn phần trăm hoa hồng ("40%") khi mục được hiện, null khi ẩn.
 * Hiện khi người xem là thành viên và chương trình affiliate của hội đang chạy (đang bật, gói của hội có affiliate).
 * Không phụ thuộc bảng xếp hạng: hội tắt bảng xếp hạng thì thành viên vẫn phải lấy được link.
 */
export function affiliateNavRate(scope: AffiliateScope): string | null {
  const a = scope.affiliate;
  if (!scope.viewer.isMember || !a?.enabled) return null;
  return ratePercent(a.rateBps);
}

/**
 * Ai (ngoài người quản lý) đang xem được bảng xếp hạng. `managers`: bảng đang tắt với thành viên, vì chủ hội để "ẩn",
 * chủ hội tắt tab, nền tảng tắt cờ bảng xếp hạng, hoặc gói của hội không có affiliate (ba trường hợp sau máy chủ gộp
 * vào `tabs.affiliate`).
 */
export function leaderboardAudience(scope: AffiliateScope): 'members' | 'affiliates_only' | 'managers' {
  const v = scope.affiliate?.leaderboardVisibility ?? 'hidden';
  if (scope.community.tabs.affiliate === false || v === 'hidden') return 'managers';
  return v;
}

/**
 * Người xem có thấy tab "Xếp hạng" không. Khớp với điều kiện của máy chủ (`affiliate.leaderboard`): người quản lý
 * chương trình luôn xem được; thành viên xem được khi bảng mở cho thành viên, hoặc mở cho affiliate và họ đã có tài
 * khoản affiliate. `hasAccountNow`: vừa mở tài khoản trong phiên này (khung hội chưa kịp tải lại).
 */
export function canSeeLeaderboard(scope: AffiliateScope, hasAccountNow = false): boolean {
  const a = scope.affiliate;
  if (!scope.viewer.isMember || !a) return false;
  if (scope.viewer.permissions.includes('affiliates.manage')) return true;
  const audience = leaderboardAudience(scope);
  if (audience === 'managers') return false;
  return audience === 'members' || a.hasAccount || hasAccountNow;
}

export type AffiliateTab = 'link' | 'xep-hang';
export const AFFILIATE_TAB_LABEL: Record<AffiliateTab, string> = { link: 'Link của tôi', 'xep-hang': 'Xếp hạng' };

/**
 * Các tab của trang Affiliate trong hội, theo thứ tự hiện. "Link của tôi" có khi chương trình đang chạy (cùng điều kiện
 * với mục trên thanh bên). Mảng rỗng: trang chỉ báo hội chưa bật affiliate.
 */
export function affiliateTabs(scope: AffiliateScope, hasAccountNow = false): AffiliateTab[] {
  const tabs: AffiliateTab[] = [];
  if (affiliateNavRate(scope) !== null) tabs.push('link');
  if (canSeeLeaderboard(scope, hasAccountNow)) tabs.push('xep-hang');
  return tabs;
}

/** Tab đang mở theo `?tab=` trên địa chỉ. Thiếu, sai hoặc trỏ vào tab người xem không có thì mở tab đầu tiên. */
export function currentAffiliateTab(param: string | null, tabs: AffiliateTab[]): AffiliateTab | null {
  return tabs.find((t) => t === param) ?? tabs[0] ?? null;
}

/** Dòng dưới tiêu đề trang: quyền lợi bằng số thật. "Giới thiệu người vào Hội A, nhận 40% hoa hồng mỗi lần họ trả phí." */
export function affiliateHeadline(a: Pick<ShellAffiliate, 'rateBps' | 'durationMonths'>, communityName: string): string {
  const span = a.durationMonths ? ` trong ${a.durationMonths} tháng đầu` : '';
  return `Giới thiệu người vào ${communityName}, nhận ${ratePercent(a.rateBps)} hoa hồng mỗi lần họ trả phí${span}.`;
}
