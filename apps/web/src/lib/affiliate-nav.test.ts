import { describe, expect, it } from 'vitest';
import { affiliateHeadline, affiliateNavRate, affiliateTabs, canSeeLeaderboard, currentAffiliateTab, leaderboardAudience, type AffiliateScope } from './affiliate-nav';
import { ownerCommands } from './commands';
import type { ShellAffiliate } from './community';

const program = (over: Partial<ShellAffiliate> = {}): ShellAffiliate => ({ programId: 'p1', enabled: true, rateBps: 4000, durationMonths: null, hasAccount: false, leaderboardVisibility: 'members', ...over });
const scope = (over: { affiliate?: ShellAffiliate | null; isMember?: boolean; permissions?: string[]; tabs?: Record<string, boolean> } = {}): AffiliateScope => ({
  viewer: { isMember: over.isMember ?? true, permissions: over.permissions ?? [] },
  community: { tabs: over.tabs ?? {} },
  affiliate: over.affiliate === undefined ? program() : over.affiliate,
});
const OWNER = ['affiliates.manage', 'settings.manage'];

describe('affiliateNavRate: mục Affiliate trên thanh bên', () => {
  it('thành viên của hội đang bật affiliate thấy mục kèm phần trăm hoa hồng', () => {
    expect(affiliateNavRate(scope())).toBe('40%');
    expect(affiliateNavRate(scope({ affiliate: program({ rateBps: 1250 }) }))).toBe('12,5%');
  });
  it('không phụ thuộc bảng xếp hạng: cờ xếp hạng tắt hay chủ hội ẩn bảng thì mục vẫn hiện', () => {
    expect(affiliateNavRate(scope({ tabs: { affiliate: false } }))).toBe('40%');
    expect(affiliateNavRate(scope({ affiliate: program({ leaderboardVisibility: 'hidden' }) }))).toBe('40%');
  });
  it('chương trình tắt, hội chưa có chương trình, hoặc máy chủ cũ chưa trả trường này thì ẩn', () => {
    expect(affiliateNavRate(scope({ affiliate: program({ enabled: false }) }))).toBeNull();
    expect(affiliateNavRate(scope({ affiliate: null }))).toBeNull();
    expect(affiliateNavRate({ viewer: { isMember: true, permissions: [] }, community: { tabs: {} } })).toBeNull();
  });
  it('khách xem hội mở không thấy', () => {
    expect(affiliateNavRate(scope({ isMember: false }))).toBeNull();
  });
});

describe('canSeeLeaderboard: tab Xếp hạng', () => {
  it('bảng mở cho thành viên: thành viên nào cũng thấy', () => {
    expect(canSeeLeaderboard(scope())).toBe(true);
  });
  it('bảng chỉ cho affiliate: phải có tài khoản affiliate, kể cả vừa mở trong phiên này', () => {
    const only = program({ leaderboardVisibility: 'affiliates_only' });
    expect(canSeeLeaderboard(scope({ affiliate: only }))).toBe(false);
    expect(canSeeLeaderboard(scope({ affiliate: { ...only, hasAccount: true } }))).toBe(true);
    expect(canSeeLeaderboard(scope({ affiliate: only }), true)).toBe(true);
  });
  it('chủ hội ẩn bảng: thành viên không thấy dù đã là affiliate, người quản lý vẫn thấy', () => {
    const hidden = program({ leaderboardVisibility: 'hidden', hasAccount: true });
    expect(canSeeLeaderboard(scope({ affiliate: hidden }))).toBe(false);
    expect(canSeeLeaderboard(scope({ affiliate: hidden, permissions: OWNER }))).toBe(true);
  });
  it('cờ bảng xếp hạng tắt, chủ hội tắt tab, hoặc gói không có affiliate (tabs.affiliate = false): thành viên không thấy', () => {
    expect(canSeeLeaderboard(scope({ tabs: { affiliate: false }, affiliate: program({ hasAccount: true }) }))).toBe(false);
    expect(canSeeLeaderboard(scope({ tabs: { affiliate: false }, permissions: OWNER }))).toBe(true);
  });
  it('khách, hoặc hội chưa có chương trình, không thấy', () => {
    expect(canSeeLeaderboard(scope({ isMember: false }))).toBe(false);
    expect(canSeeLeaderboard(scope({ affiliate: null, permissions: OWNER }))).toBe(false);
  });
  it('chương trình đã tắt không tự ẩn bảng xếp hạng', () => {
    expect(canSeeLeaderboard(scope({ affiliate: program({ enabled: false }) }))).toBe(true);
  });
});

