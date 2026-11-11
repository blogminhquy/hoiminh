// Phần "ứng dụng cài ra màn hình chính" của web: đăng ký service worker, giữ sự kiện cài một lần bấm của Android,
// và bật tắt thông báo đẩy. Tệp này được nạp ngay khi ứng dụng khởi động (main.tsx) vì trình duyệt chỉ phát sự kiện
// `beforeinstallprompt` một lần, rất sớm.
import { useEffect, useState } from 'react';
import { api } from './api';
import type { InstallPrompt } from './install-gate';

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
/** Mốc ứng dụng khởi động: chỉ chờ sự kiện cài trong vài giây đầu, không chờ lại mỗi lần chuyển trang. */
const loadedAt = Date.now();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chặn thanh mời cài mặc định của trình duyệt: màn hướng dẫn của Hội Mình sẽ tự hỏi đúng lúc.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Đăng ký service worker (chỉ lo thông báo đẩy). Trình duyệt không hỗ trợ hoặc chặn thì bỏ qua. */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const run = () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/** Trình duyệt có sẵn nút cài một lần bấm chưa. Chờ tối đa `waitMs`, quá hạn thì coi như không hỗ trợ. */
export function useInstallPrompt(waitMs = 2500): { state: InstallPrompt; installed: boolean; install: () => Promise<'accepted' | 'dismissed' | 'unavailable'> } {
  const [, bump] = useState(0);
  const left = waitMs - (Date.now() - loadedAt);
  const [timedOut, setTimedOut] = useState(left <= 0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    const t = left > 0 ? window.setTimeout(() => setTimedOut(true), left) : undefined;
    return () => { listeners.delete(fn); if (t) window.clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const state: InstallPrompt = deferred ? 'ready' : timedOut ? 'unavailable' : 'waiting';
  const install = async () => {
    const e = deferred;
    if (!e) return 'unavailable' as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // Sự kiện chỉ dùng được một lần.
    deferred = null;
    if (outcome === 'accepted') installed = true;
    emit();
    return outcome;
  };
  return { state, installed, install };
}

/** Thiết bị này nhận được thông báo đẩy không. Trên iPhone chỉ có khi đã mở từ biểu tượng ở màn hình chính. */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

function keyBytes(base64url: string): Uint8Array {
  const s = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Xin quyền thông báo rồi đăng ký thiết bị này với máy chủ. Phải gọi trong lúc người dùng vừa bấm nút,
 * vì trình duyệt chỉ cho hỏi quyền khi có thao tác của người dùng.
 */
export async function enablePush(publicKey: string): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as unknown as BufferSource }));
  const json = sub.toJSON();
  await api.post('/v1/me/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return 'enabled';
}

/** Tắt thông báo đẩy trên thiết bị này. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/v1/me/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** Thiết bị này đang đăng ký nhận thông báo đẩy không. */
export async function pushEnabledHere(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await reg?.pushManager.getSubscription());
}

const ASK_EVENT = 'hm:push-ask';
/** Gọi sau một việc khiến người dùng muốn được báo lại (vừa bình luận, vừa đăng ký sự kiện): mời bật thông báo. */
export function askForPushSoon(reason: 'comment' | 'event' = 'comment'): void {
  try { window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: reason })); } catch { /* bỏ qua */ }
}
export function onPushAsk(fn: (reason: 'comment' | 'event') => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<'comment' | 'event'>).detail ?? 'comment');
  window.addEventListener(ASK_EVENT, h);
  return () => window.removeEventListener(ASK_EVENT, h);
}
