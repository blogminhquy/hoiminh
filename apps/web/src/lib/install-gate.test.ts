import { describe, expect, it } from 'vitest';
import { detectDevice, type Device } from './device';
import { countVisit, gateScreen, type GateInput } from './install-gate';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneZalo: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/510',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/470.0.0.31.107;FBBV/1;FBDV/iPhone15,2]',
  iphoneMessenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/MessengerForiOS;FBAV/460.0.0.36.108;FBDV/iPhone15,2]',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidZalo: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Zalo android/24060601 ZaloTheme/light',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('detectDevice', () => {
  it('nhận ra điện thoại iPhone và Android; máy tính bảng và máy tính không tính là điện thoại', () => {
    expect(detectDevice(UA.iphoneSafari)).toMatchObject({ os: 'ios', phone: true, inApp: null });
    expect(detectDevice(UA.androidChrome)).toMatchObject({ os: 'android', phone: true, inApp: null });
    expect(detectDevice(UA.androidTablet)).toMatchObject({ os: 'android', phone: false });
    expect(detectDevice(UA.ipad).phone).toBe(false);
    expect(detectDevice(UA.desktop)).toMatchObject({ os: 'other', phone: false });
    expect(detectDevice('')).toMatchObject({ os: 'other', phone: false, standalone: false });
  });

  it('nhận ra trình duyệt trong Zalo, Facebook, Messenger (Messenger không bị nhận nhầm thành Facebook)', () => {
    expect(detectDevice(UA.iphoneZalo).inApp).toBe('zalo');
    expect(detectDevice(UA.androidZalo).inApp).toBe('zalo');
    expect(detectDevice(UA.iphoneFacebook).inApp).toBe('facebook');
    expect(detectDevice(UA.iphoneMessenger).inApp).toBe('messenger');
  });
});

describe('gateScreen', () => {
  const dev = (ua: string, standalone = false): Device => detectDevice(ua, { standalone });
  const base: GateInput = { enabled: true, device: dev(UA.iphoneSafari), visits: 2, superAdmin: false, installPrompt: 'unavailable' };

  it('công tắc tắt, máy tính, máy tính bảng, quản trị hệ thống: không bao giờ chặn', () => {
    expect(gateScreen({ ...base, enabled: false })).toBe('pass');
    expect(gateScreen({ ...base, device: dev(UA.desktop) })).toBe('pass');
    expect(gateScreen({ ...base, device: dev(UA.ipad) })).toBe('pass');
    expect(gateScreen({ ...base, superAdmin: true })).toBe('pass');
  });

  it('lần vào đầu tiên cho dùng luôn, từ lần thứ hai mới bắt cài', () => {
    expect(gateScreen({ ...base, visits: 1 })).toBe('pass');
    expect(gateScreen({ ...base, visits: 2 })).toBe('ios');
    expect(gateScreen({ ...base, visits: 9 })).toBe('ios');
  });

  it('đã mở từ biểu tượng ở màn hình chính thì vào thẳng', () => {
    expect(gateScreen({ ...base, device: dev(UA.iphoneSafari, true) })).toBe('pass');
    expect(gateScreen({ ...base, device: dev(UA.androidChrome, true), installPrompt: 'ready' })).toBe('pass');
  });

  it('trong Zalo, Facebook, Messenger: hướng dẫn mở bằng Safari hoặc Chrome, cả iPhone lẫn Android', () => {
    expect(gateScreen({ ...base, device: dev(UA.iphoneZalo) })).toBe('in-app');
    expect(gateScreen({ ...base, device: dev(UA.iphoneMessenger) })).toBe('in-app');
    expect(gateScreen({ ...base, device: dev(UA.androidZalo), installPrompt: 'ready' })).toBe('in-app');
  });

  it('Android: có nút cài một lần bấm thì bắt cài; trình duyệt không cài được thì cho vào', () => {
    const android = { ...base, device: dev(UA.androidChrome) };
    expect(gateScreen({ ...android, installPrompt: 'waiting' })).toBe('checking');
    expect(gateScreen({ ...android, installPrompt: 'ready' })).toBe('android');
    expect(gateScreen({ ...android, installPrompt: 'unavailable' })).toBe('pass');
    expect(gateScreen({ ...android, installPrompt: 'ready', installedThisSession: true })).toBe('pass');
  });
});

describe('countVisit', () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

  it('mỗi phiên trình duyệt tính một lần vào; tải lại trang trong cùng phiên không tính thêm', () => {
    const local = store();
    const s1 = store();
    expect(countVisit('u1', { local, session: s1 })).toBe(1);
    expect(countVisit('u1', { local, session: s1 })).toBe(1);
    const s2 = store();
    expect(countVisit('u1', { local, session: s2 })).toBe(2);
    expect(countVisit('u1', { local, session: s2 })).toBe(2);
  });

  it('đếm riêng từng tài khoản trên cùng một máy', () => {
    const local = store();
    expect(countVisit('u1', { local, session: store() })).toBe(1);
    expect(countVisit('u1', { local, session: store() })).toBe(2);
    expect(countVisit('u2', { local, session: store() })).toBe(1);
  });

  it('trình duyệt chặn bộ nhớ thì coi như lần đầu và cho vào', () => {
    const broken = { getItem: () => { throw new Error('chặn'); }, setItem: () => { throw new Error('chặn'); } };
    expect(countVisit('u1', { local: broken, session: broken })).toBe(1);
  });
});
