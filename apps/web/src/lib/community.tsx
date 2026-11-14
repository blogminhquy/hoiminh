// Ngữ cảnh hội hiện tại: khung hội theo slug (GET /v1/communities/by-slug/:slug/shell), quyền của người xem.
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { PaymentProvider, PlanFeature, PlanKey, PricingPromo, TierTerm } from '@hoiminh/contracts';
import { api } from './api';

export interface ShellPlan { key: PlanKey; name: string; memberCap: number | null; features: PlanFeature[]; endsAt: string | null; needsPlan: boolean; full: boolean; isFreeSlot: boolean }

export interface Shell {
  community: { id: string; workspaceId: string; name: string; slug: string; shortDescription: string; logoMark: string; logoColor: string; logoUrl: string | null; coverColor: string; coverUrl: string | null; coverTagline: string; tabs: Record<string, boolean>; status: string; pricingMode: string; doorsOpen: boolean; /** Hội đã cài ít nhất một cách nhận tiền chưa: chưa thì các nút mua bị khóa. */ paymentsReady: boolean; /** Các cách người mua chọn được (chỉ cách chủ hội đã cài và đang bật). */ paymentMethods: PaymentProvider[]; /** Cách chọn sẵn ở bước thanh toán. */ defaultPaymentMethod: PaymentProvider | null; /** Chuyển khoản QR: chủ hội bấm xác nhận hay tự xác nhận qua SePay (null khi tắt). */ bankConfirmMode: 'manual' | 'auto' | null; customDomain: string | null; memberCount: number; requireSpace: boolean; enabledProviders: string[] };
  /** Gói đang có hiệu lực của hội. Chỉ người quản lý hội mới nhận được, thành viên thường là null. */
  plan: ShellPlan | null;
  viewer: { role: string; memberId: string | null; memberStatus: string | null; tier: { key: string; name: string } | null; permissions: string[]; isMember: boolean };
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

export function isPremium(shell: Shell): boolean {
  return shell.viewer.tier?.key === 'premium' || shell.viewer.tier?.key === 'vip' || shell.viewer.role === 'owner' || shell.viewer.role === 'admin';
}
