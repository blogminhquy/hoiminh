// Date đặt thẳng trong sql`...` phải chạy được trên postgres-js (production), không chỉ trên PGlite.
//
// drizzle thay serializer ngày giờ của postgres-js bằng hàm trả nguyên giá trị, nên trước đây
// `sql\`paid_at >= ${since}\`` với `since` là Date nổ TypeError ngay ở driver (trang Hội của tôi,
// Doanh thu). Test trên Postgres thật chỉ chạy khi có TEST_POSTGRES_URL.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { connect, serializeDateParam } from '../client';

describe('serializeDateParam', () => {
  it('đổi Date thành chuỗi ISO, giữ nguyên giá trị khác', () => {
    const d = new Date('2026-09-28T10:00:00.000Z');
    expect(serializeDateParam(d)).toBe('2026-09-28T10:00:00.000Z');
    expect(serializeDateParam('2026-09-28')).toBe('2026-09-28');
    expect(serializeDateParam(null)).toBeNull();
  });
});

const url = process.env.TEST_POSTGRES_URL;

describe.skipIf(!url)('postgres-js: tham số Date trong sql thô', () => {
  it('so sánh timestamptz với Date không lỗi', async () => {
    const handle = await connect(url!);
    try {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const r = (await handle.db.execute(sql`select now() >= ${since} as ok, ${since}::timestamptz = ${since.toISOString()}::timestamptz as same`)) as unknown as { ok: boolean; same: boolean }[];
      expect(r[0]).toEqual({ ok: true, same: true });
    } finally {
      await handle.close();
    }
  });
});
