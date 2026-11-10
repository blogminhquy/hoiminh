// Database test dựng sẵn (testing.ts): nạp từ bản chụp phải cho ra đúng database như dựng từ đầu,
// và mỗi lần mở là một database riêng. Hai điều này là lý do test của core và api được phép dùng bản chụp.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../client';
import { connect } from '../client';
import { runMigrations } from '../migrate';
import { seedAll } from '../seed';
import { createTestDbSnapshot, openSeededTestDb, removeTestDbSnapshot, TEST_DB_SNAPSHOT_ENV, TEST_SEED_OPTIONS } from '../testing';

let dir = '';
const opened: DbHandle[] = [];
const track = (h: DbHandle) => (opened.push(h), h);

async function rows<T>(h: DbHandle, q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await h.db.execute(q)) as unknown as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

/** Số dòng của từng bảng trong schema public: đủ để thấy thiếu bảng, thiếu migration hay thiếu dữ liệu mẫu. */
async function rowCounts(h: DbHandle): Promise<Record<string, number>> {
  const tables = await rows<{ tablename: string }>(h, sql`select tablename from pg_tables where schemaname = 'public' order by tablename`);
  const out: Record<string, number> = {};
  for (const { tablename } of tables) {
    const r = await rows<{ n: number }>(h, sql.raw(`select count(*)::int as n from "${tablename}"`));
    out[tablename] = r[0]!.n;
  }
  return out;
}

beforeAll(async () => {
  dir = await createTestDbSnapshot();
  process.env[TEST_DB_SNAPSHOT_ENV] = dir;
}, 120_000);
afterAll(async () => {
  delete process.env[TEST_DB_SNAPSHOT_ENV];
  for (const h of opened) await h.close();
  removeTestDbSnapshot(dir);
});

describe('database test dựng sẵn', () => {
  it('nạp từ bản chụp cho ra cùng bảng, cùng số dòng và cùng kết quả seed như dựng từ đầu', async () => {
    const fresh = track(await connect('pglite://memory'));
    await runMigrations(fresh);
    const freshSeed = await seedAll(fresh.db, TEST_SEED_OPTIONS);
    const { handle, seed } = await openSeededTestDb();
    track(handle);
    expect(seed).toEqual(freshSeed);
    const counts = await rowCounts(handle);
    expect(Object.keys(counts).length).toBeGreaterThan(20);
    expect(counts.users).toBe(freshSeed.users);
    expect(counts).toEqual(await rowCounts(fresh));
  });

  it('mỗi lần mở là một database riêng: ghi ở bên này không lọt sang bên kia', async () => {
    const a = track((await openSeededTestDb()).handle);
    const b = track((await openSeededTestDb()).handle);
    await a.db.execute(sql`create table chi_co_o_a (id int)`);
    await a.db.execute(sql`insert into chi_co_o_a values (1)`);
    expect((await rowCounts(a)).chi_co_o_a).toBe(1);
    expect((await rowCounts(b)).chi_co_o_a).toBeUndefined();
  });

  it('tham số seed khác bản chụp thì dựng từ đầu, không dùng nhầm bản chụp', async () => {
    const other = { ...TEST_SEED_OPTIONS, appUrl: 'https://khac.example' };
    const { handle, seed } = await openSeededTestDb(other);
    track(handle);
    expect(seed.alreadySeeded).toBe(false);
    // Bản dựng từ đầu đi qua connect() nên có driver của drizzle; chỉ cần biết nó chạy được và đủ dữ liệu.
    expect((await rowCounts(handle)).users).toBe(seed.users);
  });

  it('không có bản chụp (chạy ngoài globalSetup) vẫn mở được database mẫu', async () => {
    const saved = process.env[TEST_DB_SNAPSHOT_ENV];
    delete process.env[TEST_DB_SNAPSHOT_ENV];
    try {
      const { handle, seed } = await openSeededTestDb();
      track(handle);
      expect((await rowCounts(handle)).users).toBe(seed.users);
    } finally {
      process.env[TEST_DB_SNAPSHOT_ENV] = saved;
    }
  });
});
