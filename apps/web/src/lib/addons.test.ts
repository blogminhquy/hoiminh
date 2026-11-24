import { describe, expect, it } from 'vitest';
import { PLATFORM_ADDONS, addonStatusLabel, ownsCommunity } from './addons';

describe('gói bổ sung', () => {
  it('có tên miền riêng và email marketing, cả hai sắp ra mắt', () => {
    expect(PLATFORM_ADDONS.map((a) => [a.key, a.status])).toEqual([['custom_domain', 'soon'], ['email_marketing', 'soon']]);
    expect(addonStatusLabel('soon')).toBe('Sắp ra mắt');
  });

  it('chữ hiển thị không có gạch ngang dài', () => {
    const text = PLATFORM_ADDONS.flatMap((a) => [a.name, a.summary, ...a.points]).join(' ');
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('lời mời tạo hội', () => {
  it('chỉ người chưa làm chủ hội nào mới thấy', () => {
    expect(ownsCommunity([])).toBe(false);
    expect(ownsCommunity([{ role: 'member' }, { role: 'admin' }])).toBe(false);
    expect(ownsCommunity([{ role: 'member' }, { role: 'owner' }])).toBe(true);
  });
});
