import { describe, expect, it } from 'vitest';
import { REF_PLATFORM_SCOPE, joinRefs, refCodes, refScopeOf, scopeRefs, splitRef } from '@hoiminh/contracts';
import { movedSlugPath, refCodeOf } from './referral';

describe('refCodeOf', () => {
  it('nhận mã trần, bỏ khoảng trắng và viết thường', () => {
    expect(refCodeOf('  HV8K2 ')).toBe('hv8k2');
  });
  it('email giữ nguyên, chỉ bỏ khoảng trắng và viết thường', () => {
    expect(refCodeOf(' HoangVu@Gmail.com ')).toBe('hoangvu@gmail.com');
  });
  it('nhận cả link có ?ref= hoặc &ref=', () => {
    expect(refCodeOf('https://hoiminh.com/javiser?ref=hv8k2')).toBe('hv8k2');
    expect(refCodeOf('hoiminh.com/javiser/cua-hang/khoa-a?utm=zalo&ref=Lan9x#mua')).toBe('lan9x');
  });
});

describe('danh sách mã giới thiệu', () => {
  it('mã mới bấm đứng trước, bỏ trùng, viết thường, bỏ chuỗi không phải mã', () => {
    expect(refCodes('HK3M1', 'hv8k2,hk3m1, ,<script>')).toEqual(['hk3m1', 'hv8k2']);
    expect(joinRefs('hk3m1', 'hv8k2,hk3m1')).toBe('hk3m1,hv8k2');
  });
  it('không có mã nào thì undefined, và chỉ giữ 8 mã mới nhất', () => {
    expect(joinRefs(null, '', undefined)).toBeUndefined();
    expect(refCodes('a1,a2,a3,a4,a5,a6,a7,a8,a9,a10')).toHaveLength(8);
  });
});

describe('phạm vi của mã giới thiệu (trang mà link được mở)', () => {
  it('trang của hội lấy đường dẫn hội, trang chủ là nền tảng, trang đăng ký đi từ một hội lấy theo hội đó', () => {
    expect(refScopeOf('/javiser')).toBe('javiser');
    expect(refScopeOf('/javiser/cua-hang/javis-agent-automation-v78')).toBe('javiser');
    expect(refScopeOf('/')).toBe(REF_PLATFORM_SCOPE);
    expect(refScopeOf('/tao-hoi/goi')).toBe('tao-hoi');
    expect(refScopeOf('/dang-ky', 'javiser')).toBe('javiser');
    expect(refScopeOf('/dang-ky', null)).toBe('dang-ky');
    expect(refScopeOf('/Hội%20lạ')).toBe(REF_PLATFORM_SCOPE);
  });
  it('gắn phạm vi cho mã đọc từ link, mã đã có phạm vi thì giữ nguyên', () => {
    expect(scopeRefs('MinhQuy', 'javiser')).toBe('minhquy.javiser');
    expect(scopeRefs('minhquy.javiser,hv8k2', 'dang-ky')).toBe('minhquy.javiser,hv8k2.dang-ky');
    expect(scopeRefs(null, 'javiser')).toBeUndefined();
    expect(scopeRefs('<script>', 'javiser')).toBeUndefined();
  });
  it('danh sách mã nhận cả mã có phạm vi; cùng một mã ở hai trang là hai lượt bấm khác nhau', () => {
    expect(refCodes('minhquy.javiser', 'minhquy._,minhquy.javiser,hv8k2')).toEqual(['minhquy.javiser', 'minhquy._', 'hv8k2']);
    expect(refCodes('a.b.c', 'a.', '.b')).toEqual([]);
    expect(joinRefs('minhquy.javiser', 'hv8k2')).toBe('minhquy.javiser,hv8k2');
  });
  it('tách mã và phạm vi', () => {
    expect(splitRef('minhquy.javiser')).toEqual({ code: 'minhquy', scope: 'javiser' });
    expect(splitRef('hv8k2')).toEqual({ code: 'hv8k2', scope: null });
  });
});

describe('movedSlugPath', () => {
  const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });
  it('đang đúng đường dẫn thì không chuyển', () => {
    expect(movedSlugPath(loc('/javiser/thanh-vien'), 'javiser', 'javiser')).toBeNull();
    expect(movedSlugPath(loc('/tai-khoan'), undefined, 'javiser')).toBeNull();
  });
  it('đường dẫn cũ chuyển sang mới, giữ trang con và tham số', () => {
    expect(movedSlugPath(loc('/agent-automation-cung-javis/thanh-vien'), 'agent-automation-cung-javis', 'javiser')).toBe('/javiser/thanh-vien');
    expect(movedSlugPath(loc('/cu', '?ref=hv8k2', '#gia'), 'cu', 'moi')).toBe('/moi?ref=hv8k2#gia');
  });
  it('không đụng vào địa chỉ chỉ trùng phần đầu chữ', () => {
    expect(movedSlugPath(loc('/cu-khac/bang-tin'), 'cu', 'moi')).toBeNull();
  });
});
