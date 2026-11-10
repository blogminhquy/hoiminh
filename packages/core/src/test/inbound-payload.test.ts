import { describe, expect, it } from 'vitest';
import { extractInbound, flattenPayload, normalizeTagName, parseTags } from '../lib/inbound-payload';

describe('normalizeTagName', () => {
  it('đưa về chữ thường không dấu, khoảng trắng thành gạch dưới', () => {
    expect(normalizeTagName('  Paid ')).toBe('paid');
    expect(normalizeTagName('Order Placed')).toBe('order_placed');
    expect(normalizeTagName('Đã Thanh Toán')).toBe('da_thanh_toan');
    expect(normalizeTagName('vip-2026!')).toBe('vip-2026');
    expect(normalizeTagName('***')).toBe('');
  });
});

describe('parseTags', () => {
  it('nhận chuỗi phân cách, mảng, chuỗi JSON và mảng object', () => {
    expect(parseTags('paid, Order Placed;vip')).toEqual(['paid', 'order_placed', 'vip']);
    expect(parseTags(['paid', 'paid', 'course_fmm'])).toEqual(['paid', 'course_fmm']);
    expect(parseTags('["paid","vip"]')).toEqual(['paid', 'vip']);
    expect(parseTags([{ name: 'paid' }, { tag: 'vip' }])).toEqual(['paid', 'vip']);
    expect(parseTags(null)).toEqual([]);
  });
  it('tối đa 20 thẻ mỗi lượt', () => {
    expect(parseTags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
});

describe('extractInbound', () => {
  it('tự dò theo tên trường quen thuộc của form landing', () => {
    const x = extractInbound({ full_name: 'Nguyễn An', phone_number: '0901234567', email: ' An@Example.com ', tag: 'paid' });
    expect(x).toEqual({ email: 'an@example.com', name: 'Nguyễn An', phone: '0901234567', tags: ['paid'], removeTags: [] });
  });
  it('tìm được trong dữ liệu lồng nhau và lấy mọi thẻ', () => {
    const x = extractInbound({ event: 'order', data: { customer: { Email: 'b@example.com', name: 'Bình' }, tags: ['order_placed', 'paid'] } });
    expect(x.email).toBe('b@example.com');
    expect(x.name).toBe('Bình');
    expect(x.tags).toEqual(['order_placed', 'paid']);
  });
  it('không có trường tên email thì lấy giá trị đầu tiên trông giống email', () => {
    expect(extractInbound({ form: { field_1: 'Chị Hoa', field_2: 'hoa@example.com' } }).email).toBe('hoa@example.com');
    expect(extractInbound({ form: { field_1: 'không có gì' } }).email).toBeNull();
  });
  it('chủ hội chỉ rõ trường thì dùng đúng trường đó, kèm thẻ mặc định của nguồn', () => {
    const payload = { a: { mail_khach: 'c@example.com', nhan: 'vip, paid' }, email: 'khac@example.com', tag: 'ignored' };
    const x = extractInbound(payload, { emailPath: 'a.mail_khach', tagPath: 'a.nhan', defaultTags: ['landing_a'] });
    expect(x.email).toBe('c@example.com');
    expect(x.tags).toEqual(['landing_a', 'vip', 'paid']);
  });
  it('thẻ cần gỡ đi theo trường remove_tag, không trùng thẻ vừa gắn', () => {
    const x = extractInbound({ email: 'd@example.com', tag: 'refunded', remove_tag: 'paid, refunded' });
    expect(x.tags).toEqual(['refunded']);
    expect(x.removeTags).toEqual(['paid']);
  });
});

describe('flattenPayload', () => {
  it('trải dữ liệu lồng nhau thành đường dẫn có dấu chấm', () => {
    expect(flattenPayload({ a: { b: 'x', list: ['m', 'n'] }, c: 5, d: null })).toEqual({ 'a.b': 'x', 'a.list.0': 'm', 'a.list.1': 'n', c: '5' });
  });
});
