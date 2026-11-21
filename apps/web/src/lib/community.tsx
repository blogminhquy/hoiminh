// Ngữ cảnh hội hiện tại: khung hội theo slug (GET /v1/communities/by-slug/:slug/shell), quyền của người xem.
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { PaymentProvider, PlanFeature, PlanKey, PricingPromo, TierTerm } from '@hoiminh/contracts';
import { api } from './api';

export interface ShellPlan { key: PlanKey; name: string; memberCap: number | null; features: PlanFeature[]; endsAt: string | null; needsPlan: boolean; full: boolean; isFreeSlot: boolean }

/**
 * Affiliate của hội với người xem (chỉ thành viên mới nhận). `enabled`: chương trình đang bật và gói của hội có
 * affiliate. `rateBps`: mức hoa hồng của người xem (mức riêng nếu có, không thì mức chung). `hasAccount`: người xem đã
 * có tài khoản affiliate trong hội này. `leaderboardVisibility`: chủ hội cho ai xem bảng xếp hạng.
 */
export interface ShellAffiliate { programId: string; enabled: boolean; rateBps: number; durationMonths: number | null; hasAccount: boolean; leaderboardVisibility: 'members' | 'affiliates_only' | 'hidden' }

export interface Shell {
  community: { id: string; workspaceId: string; name: string; slug: string; shortDescription: string; logoMark: string; logoColor: string; logoUrl: string | null; coverColor: string; coverUrl: string | null; coverTagline: string; tabs: Record<string, boolean>; status: string; /** Hội kín: chỉ thành viên xem được bên trong. Hội mở: ai cũng xem được, chỉ thành viên mới đăng bài, bình luận, học. */ visibility: 'private' | 'public'; pricingMode: string; doorsOpen: boolean; /** Hội đã cài ít nhất một cách nhận tiền chưa: chưa thì các nút mua bị khóa. */ paymentsReady: boolean; /** Các cách người mua chọn được (chỉ cách chủ hội đã cài và đang bật). */ paymentMethods: PaymentProvider[]; /** Cách chọn sẵn ở bước thanh toán. */ defaultPaymentMethod: PaymentProvider | null; /** Chuyển khoản QR: chủ hội bấm xác nhận hay tự xác nhận qua SePay (null khi tắt). */ bankConfirmMode: 'manual' | 'auto' | null; customDomain: string | null; memberCount: number; requireSpace: boolean; enabledProviders: string[] };
  /** Gói đang có hiệu lực của hội. Chỉ người quản lý hội mới nhận được, thành viên thường là null. */
  plan: ShellPlan | null;
  viewer: { role: string; memberId: string | null; memberStatus: string | null; tier: { key: string; name: string } | null; permissions: string[]; /** Vào xem được bên trong hội: thành viên, hoặc bất kỳ ai khi hội mở. */ canView: boolean; isMember: boolean };
  /** Affiliate của hội với người xem. null khi người xem chưa là thành viên hoặc hội chưa có chương trình affiliate. */
  affiliate: ShellAffiliate | null;
  stats: { members: number; online: number; admins: number; upcomingEvents: number };
  coursePercent: number | null;
  upcomingEvents: Array<{ id: string; title: string; startsAt: string; endsAt: string; kind: string; meetingProvider: string | null; location: string | null }>;
  /** Gói Premium đang bán: `terms` là các kỳ hạn (số tháng và giá), `promo` là khuyến mãi đang chạy (hết hạn thì null). */
  premium: { tierId: string; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null; terms: TierTerm[]; promo: PricingPromo | null; benefits: string[] } | null;
}

export const shellKey = (slug: string) => ['shell', slug] as const;

export function useShellQuery(slug: string | null | undefined) {
  return useQuery({ queryKey: shellKey(slug ?? ''), queryFn: () => api.get<Shell>(`/v1/communities/by-slug/${slug}/shell`), enabled: Boolean(slug), staleTime: 30_000 });
}

const ShellContext = createContext<Shell | null>(null);
export const ShellProvider = ShellContext.Provider;

/** Khung hội hiện tại (bắt buộc nằm trong AppShell). */
export function useShell(): Shell {
  const s = useContext(ShellContext);
  if (!s) throw new Error('useShell phải nằm trong AppShell');
  return s;
}

/** Khung hội nếu đang ở trong AppShell, null khi trang chạy ngoài khung hội (ví dụ Khu học tập /hoc). */
export function useOptionalShell(): Shell | null {
  return useContext(ShellContext);
}

/** Người xem có quyền không. */
export function useCan(): (permission: string) => boolean {
  const s = useShell();
  return (p) => s.viewer.permissions.includes(p);
}

/** Người xem có quyền quản lý hội này không (chủ hội, quản trị): thấy Bàn điều khiển thay cho trang Hôm nay của thành viên. */
export function canManage(shell: Shell): boolean {
  return ['settings.manage', 'billing.manage', 'revenue.read'].some((p) => shell.viewer.permissions.includes(p));
}

/** Người xem đang ở trong một hội mở mà chưa là thành viên: chỉ xem, chưa đăng bài, bình luận hay học được. */
export function isGuest(shell: Shell): boolean {
  return !shell.viewer.isMember;
}

/**
 * Người ngoài của một hội kín: chưa là thành viên và hội không mở cho khách xem. Họ chỉ tới được trang giới thiệu và
 * trang bán của sản phẩm, nên ở trang bán các lối dẫn vào bên trong hội (cửa hàng, bài học thử) phải ẩn hoặc đổi hướng.
 */
export function isOutsider(shell: Shell): boolean {
  return !shell.viewer.isMember && !shell.viewer.canView;
}

/**
 * Cổng "tham gia hội" cho khách xem hội mở. `guest`: người xem chưa là thành viên. `askJoin`: mở lời mời tham gia,
 * gọi ở mọi nút cần là thành viên (thả tim, bình luận, bình chọn, đăng ký sự kiện). Ngoài khung hội thì `guest` luôn là false.
 */
export interface JoinGate { guest: boolean; askJoin: () => void }
const JoinGateContext = createContext<JoinGate>({ guest: false, askJoin: () => undefined });
export const JoinGateProvider = JoinGateContext.Provider;
export function useJoinGate(): JoinGate {
  return useContext(JoinGateContext);
}

export function isPremium(shell: Shell): boolean {
  return shell.viewer.tier?.key === 'premium' || shell.viewer.tier?.key === 'vip' || shell.viewer.role === 'owner' || shell.viewer.role === 'admin';
}
