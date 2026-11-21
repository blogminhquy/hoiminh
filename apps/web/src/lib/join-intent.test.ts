// Đích sau khi đăng ký hoặc đăng nhập từ trang của một hội.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinPath, loginPathFor, rememberAfterAuth, safeNext, signupPathFor, takeAfterAuth } from './join-intent';

function fakeSession() {
  const data = new Map<string, string>();
  vi.stubGlobal('window', { sessionStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } });
  return data;
}
afterEach(() => vi.unstubAllGlobals());

describe('đích sau đăng ký từ một hội', () => {
  it('đăng ký từ hội thì về trang giới thiệu kèm ý định tham gia', () => {
    expect(joinPath('minhquy')).toBe('/minhquy?thamgia=1');
    expect(signupPathFor('minhquy')).toBe('/dang-ky?hoi=minhquy');
    expect(signupPathFor('minhquy', 'hv8k2')).toBe('/dang-ky?hoi=minhquy&ref=hv8k2');
    expect(loginPathFor('/minhquy/cua-hang/khoa-a?ref=x')).toBe('/dang-nhap?next=%2Fminhquy%2Fcua-hang%2Fkhoa-a%3Fref%3Dx');
  });

  it('chỉ nhận đường dẫn trong trang', () => {
    expect(safeNext('/minhquy?thamgia=1')).toBe('/minhquy?thamgia=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'minhquy', '', null, undefined]) expect(safeNext(bad)).toBeNull();
  });
});

describe('đích cất qua bước Google', () => {
  it('cất rồi lấy ra đúng một lần', () => {
    fakeSession();
    rememberAfterAuth('/minhquy?thamgia=1');
    expect(takeAfterAuth()).toBe('/minhquy?thamgia=1');
    expect(takeAfterAuth()).toBeNull();
  });

  it('không có đích thì xóa đích cũ, địa chỉ ngoài không được cất', () => {
    const data = fakeSession();
    rememberAfterAuth('/minhquy?thamgia=1');
    rememberAfterAuth(null);
    expect(takeAfterAuth()).toBeNull();
    rememberAfterAuth('//evil.example');
    expect(data.size).toBe(0);
    data.set('hm_after_auth', 'https://evil.example');
    expect(takeAfterAuth()).toBeNull();
  });

  it('trình duyệt chặn bộ nhớ phiên thì không lỗi', () => {
    vi.stubGlobal('window', { get sessionStorage(): Storage { throw new Error('blocked'); } });
    expect(() => rememberAfterAuth('/minhquy')).not.toThrow();
    expect(takeAfterAuth()).toBeNull();
  });
});
