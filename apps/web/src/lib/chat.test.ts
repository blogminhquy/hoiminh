import { describe, expect, it } from 'vitest';
import { MESSAGE_FILE_MAX_BYTES, checkAttachment, deliveryStatus, fileSizeLabel, linkParts, linksIn, reactionSummary, sameGroup, seenLabel } from './chat';

describe('linkParts', () => {
  it('tách link khỏi chữ, bỏ dấu câu sát cuối', () => {
    expect(linkParts('Bắt đầu tại đây: https://hoiminh.com/a-b/bang-tin. Chúc vui (xem https://x.vn/y?z=1)')).toEqual([
      { text: 'Bắt đầu tại đây: ' },
      { text: 'https://hoiminh.com/a-b/bang-tin', href: 'https://hoiminh.com/a-b/bang-tin' },
      { text: '. Chúc vui (xem ' },
      { text: 'https://x.vn/y?z=1', href: 'https://x.vn/y?z=1' },
      { text: ')' },
    ]);
  });
  it('chữ không có link giữ nguyên; không nhận javascript: hay link rỗng', () => {
    expect(linkParts('xin chào')).toEqual([{ text: 'xin chào' }]);
    expect(linksIn('javascript:alert(1) và https:// trống')).toEqual([]);
  });
});

describe('sameGroup', () => {
  const m = (senderUserId: string, at: string, automated = false) => ({ senderUserId, createdAt: at, automated });
  it('cùng người, dưới 5 phút thì cùng cụm', () => {
    expect(sameGroup(m('a', '2026-10-17T02:00:00Z'), m('a', '2026-10-17T02:03:00Z'))).toBe(true);
    expect(sameGroup(m('a', '2026-10-17T02:00:00Z'), m('a', '2026-10-17T02:09:00Z'))).toBe(false);
    expect(sameGroup(m('a', '2026-10-17T02:00:00Z'), m('b', '2026-10-17T02:01:00Z'))).toBe(false);
    expect(sameGroup(m('a', '2026-10-17T02:00:00Z', true), m('a', '2026-10-17T02:01:00Z'))).toBe(false);
    expect(sameGroup(undefined, m('a', '2026-10-17T02:01:00Z'))).toBe(false);
  });
});

describe('seenLabel', () => {
  const now = Date.parse('2026-10-17T10:00:00Z');
  it('đổi lần truy cập gần nhất thành dòng trạng thái', () => {
    expect(seenLabel('2026-10-17T09:58:00Z', now)).toBe('Đang hoạt động');
    expect(seenLabel('2026-10-17T09:40:00Z', now)).toBe('Truy cập 20 phút trước');
    expect(seenLabel('2026-10-17T07:00:00Z', now)).toBe('Truy cập 3 giờ trước');
    expect(seenLabel('2026-10-14T10:00:00Z', now)).toBe('Truy cập 3 ngày trước');
    expect(seenLabel('2026-01-01T10:00:00Z', now)).toBe('');
    expect(seenLabel(null, now)).toBe('');
  });
});

describe('reactionSummary', () => {
  it('đếm lượt và xếp biểu tượng nhiều nhất lên trước', () => {
    expect(reactionSummary({ a: '❤️', b: '👍', c: '❤️' })).toEqual({ emojis: ['❤️', '👍'], total: 3 });
    expect(reactionSummary(undefined)).toEqual({ emojis: [], total: 0 });
  });
});

describe('tệp đính kèm', () => {
  it('nhận tài liệu tới đúng 5MB, tra loại theo đuôi tệp', () => {
    expect(checkAttachment({ name: 'Báo giá.PDF', size: MESSAGE_FILE_MAX_BYTES })).toEqual({ ok: true, mimeType: 'application/pdf' });
    expect(checkAttachment({ name: 'so-lieu.xlsx', size: 1200 })).toMatchObject({ ok: true });
    expect(checkAttachment({ name: 'bo-anh.zip', size: 1200 })).toEqual({ ok: true, mimeType: 'application/zip' });
  });
  it('từ chối tệp quá 5MB, tệp trống và loại không hỗ trợ, nói rõ lý do', () => {
    expect(checkAttachment({ name: 'video-huong-dan.pdf', size: MESSAGE_FILE_MAX_BYTES + 1 })).toMatchObject({ ok: false, reason: expect.stringContaining('5MB') });
    expect(checkAttachment({ name: 'cai-dat.exe', size: 1000 })).toMatchObject({ ok: false, reason: expect.stringContaining('chưa gửi được') });
    expect(checkAttachment({ name: 'khong-duoi', size: 1000 })).toMatchObject({ ok: false });
    expect(checkAttachment({ name: 'rong.txt', size: 0 })).toMatchObject({ ok: false, reason: expect.stringContaining('trống') });
  });
  it('viết dung lượng theo kiểu Việt Nam', () => {
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel(820 * 1024)).toBe('820 KB');
    expect(fileSizeLabel(1.25 * 1024 * 1024)).toBe('1,3 MB');
    expect(fileSizeLabel(MESSAGE_FILE_MAX_BYTES)).toBe('5,0 MB');
  });
});

describe('deliveryStatus', () => {
  it('đang gửi, đã gửi, đã nhận, đã xem theo đúng thứ tự ưu tiên', () => {
    expect(deliveryStatus({ pending: true, deliveredAt: null, readAt: null })).toBe('Đang gửi');
    expect(deliveryStatus({ deliveredAt: null, readAt: null })).toBe('Đã gửi');
    expect(deliveryStatus({ deliveredAt: '2026-11-11T01:00:00Z', readAt: null })).toBe('Đã nhận');
    expect(deliveryStatus({ deliveredAt: '2026-11-11T01:00:00Z', readAt: '2026-11-11T01:05:00Z' })).toBe('Đã xem');
    expect(deliveryStatus({ deliveredAt: null, readAt: '2026-11-11T01:05:00Z' })).toBe('Đã xem');
  });
});
