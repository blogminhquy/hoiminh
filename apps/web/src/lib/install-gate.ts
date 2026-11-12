// Luật của màn "cài ra màn hình chính" (kế hoạch 11/11/2026, mục 7). Hàm thuần để test được.
// - Chỉ áp dụng cho người đã đăng nhập, trên điện thoại, khi quản trị hệ thống bật công tắc.
// - Lần vào đầu tiên cho dùng luôn, từ lần thứ hai mới bắt cài (để người vừa trả tiền không bị chặn).
// - Trong trình duyệt của Zalo, Facebook, Messenger: hướng dẫn mở bằng Safari hoặc Chrome, kèm link đăng nhập một lần.
// - Máy hoặc trình duyệt không cài được thì cho vào bình thường.
import type { Device } from './device';

/** Trình duyệt Android có sẵn nút cài một lần bấm không: đang chờ sự kiện, đã có, hoặc không hỗ trợ. */
export type InstallPrompt = 'waiting' | 'ready' | 'unavailable';
export type GateScreen = 'pass' | 'checking' | 'ios' | 'in-app' | 'android';

export interface GateInput {
  /** Công tắc của quản trị hệ thống. */
  enabled: boolean;
  device: Device;
  /** Số lần người này đã vào ứng dụng trên trình duyệt này, tính cả lần hiện tại. */
  visits: number;
  /** Quản trị hệ thống không bị chặn, để luôn tắt được công tắc từ điện thoại. */
  superAdmin: boolean;
  installPrompt: InstallPrompt;
  /** Vừa cài xong trong phiên này (Android): cho dùng tiếp ở trình duyệt tới hết phiên. */
  installedThisSession?: boolean;
}

export function gateScreen(i: GateInput): GateScreen {
  if (!i.enabled || i.superAdmin) return 'pass';
  if (!i.device.phone || i.device.standalone) return 'pass';
  if (i.visits < 2 || i.installedThisSession) return 'pass';
  if (i.device.inApp) return 'in-app';
  if (i.device.os === 'ios') return 'ios';
  // Android: có nút cài thì bắt cài; trình duyệt không hỗ trợ (hoặc đã cài rồi nên không hỏi nữa) thì cho vào.
  if (i.installPrompt === 'ready') return 'android';
  return i.installPrompt === 'waiting' ? 'checking' : 'pass';
}

const VISITS_KEY = (userId: string) => `hm_visits_${userId}`;
const SESSION_KEY = 'hm_visit_counted';

interface Stores { local: Pick<Storage, 'getItem' | 'setItem'>; session: Pick<Storage, 'getItem' | 'setItem'> }

/**
 * Đếm một "lần vào": mỗi phiên trình duyệt (mỗi lần mở lại tab hoặc ứng dụng) tính một lần cho mỗi tài khoản.
 * Trả về tổng số lần vào tính cả lần này. Trình duyệt chặn bộ nhớ thì trả 1, tức coi như lần đầu và cho vào.
 */
export function countVisit(userId: string, stores?: Stores): number {
  try {
    const s = stores ?? { local: window.localStorage, session: window.sessionStorage };
    const before = Number(s.local.getItem(VISITS_KEY(userId)) ?? '0') || 0;
    if (s.session.getItem(SESSION_KEY) === userId) return Math.max(before, 1);
    s.session.setItem(SESSION_KEY, userId);
    s.local.setItem(VISITS_KEY(userId), String(before + 1));
    return before + 1;
  } catch {
    return 1;
  }
}
