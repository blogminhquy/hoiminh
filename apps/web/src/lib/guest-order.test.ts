import { describe, expect, it } from 'vitest';
import { guestOrderPath, guestTokenFor, isAccountExists, looksLikeEmail, passwordReady, rememberGuestToken } from './guest-order';

const T1 = 'a'.repeat(40);
const T2 = 'b'.repeat(40);

function memory(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}

describe('mã đơn của người mua chưa đăng nhập', () => {
  it('địa chỉ trang đơn mang mã; mã trên địa chỉ đứng trước mã đã nhớ', () => {
    const s = memory();
    expect(guestOrderPath('o1', T1)).toBe(`/thanh-toan/o1?g=${T1}`);
    expect(guestTokenFor('o1', null, s)).toBeNull();
    rememberGuestToken('o1', T1, s);
    expect(guestTokenFor('o1', null, s)).toBe(T1);
    expect(guestTokenFor('o1', T2, s)).toBe(T2);
    expect(guestTokenFor('o2', null, s)).toBeNull();
  });
  it('mã sai dạng bị bỏ qua; trình duyệt chặn bộ nhớ thì không vỡ', () => {
    expect(guestTokenFor('o1', '<script>', null)).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => rememberGuestToken('o1', T1, broken)).not.toThrow();
    expect(guestTokenFor('o1', null, broken)).toBeNull();
  });
  it('kiểm tra nhanh email, mật khẩu và lỗi email đã có tài khoản', () => {
    expect(looksLikeEmail('lan@gmail.com')).toBe(true);
    expect(looksLikeEmail(' lan@gmail ')).toBe(false);
    expect(passwordReady('matkhau1')).toBe(true);
    expect(passwordReady('12345678')).toBe(false);
    expect(isAccountExists({ code: 'conflict', details: { reason: 'account_exists' } })).toBe(true);
    expect(isAccountExists({ code: 'conflict' })).toBe(false);
  });
});
