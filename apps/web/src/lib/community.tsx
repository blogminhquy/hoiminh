// Ngữ cảnh hội hiện tại: khung hội theo slug (GET /v1/communities/by-slug/:slug/shell), quyền của người xem.
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { api } from './api';

export interface Shell {
  community: { id: string; workspaceId: string; name: string; slug: string; shortDescription: string; logoMark: string; logoColor: string; logoUrl: string | null; coverColor: string; coverUrl: string | null; coverTagline: string; tabs: Record<string, boolean>; status: string; pricingMode: string; doorsOpen: boolean; customDomain: string | null; memberCount: number; requireSpace: boolean; enabledProviders: string[] };
  viewer: { role: string; memberId: string | null; memberStatus: string | null; tier: { key: string; name: string } | null; permissions: string[]; isMember: boolean };
  stats: { members: number; online: number; admins: number; upcomingEvents: number };
  coursePercent: number | null;
  upcomingEvents: Array<{ id: string; title: string; startsAt: string; endsAt: string; kind: string; meetingProvider: string | null; location: string | null }>;
  premium: { tierId: string; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null; benefits: string[] } | null;
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

export function isPremium(shell: Shell): boolean {
  return shell.viewer.tier?.key === 'premium' || shell.viewer.tier?.key === 'vip' || shell.viewer.role === 'owner' || shell.viewer.role === 'admin';
}