describe('leaderboardAudience', () => {
  it('nói rõ ai ngoài người quản lý đang xem được bảng', () => {
    expect(leaderboardAudience(scope())).toBe('members');
    expect(leaderboardAudience(scope({ affiliate: program({ leaderboardVisibility: 'affiliates_only' }) }))).toBe('affiliates_only');
    expect(leaderboardAudience(scope({ affiliate: program({ leaderboardVisibility: 'hidden' }) }))).toBe('managers');
    expect(leaderboardAudience(scope({ tabs: { affiliate: false } }))).toBe('managers');
    expect(leaderboardAudience(scope({ affiliate: null }))).toBe('managers');
  });
});

describe('affiliateTabs và currentAffiliateTab', () => {
  it('chương trình bật, bảng mở: hai tab, mặc định là Link của tôi', () => {
    const tabs = affiliateTabs(scope());
    expect(tabs).toEqual(['link', 'xep-hang']);
    expect(currentAffiliateTab(null, tabs)).toBe('link');
    expect(currentAffiliateTab('xep-hang', tabs)).toBe('xep-hang');
    expect(currentAffiliateTab('la', tabs)).toBe('link');
  });
  it('bảng xếp hạng tắt: chỉ còn phần link, địa chỉ ?tab=xep-hang cũng mở phần link', () => {
    const tabs = affiliateTabs(scope({ tabs: { affiliate: false } }));
    expect(tabs).toEqual(['link']);
    expect(currentAffiliateTab('xep-hang', tabs)).toBe('link');
  });
  it('bảng chỉ cho affiliate: tab Xếp hạng hiện ra sau khi người xem có tài khoản affiliate', () => {
    const s = scope({ affiliate: program({ leaderboardVisibility: 'affiliates_only' }) });
    expect(affiliateTabs(s)).toEqual(['link']);
    expect(affiliateTabs(s, true)).toEqual(['link', 'xep-hang']);
  });
  it('chương trình tắt: không còn tab link; bảng xếp hạng còn mở thì mở thẳng bảng', () => {
    const tabs = affiliateTabs(scope({ affiliate: program({ enabled: false, hasAccount: true }) }));
    expect(tabs).toEqual(['xep-hang']);
    expect(currentAffiliateTab('link', tabs)).toBe('xep-hang');
  });
  it('không có gì để xem: không có tab nào', () => {
    const tabs = affiliateTabs(scope({ affiliate: program({ enabled: false, leaderboardVisibility: 'hidden' }) }));
    expect(tabs).toEqual([]);
    expect(currentAffiliateTab('link', tabs)).toBeNull();
    expect(affiliateTabs(scope({ isMember: false }))).toEqual([]);
  });
});

describe('affiliateHeadline', () => {
  it('nêu tên hội và phần trăm thật, thêm số tháng khi chương trình có giới hạn', () => {
    expect(affiliateHeadline(program(), 'Hội A')).toBe('Giới thiệu người vào Hội A, nhận 40% hoa hồng mỗi lần họ trả phí.');
    expect(affiliateHeadline(program({ rateBps: 2500, durationMonths: 6 }), 'Hội A')).toBe('Giới thiệu người vào Hội A, nhận 25% hoa hồng mỗi lần họ trả phí trong 6 tháng đầu.');
  });
});

describe('ô lệnh của người quản lý: lệnh go-rank', () => {
  const base = { slug: 'minhquy', role: 'owner', permissions: OWNER };
  it('có khi trang Affiliate của hội đang mở với người xem, mang nhãn mới và vẫn dẫn tới /xep-hang', () => {
    const cmd = ownerCommands({ ...base, tabs: { affiliatePage: true } }).find((c) => c.id === 'go-rank');
    expect(cmd).toMatchObject({ label: 'Affiliate của hội: link và xếp hạng', to: '/minhquy/xep-hang' });
  });
  it('không còn phụ thuộc tab bảng xếp hạng: tabs.affiliate tắt vẫn có, chương trình tắt thì không', () => {
    expect(ownerCommands({ ...base, tabs: { affiliate: false, affiliatePage: true } }).some((c) => c.id === 'go-rank')).toBe(true);
    expect(ownerCommands({ ...base, tabs: { affiliatePage: false } }).some((c) => c.id === 'go-rank')).toBe(false);
    expect(ownerCommands({ ...base, tabs: {} }).some((c) => c.id === 'go-rank')).toBe(false);
  });
});
