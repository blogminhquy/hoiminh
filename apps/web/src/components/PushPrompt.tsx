// Mời bật thông báo đúng lúc (kế hoạch 11/11/2026: "xin quyền thông báo đúng lúc, ví dụ ngay sau khi thành viên bình luận").
// Không hỏi lúc vừa mở ứng dụng. Chỉ hiện khi: máy chủ có thông báo đẩy, thiết bị nhận được, người dùng chưa trả lời câu hỏi
// quyền, và 14 ngày gần đây chưa bị hỏi. Nằm ở đáy màn hình, không che nội dung chính.
import { T } from '@hoiminh/ui';
import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { enablePush, onPushAsk, pushPermission } from '@/lib/pwa';

const ASKED_KEY = 'hm_push_asked_at';
const QUIET_MS = 14 * 86_400_000;

function askedRecently(): boolean {
  try { return Date.now() - Number(localStorage.getItem(ASKED_KEY) ?? '0') < QUIET_MS; } catch { return true; }
}
function rememberAsked(): void {
  try { localStorage.setItem(ASKED_KEY, String(Date.now())); } catch { /* bỏ qua */ }
}

const WHY: Record<'comment' | 'event', string> = {
  comment: 'Bật thông báo để biết ngay khi có người trả lời bình luận của bạn.',
  event: 'Bật thông báo để được nhắc khi sắp tới giờ sự kiện.',
};

export function PushPrompt() {
  const { user, app } = useAuth();
  const [reason, setReason] = useState<'comment' | 'event' | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ready = Boolean(user && app.push.enabled && app.push.publicKey);
  useEffect(() => {
    if (!ready) return undefined;
    return onPushAsk((r) => {
      if (pushPermission() !== 'default' || askedRecently()) return;
      setReason(r);
    });
  }, [ready]);
  if (!reason || !ready) return null;
  const close = () => { rememberAsked(); setReason(null); setNote(null); };
  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush(app.push.publicKey!).catch(() => 'denied' as const);
    setBusy(false);
    rememberAsked();
    if (r === 'enabled') { setNote('Đã bật thông báo trên thiết bị này.'); window.setTimeout(() => setReason(null), 2500); }
    else setNote('Chưa bật được. Bạn bật lại sau trong trang Thông báo.');
  };
  return (
    <div role="dialog" aria-label="Bật thông báo" className="fixed left-0 right-0 z-40 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
      <div className="card mx-auto flex items-start gap-3 p-4" style={{ maxWidth: 480, boxShadow: '0 12px 32px rgba(8,24,23,0.22)' }}>
        <span className="w-10 h-10 rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ background: T.tealSoft, color: T.tealText }}><Bell size={20} /></span>
        <div className="flex flex-col gap-2.5 flex-grow min-w-0">
          <span className="text-[15px]">{note ?? WHY[reason]}</span>
          {!note && (
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void turnOn()}>{busy ? 'Đang bật...' : 'Bật thông báo'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Để sau</button>
            </div>
          )}
        </div>
        <button type="button" aria-label="Đóng" onClick={close} className="flex-shrink-0 w-9 h-9 inline-flex items-center justify-center" style={{ color: T.ink3 }}><X size={18} /></button>
      </div>
    </div>
  );
}
