import { describe, expect, it } from 'vitest';
import { adminCommands, fold, ownerCommands, searchCommands, type CommandScope } from './commands';

const OWNER = ['member.manage', 'post.moderate', 'course.manage', 'event.manage', 'store.manage', 'billing.manage', 'revenue.read', 'affiliates.manage', 'settings.manage'];
const owner: CommandScope = { slug: 'minhquy', role: 'owner', permissions: OWNER, tabs: {} };
const ids = (list: Array<{ id: string }>) => list.map((c) => c.id);

describe('fold', () => {
  it('bỏ dấu và viết thường', () => {
    expect(fold('  Cài Đặt hội ')).toBe('cai dat hoi');
    expect(fold('Rút tiền')).toBe('rut tien');
  });
});

describe('ownerCommands', () => {
  it('chủ hội có đủ việc làm ngay, nơi đi tới và cài đặt, mọi đường dẫn nằm trong hội đang mở', () => {
    const list = ownerCommands(owner);
    expect(ids(list)).toEqual(expect.arrayContaining(['post', 'invite', 'approve', 'course', 'event', 'product', 'payouts', 'payout-account', 'confirm-orders', 'refund', 'go-money', 'set-pricing', 'set-dev', 'set-plan', 'set-addons', 'set-sources', 'set-automation', 'set-contacts']));
    expect(list.find((c) => c.id === 'payouts')?.to).toBe('/minhquy/cong-su');
    expect(list.find((c) => c.id === 'approve')?.to).toBe('/minhquy/thanh-vien?trang-thai=pending');
    expect(new Set(ids(list)).size).toBe(list.length);
  });

  it('quản trị không có billing.manage thì không có cài nhận tiền, xác nhận đơn, hoàn tiền; không phải chủ thì không có khóa API và gói', () => {
    const admin = ownerCommands({ ...owner, role: 'admin', permissions: OWNER.filter((p) => p !== 'billing.manage') });
    for (const id of ['payout-account', 'confirm-orders', 'refund', 'set-dev', 'set-plan', 'set-addons']) expect(ids(admin)).not.toContain(id);
    expect(ids(admin)).toContain('go-money');
    expect(ids(admin)).toContain('export-revenue');
  });

  it('hội tắt tab nào thì không còn lệnh của tab đó', () => {
    const list = ownerCommands({ ...owner, tabs: { store: false, events: false } });
    for (const id of ['product', 'go-store', 'event', 'go-events']) expect(ids(list)).not.toContain(id);
    expect(ids(list)).toContain('course');
  });

  it('người kiểm duyệt chỉ có việc trong quyền của mình', () => {
    const mod = ownerCommands({ ...owner, role: 'moderator', permissions: ['post.moderate', 'event.manage'] });
    expect(ids(mod)).toContain('event');
    for (const id of ['invite', 'course', 'payouts', 'set-general', 'go-money']) expect(ids(mod)).not.toContain(id);
  });
});

describe('searchCommands', () => {
  const list = ownerCommands(owner);
  it('ô trống trả nguyên danh sách', () => {
    expect(searchCommands(list, '   ')).toEqual(list);
  });
  it('gõ không dấu vẫn ra', () => {
    // Người quen chữ "rút tiền" vẫn tìm ra chỗ cài tài khoản nhận tiền.
    expect(searchCommands(list, 'rut tien')[0]?.id).toBe('payout-account');
    expect(searchCommands(list, 'hoa hong').map((c) => c.id)).toEqual(expect.arrayContaining(['payouts', 'set-affiliate']));
  });
  it('khớp ở đầu tên lệnh đứng trước khớp bằng từ khóa', () => {
    const r = searchCommands(list, 'thanh');
    expect(r[0]?.id).toBe('go-members');
    expect(ids(r)).toContain('set-providers');
  });
  it('tìm bằng từ khóa khi tên lệnh không chứa chữ đó', () => {
    expect(ids(searchCommands(list, 'domain'))).toEqual(['set-domain']);
    expect(ids(searchCommands(list, 'zoom'))).toEqual(['event']);
  });
  it('thẻ và quy tắc tự động tìm được bằng "webcake", "tag", "tu dong"', () => {
    expect(ids(searchCommands(list, 'webcake'))).toEqual(['set-sources']);
    expect(ids(searchCommands(list, 'tag'))).toEqual(expect.arrayContaining(['set-sources', 'set-automation', 'set-contacts']));
    expect(searchCommands(list, 'quy tac tu dong')[0]?.id).toBe('set-automation');
    expect(searchCommands(list, 'quy tac tu dong')[0]?.to).toBe('/minhquy/cai-dat/quy-tac');
  });
  it('mọi từ đều phải có mặt, không cần đúng thứ tự', () => {
    expect(ids(searchCommands(list, 'hoc khoa'))).toContain('course');
    expect(searchCommands(list, 'khoa hoc xyz')).toEqual([]);
  });
});

describe('adminCommands', () => {
  it('đủ 12 màn của khu quản trị hệ thống và tìm được không dấu', () => {
    const list = adminCommands();
    expect(list.filter((c) => c.group === 'Hệ thống')).toHaveLength(13);
    expect(searchCommands(list, 'bao cao nguoi dung')[0]?.to).toBe('/he-thong/bao-cao');
    expect(searchCommands(list, 'doi soat')[0]?.to).toBe('/he-thong/thanh-toan');
    expect(searchCommands(list, 'nhat ky')[0]?.to).toBe('/he-thong/nhat-ky');
  });
});
