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
    expect(buildOwnerTodos({ ...base, affiliatePayouts: { count: 0, amountMinor: 0 }, pendingMembers: 0, pendingPosts: 0, plan: { key: 'pro', name: 'Chuyên nghiệp', endsAt: inDays(20), memberCap: 5_000, needsPlan: false, full: false } })).toEqual([]);
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

  const plan = (over: Partial<NonNullable<OwnerTodoInput['plan']>>) => ({ key: 'pro', name: 'Chuyên nghiệp', endsAt: inDays(60), memberCap: 5_000, needsPlan: false, full: false, ...over });

  it('gói của hội: gói Miễn phí hoặc còn hơn 7 ngày thì không nhắc', () => {
    expect(buildOwnerTodos({ ...base, plan: plan({ endsAt: inDays(8) }) })).toEqual([]);
    expect(buildOwnerTodos({ ...base, plan: plan({ key: 'free', name: 'Miễn phí', endsAt: null, memberCap: 100 }) })).toEqual([]);
  });

  it('gói của hội: gói trả phí còn 5 ngày thì nhắc gia hạn và dẫn tới trang gói của đúng hội đó, còn 2 ngày thì thành việc gấp', () => {
    const [soon] = buildOwnerTodos({ ...base, plan: plan({ endsAt: inDays(5) }) });
    expect(soon).toMatchObject({ key: 'plan', title: 'Gói Chuyên nghiệp hết hạn sau 5 ngày', label: 'Gia hạn', to: '/admin/goi?hoi=minhquy', urgent: false });
    const [close] = buildOwnerTodos({ ...base, plan: plan({ endsAt: inDays(2) }) });
    expect(close?.urgent).toBe(true);
  });

  it('gói của hội: chạm trần thành viên thì mời nâng gói, đứng đầu danh sách', () => {
    const list = buildOwnerTodos({ ...base, pendingMembers: 4, plan: plan({ key: 'free', name: 'Miễn phí', endsAt: null, memberCap: 100, full: true }) });
    expect(list[0]).toMatchObject({ key: 'plan', title: 'Hội đã đủ 100 thành viên của gói Miễn phí', label: 'Nâng gói', urgent: true });
    expect(list[1]?.key).toBe('members');
  });

  it('gói của hội: hội thứ hai chưa có gói thì nhắc chọn gói', () => {
    const [t] = buildOwnerTodos({ ...base, plan: plan({ key: 'free', name: 'Miễn phí', endsAt: null, needsPlan: true, full: true }) });
    expect(t).toMatchObject({ key: 'plan', title: 'Hội chưa có gói', label: 'Chọn gói', urgent: true });
  });
});
