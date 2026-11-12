// Màn "cài ra màn hình chính" (kế hoạch 11/11/2026, mục 7). Bọc quanh các khu vực của người đã đăng nhập: trên điện
// thoại, từ lần vào thứ hai, thành viên phải thêm Hội Mình vào màn hình chính mới dùng tiếp. Ba màn theo thiết bị:
// iPhone (hướng dẫn 3 bước của Safari), trình duyệt trong Zalo, Facebook, Messenger (mở bằng Safari hoặc Chrome, kèm link
// đăng nhập một lần), Android (cài bằng một lần bấm rồi mời bật thông báo). Máy không cài được thì cho vào bình thường.
// Quản trị hệ thống bật tắt cả cơ chế này ở Hệ thống, Gói nền tảng. Các trang công khai không đi qua đây.
import { useMutation } from '@tanstack/react-query';
import { Bell, Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { IN_APP_NAME, currentDevice } from '@/lib/device';
import { countVisit, gateScreen } from '@/lib/install-gate';
import { enablePush, pushPermission, useInstallPrompt } from '@/lib/pwa';

// Màn này luôn nền tối, không theo giao diện sáng tối của ứng dụng, để giống một màn chào của ứng dụng.
const C = { bg: '#0E1716', ink: '#EAF1EF', sub: '#BECBC8', mute: '#93A5A1', card: '#162221', line: '#24322F', teal: '#0F7A81', tealSoft: '#12383B', tealInk: '#7FDBE0', gold: '#F5B841', goldInk: '#E3C27E' };

function Frame({ children, top = 56 }: { children: ReactNode; top?: number }) {
  const { logout } = useAuth();
  return (
    <div role="dialog" aria-modal="true" aria-label="Cài Hội Mình ra màn hình chính" className="fixed inset-0 z-50 overflow-y-auto" style={{ background: C.bg, color: C.ink }}>
      <div className="mx-auto flex flex-col gap-5 min-h-full" style={{ maxWidth: 440, padding: `${top}px 24px 28px`, fontSize: 16, lineHeight: 1.5 }}>
        {children}
        <button type="button" onClick={() => void logout()} className="self-center" style={{ minHeight: 44, padding: '0 16px', color: C.mute, fontSize: 15, fontWeight: 600 }}>Đăng xuất</button>
      </div>
    </div>
  );
}

function Head({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {icon ?? <img src="/icons/icon-192.png" alt="" width={84} height={84} style={{ borderRadius: 22 }} />}
      <h1 className="m-0" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{title}</h1>
      <p className="m-0" style={{ color: C.sub, fontSize: 16 }}>{children}</p>
    </div>
  );
}

function Step({ n, children, icon }: { n: number; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5" style={{ padding: '14px 16px', borderRadius: 14, background: C.card, border: `1px solid ${C.line}` }}>
      <span className="flex-shrink-0 inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 999, background: C.tealSoft, color: C.tealInk, fontWeight: 800 }}>{n}</span>
      <span className="flex-grow" style={{ fontSize: 16 }}>{children}</span>
      {icon}
    </div>
  );
}

const ShareIcon = () => <svg role="img" aria-label="Nút Chia sẻ" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4CC2C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M7 11H5v10h14V11h-2" /></svg>;
const AddIcon = () => <svg role="img" aria-label="Thêm vào Màn hình chính" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4CC2C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg>;

/** iPhone: Safari không có nút cài, người dùng tự thêm qua nút Chia sẻ. */
function IosScreen() {
  return (
    <Frame>
      <Head title="Thêm Hội Mình vào màn hình chính">Để nhận thông báo của hội và mở lại bằng một lần chạm. Làm một lần là xong.</Head>
      <div className="flex flex-col gap-3">
        <Step n={1} icon={<ShareIcon />}>Bấm nút Chia sẻ ở thanh công cụ của trình duyệt</Step>
        <Step n={2} icon={<AddIcon />}>Kéo xuống, chọn "Thêm vào Màn hình chính"</Step>
        <Step n={3}>Mở Hội Mình từ biểu tượng vừa thêm</Step>
      </div>
      <span className="flex-grow" />
      <div className="flex flex-col items-center gap-2 text-center">
        <span style={{ fontSize: 15, color: C.goldInk }}>Trên Safari, nút Chia sẻ nằm ở thanh dưới cùng</span>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v15M6 13l6 6 6-6" /></svg>
      </div>
    </Frame>
  );
}

/** Trong Zalo, Facebook, Messenger: trình duyệt của các ứng dụng này không cài được, phải sang Safari hoặc Chrome. */
function InAppScreen({ appName }: { appName: string }) {
  const [copied, setCopied] = useState(false);
  const link = useMutation({ mutationFn: () => api.post<{ url: string }>('/v1/auth/login-link', {}) });
  // Lấy link sẵn từ lúc mở màn, để lúc bấm nút thì sao chép được ngay trong đúng thao tác bấm (trình duyệt đòi vậy).
  useEffect(() => { link.mutate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const url = link.data?.url ?? '';
  const copy = async () => {
    const text = url || (await link.mutateAsync().then((r) => r.url, () => ''));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Trình duyệt trong ứng dụng chặn sao chép: người dùng nhấn giữ vào ô link bên dưới để sao chép tay.
      setCopied(false);
    }
  };
  return (
    <Frame>
      <Head title="Mở bằng Safari hoặc Chrome">Bạn đang mở Hội Mình trong {appName}. Trình duyệt trong Zalo, Facebook, Messenger không cài được ra màn hình chính.</Head>
      <div className="flex flex-col gap-3">
        <Step n={1}>Bấm nút bên dưới để sao chép link đăng nhập</Step>
        <Step n={2}>Mở Safari hoặc Chrome, dán link vào ô địa chỉ</Step>
        <Step n={3}>Bạn được đăng nhập sẵn, không phải gõ lại mật khẩu</Step>
      </div>
      <span className="flex-grow" />
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={() => void copy()} disabled={link.isPending && !url} className="flex items-center justify-center gap-2.5" style={{ minHeight: 54, borderRadius: 14, background: C.teal, color: '#FFFFFF', fontSize: 17, fontWeight: 700, opacity: link.isPending && !url ? 0.7 : 1 }}>
          {copied ? <Check size={20} /> : <Copy size={20} />}{copied ? 'Đã sao chép, mở Safari hoặc Chrome để dán' : 'Sao chép link đăng nhập'}
        </button>
        {url && <input readOnly aria-label="Link đăng nhập một lần" value={url} onFocus={(e) => e.currentTarget.select()} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.sub, fontSize: 14, padding: '0 12px', width: '100%' }} />}
        {link.isError && <span role="alert" style={{ fontSize: 15, color: '#FDBA74', textAlign: 'center' }}>{errorMessage(link.error)}</span>}
        <span style={{ fontSize: 15, color: C.mute, textAlign: 'center' }}>Link chỉ dùng được một lần, trong 10 phút.</span>
      </div>
    </Frame>
  );
}

