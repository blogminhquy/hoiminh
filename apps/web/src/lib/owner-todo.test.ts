import { describe, expect, it } from 'vitest';
import { buildOwnerTodos, daysLeft, type OwnerTodoInput } from './owner-todo';

const now = new Date('2026-11-10T03:00:00Z');
const base: OwnerTodoInput = { slug: 'minhquy', now, affiliatePayouts: null, pendingMembers: null, pendingPosts: null, plan: null };
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('daysLeft', () => {
  it('làm tròn lên, đã qua thì là 0', () => {
    expect(daysLeft(inDays(3), now)).toBe(3);
    expect(daysLeft(new Date(now.getTime() + 3_600_000), now)).toBe(1);
    expect(daysLeft(inDays(-2), now)).toBe(0);
  });
});

describe('buildOwnerTodos', () => {
  it('không có gì cần làm thì trả danh sách rỗng', () => {
    expect(buildOwnerTodos(base)).toEqual([]);
    expect(buildOwnerTodos({ ...base, affiliatePayouts: { count: 0, amountMinor: 0 }, pendingMembers: 0, pendingPosts: 0, plan: { status: 'active', endsAt: inDays(20), locked: false } })).toEqual([]);
  });

  it('yêu cầu rút của cộng sự nêu số yêu cầu, số tiền và dẫn tới trang Cộng sự', () => {
    const [t] = buildOwnerTodos({ ...base, affiliatePayouts: { count: 2, amountMinor: 1_250_000 } });
    expect(t).toMatchObject({ key: 'payouts', title: '2 yêu cầu rút của cộng sự', to: '/minhquy/cong-su', urgent: true });
    expect(t?.hint).toContain('1.250.000');
  });

  it('người chờ duyệt dẫn tới danh sách chờ duyệt, bài chờ duyệt dẫn tới bảng tin', () => {
    const list = buildOwnerTodos({ ...base, pendingMembers: 3, pendingPosts: 1 });
    expect(list.map((t) => t.key)).toEqual(['members', 'posts']);
    expect(list[0]?.to).toBe('/minhquy/thanh-vien?trang-thai=pending');
    expect(list[1]?.to).toBe('/minhquy/bang-tin');
  });

  it('việc gấp đứng trước việc thường', () => {
    const list = buildOwnerTodos({ ...base, pendingMembers: 3, affiliatePayouts: { count: 1, amountMinor: 500_000 } });
    expect(list.map((t) => t.key)).toEqual(['payouts', 'members']);
  });

  it('gói Hội Mình: còn hơn 7 ngày thì không nhắc', () => {
    expect(buildOwnerTodos({ ...base, plan: { status: 'trialing', endsAt: inDays(8), locked: false } })).toEqual([]);
    expect(buildOwnerTodos({ ...base, plan: { status: 'active', endsAt: null, locked: false } })).toEqual([]);
  });

  it('gói Hội Mình: dùng thử còn 5 ngày thì nhắc chọn gói, còn 2 ngày thì thành việc gấp', () => {
    const [soon] = buildOwnerTodos({ ...base, plan: { status: 'trialing', endsAt: inDays(5), locked: false } });
    expect(soon).toMatchObject({ key: 'plan', title: 'Dùng thử hết sau 5 ngày', label: 'Chọn gói', to: '/admin/goi', urgent: false });
    const [close] = buildOwnerTodos({ ...base, plan: { status: 'trialing', endsAt: inDays(2), locked: false } });
    expect(close?.urgent).toBe(true);
  });

  it('gói Hội Mình: gói trả phí sắp hết hạn thì nhắc gia hạn', () => {
    const [t] = buildOwnerTodos({ ...base, plan: { status: 'active', endsAt: inDays(3), locked: false } });
    expect(t).toMatchObject({ title: 'Gói Hội Mình hết hạn sau 3 ngày', label: 'Gia hạn' });
  });

  it('gói Hội Mình: đã hết hạn hoặc đang khóa nội dung thì đứng đầu danh sách', () => {
    const list = buildOwnerTodos({ ...base, affiliatePayouts: { count: 1, amountMinor: 500_000 }, plan: { status: 'expired', endsAt: inDays(-1), locked: false } });
    expect(list[0]).toMatchObject({ key: 'plan', title: 'Gói Hội Mình đã hết hạn', urgent: true });
    const [locked] = buildOwnerTodos({ ...base, plan: { status: 'active', endsAt: inDays(30), locked: true } });
    expect(locked?.key).toBe('plan');
  });

  it('gói đã hủy không nhắc gia hạn', () => {
    expect(buildOwnerTodos({ ...base, plan: { status: 'cancelled', endsAt: inDays(3), locked: false } })).toEqual([]);
  });
});
