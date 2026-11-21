// Mã mời vào hội: nhớ theo từng hội, và lời mời đổi được gì cho từng loại người xem.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetInvite, inviteEffect, inviteFor, inviteIsDead, rememberInvite, type InviteInfo } from './invite';

function fakeStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } });
  return data;
}
afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const valid = (role: 'admin' | 'member'): InviteInfo => ({ state: 'valid', role, message: null });

describe('nhớ mã mời', () => {
  it('mã trên link được nhớ theo từng hội và lấy lại được sau khi link không còn mã', () => {
    fakeStorage();
    rememberInvite('MinhQuy', TOKEN);
    expect(inviteFor('minhquy', new URLSearchParams(''))).toBe(TOKEN);
    expect(inviteFor('hoi-khac', new URLSearchParams(''))).toBeNull();
    forgetInvite('minhquy');
    expect(inviteFor('minhquy')).toBeNull();
  });

  it('mã trên link đứng trước mã đã nhớ; mã sai dạng bị bỏ qua và không xóa mã đã nhớ', () => {
    fakeStorage();
    rememberInvite('minhquy', TOKEN);
    const other = 'ffffffffffffffffffffffffffffffff';
    expect(inviteFor('minhquy', new URLSearchParams(`invite=${other}`))).toBe(other);
    rememberInvite('minhquy', '<script>');
    rememberInvite('minhquy', '');
    expect(inviteFor('minhquy', new URLSearchParams('invite=%3Cscript%3E'))).toBe(TOKEN);
  });

  it('trình duyệt chặn bộ nhớ thì mã vẫn đi theo link, không ném lỗi', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('chặn'); }, setItem: () => { throw new Error('chặn'); }, removeItem: () => { throw new Error('chặn'); } } });
    expect(() => rememberInvite('minhquy', TOKEN)).not.toThrow();
    expect(() => forgetInvite('minhquy')).not.toThrow();
    expect(inviteFor('minhquy', new URLSearchParams(`invite=${TOKEN}`))).toBe(TOKEN);
    expect(inviteFor('minhquy')).toBeNull();
  });
});

describe('lời mời đổi được gì', () => {
  const guest = { member: false, role: null, paid: false };
  it('hội miễn phí: người được mời vào thẳng', () => {
    expect(inviteEffect(valid('member'), guest)).toBe('join');
    expect(inviteEffect(valid('admin'), guest)).toBe('join');
  });
  it('hội thu phí: mời làm thành viên vẫn phải thanh toán, mời làm quản trị viên thì vào thẳng', () => {
    expect(inviteEffect(valid('member'), { ...guest, paid: true })).toBe('pay');
    expect(inviteEffect(valid('admin'), { ...guest, paid: true })).toBe('join');
  });
  it('đã ở trong hội: chỉ lời mời quản trị nâng được thành viên và kiểm duyệt viên; chủ hội và quản trị viên không đổi', () => {
    expect(inviteEffect(valid('admin'), { member: true, role: 'member', paid: false })).toBe('promote');
    expect(inviteEffect(valid('admin'), { member: true, role: 'moderator', paid: true })).toBe('promote');
    expect(inviteEffect(valid('admin'), { member: true, role: 'admin', paid: false })).toBe('none');
    expect(inviteEffect(valid('admin'), { member: true, role: 'owner', paid: false })).toBe('none');
    expect(inviteEffect(valid('member'), { member: true, role: 'member', paid: false })).toBe('none');
  });
  it('lời mời không dùng được thì không đổi gì; mã chết hẳn thì quên, mã sai email thì giữ để đăng nhập lại', () => {
    for (const state of ['not_found', 'expired', 'used', 'wrong_email', 'unverified_email'] as const) expect(inviteEffect({ state, role: 'admin', message: 'x' }, guest)).toBe('none');
    expect(inviteEffect(null, guest)).toBe('none');
    expect(inviteIsDead({ state: 'expired', role: 'member', message: 'x' })).toBe(true);
    expect(inviteIsDead({ state: 'used', role: 'member', message: 'x' })).toBe(true);
    expect(inviteIsDead({ state: 'wrong_email', role: 'member', message: 'x' })).toBe(false);
    expect(inviteIsDead(valid('member'))).toBe(false);
    expect(inviteIsDead(null)).toBe(false);
  });
});