/** Android: trình duyệt có sẵn hộp cài, một lần bấm là xong; cài xong thì mời bật thông báo. */
function AndroidScreen({ step, onInstall, onDone, pushKey }: { step: 'install' | 'notify'; onInstall: () => Promise<void>; onDone: () => void; pushKey: string | null }) {
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  if (step === 'notify') {
    const turnOn = async () => {
      if (!pushKey) { onDone(); return; }
      setBusy(true);
      const r = await enablePush(pushKey).catch(() => 'denied' as const);
      setBusy(false);
      if (r === 'enabled') onDone(); else setDenied(true);
    };
    return (
      <Frame top={72}>
        <Head icon={<span className="inline-flex items-center justify-center" style={{ width: 84, height: 84, borderRadius: 999, background: C.tealSoft }}><Bell size={40} color={C.tealInk} /></span>} title="Đã cài xong. Bật thông báo nhé?">
          Hội báo cho bạn khi có người trả lời bình luận, có bài mới của chủ hội, hoặc sắp tới giờ sự kiện bạn đã đăng ký.
        </Head>
        <span className="flex-grow" />
        <div className="flex flex-col gap-2.5">
          {denied && <span role="alert" style={{ fontSize: 15, color: '#FDBA74', textAlign: 'center' }}>Chưa bật được thông báo. Bạn bật lại sau trong trang Thông báo.</span>}
          <button type="button" disabled={busy} onClick={() => void turnOn()} style={{ minHeight: 56, borderRadius: 14, background: C.teal, color: '#FFFFFF', fontSize: 18, fontWeight: 700 }}>{busy ? 'Đang bật...' : 'Bật thông báo'}</button>
          <button type="button" onClick={onDone} style={{ minHeight: 48, borderRadius: 14, color: C.sub, fontSize: 16, fontWeight: 600 }}>Để sau</button>
        </div>
      </Frame>
    );
  }
  return (
    <Frame top={72}>
      <Head title="Cài Hội Mình ra màn hình chính">Một lần bấm là xong. Sau đó bạn mở hội như một ứng dụng và nhận được thông báo.</Head>
      <span className="flex-grow" />
      <button type="button" disabled={busy} onClick={() => { setBusy(true); void onInstall().finally(() => setBusy(false)); }} style={{ minHeight: 56, borderRadius: 14, background: C.teal, color: '#FFFFFF', fontSize: 18, fontWeight: 700 }}>Cài ứng dụng</button>
    </Frame>
  );
}

export function InstallGate({ children }: { children: ReactNode }) {
  const { user, app } = useAuth();
  const prompt = useInstallPrompt();
  const device = useMemo(() => currentDevice(), []);
  // Đếm lần vào một lần cho mỗi phiên trình duyệt của mỗi tài khoản.
  const visits = useMemo(() => (user ? countVisit(user.id) : 1), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Android: cài xong trong phiên này thì hỏi bật thông báo, rồi cho dùng tiếp.
  const [after, setAfter] = useState<'none' | 'notify' | 'done'>('none');
  if (!user) return <>{children}</>;
  const screen = gateScreen({ enabled: app.installGate, device, visits, superAdmin: user.isSuperAdmin === true, installPrompt: prompt.state, installedThisSession: after === 'done' });
  if (after === 'notify') return <AndroidScreen step="notify" pushKey={app.push.enabled ? app.push.publicKey : null} onInstall={async () => undefined} onDone={() => setAfter('done')} />;
  if (screen === 'pass') return <>{children}</>;
  if (screen === 'checking') return <div className="fixed inset-0 z-50" style={{ background: C.bg }} aria-busy="true" />;
  if (screen === 'in-app') return <InAppScreen appName={device.inApp ? IN_APP_NAME[device.inApp] : 'ứng dụng khác'} />;
  if (screen === 'ios') return <IosScreen />;
  const install = async () => {
    const outcome = await prompt.install();
    // Người dùng đồng ý cài: mời bật thông báo nếu thiết bị hỏi được, không thì cho dùng tiếp luôn.
    if (outcome === 'accepted') setAfter(app.push.enabled && pushPermission() === 'default' ? 'notify' : 'done');
  };
  return <AndroidScreen step="install" pushKey={null} onInstall={install} onDone={() => setAfter('done')} />;
}
