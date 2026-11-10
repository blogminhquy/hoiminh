// Trạng thái đăng nhập toàn app: user hiện tại, hội của tôi, đăng nhập/đăng xuất, badge tin nhắn + thông báo.
import type { AuthSession, AuthUser } from '@hoiminh/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, hasSession, migrateLegacySession } from './api';
import { usePollInterval, useRealtime } from './realtime';

export interface MyCommunity {
  id: string; name: string; slug: string; logoMark: string; logoColor: string; memberCount: number; status: string; role: string; memberStatus: string; pinned: boolean;
}
interface MeResponse {
  user: AuthUser;
  profile: Record<string, unknown> & { bio: string; location: string; occupation: string; coverColor: string | null; links: Array<{ kind: string; label: string; url: string }>; privacy: Record<string, boolean> };
  communities: MyCommunity[];
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: MeResponse['profile'] | null;
  communities: MyCommunity[];
  loading: boolean;
  setSession: (s: AuthSession) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // Chuyển phiên cũ (localStorage) sang cookie trước khi hỏi /v1/me; khách chưa đăng nhập không gọi gì.
  const [migrated, setMigrated] = useState(false);
  useEffect(() => { void migrateLegacySession().finally(() => setMigrated(true)); }, []);
  const [, bump] = useState(0);
  const enabled = migrated && hasSession();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api.get<MeResponse>('/v1/me'), enabled, retry: false, staleTime: 60_000 });
  useRealtime(Boolean(enabled && q.data));
  const setSession = useCallback((s: AuthSession) => {
    // API đã đặt cookie phiên; chỉ cần vẽ lại để đọc cờ đăng nhập mới.
    bump((n) => n + 1);
    qc.setQueryData(['me'], (old: MeResponse | undefined) => ({ user: s.user, profile: old?.profile ?? ({} as MeResponse['profile']), communities: old?.communities ?? [] }));
    void qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);
  const logout = useCallback(async () => {
    try { await api.post('/v1/auth/logout'); } catch { /* bỏ qua */ }
    qc.clear();
    window.location.href = '/dang-nhap';
  }, [qc]);
  const refresh = useCallback(async () => { await qc.invalidateQueries({ queryKey: ['me'] }); }, [qc]);
  const value = useMemo<AuthContextValue>(() => ({ user: enabled && q.data ? q.data.user : null, profile: q.data?.profile ?? null, communities: q.data?.communities ?? [], loading: !migrated || (enabled && q.isLoading), setSession, logout, refresh }), [migrated, enabled, q.data, q.isLoading, setSession, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}

/** Badge tin nhắn/thông báo: cập nhật qua kênh thời gian thực; mất kênh thì hỏi lại mỗi 15 giây. */
export function useBadges() {
  const { user } = useAuth();
  const refetchInterval = usePollInterval(15_000);
  return useQuery({ queryKey: ['badges'], queryFn: () => api.get<{ unreadNotifications: number; unreadMessages: number }>('/v1/me/badges'), enabled: Boolean(user), refetchInterval, staleTime: 10_000 });
}

/** Hội "hiện tại" để render tin nhắn/thông báo/tài khoản trong khung hội. */
export function currentCommunitySlug(fallback?: string | null): string | null {
  try {
    return localStorage.getItem('hm_current_slug') ?? fallback ?? null;
  } catch {
    return fallback ?? null;
  }
}
export function rememberCommunitySlug(slug: string): void {
  try { localStorage.setItem('hm_current_slug', slug); } catch { /* bỏ qua */ }
}

/** Hội nên mở mặc định: hội đã ghi nhớ nếu còn trong danh sách, nếu không thì hội mình làm chủ trước, rồi tới hội đang hoạt động đông thành viên nhất. */
export function preferredCommunitySlug(communities: MyCommunity[]): string | null {
  const remembered = currentCommunitySlug(null);
  if (remembered && communities.some((c) => c.slug === remembered)) return remembered;
  const ranked = [...communities].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.role === 'owner') - Number(a.role === 'owner') || Number(b.status === 'active') - Number(a.status === 'active') || b.memberCount - a.memberCount);
  return ranked[0]?.slug ?? null;
}
