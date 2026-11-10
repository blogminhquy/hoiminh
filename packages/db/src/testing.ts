// Database test dựng sẵn: migration + seed chỉ chạy MỘT lần cho cả lượt test, mỗi file test nạp lại từ bản chụp.
// Vì sao: dựng PGlite từ đầu (mở, migration, seed) mất khoảng 3 giây, mà mỗi file test cần một database riêng.
// Gói core có 23 file như vậy, tức hơn một phút chỉ để lặp lại đúng một việc. Nạp từ bản chụp mất khoảng nửa giây.
// Bản chụp do globalSetup của vitest tạo ở đầu MỖI lượt chạy (testing-global-setup.ts) rồi xóa khi xong,
// nên không bao giờ cũ so với migration hay seed đang có trong cây mã.
// Chỉ dùng trong test, chỉ chạy ở Node. Không import file này từ code chạy thật.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { connect, type Database, type DbHandle } from './client';
import { runMigrations } from './migrate';
import * as schema from './schema';
import { seedAll, type SeedOptions, type SeedSummary } from './seed';

/** Biến môi trường mang đường dẫn thư mục bản chụp từ globalSetup sang các tiến trình chạy test. */
export const TEST_DB_SNAPSHOT_ENV = 'HOIMINH_TEST_DB_SNAPSHOT';

/** Tham số seed mà mọi test của core và api đang dùng. Bản chụp được tạo với đúng bộ này. */
export const TEST_SEED_OPTIONS: SeedOptions = { encryptionKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', appUrl: 'http://localhost:5173' };

export interface SeededTestDb {
  handle: DbHandle;
  seed: SeedSummary;
}

interface SnapshotMeta {
  options: SeedOptions;
  seed: SeedSummary;
}

const DATA_FILE = 'pgdata.tar';
const META_FILE = 'meta.json';

async function buildFresh(opts: SeedOptions): Promise<SeededTestDb> {
  const handle = await connect('pglite://memory');
  await runMigrations(handle);
  const seed = await seedAll(handle.db, opts);
  return { handle, seed };
}

/** Dựng database mẫu một lần rồi ghi bản chụp ra thư mục tạm. Trả về đường dẫn thư mục. */
export async function createTestDbSnapshot(opts: SeedOptions = TEST_SEED_OPTIONS): Promise<string> {
  const { handle, seed } = await buildFresh(opts);
  const client = (handle.driver as { $client: PGlite }).$client;
  // Không nén: file chỉ sống trong một lượt test, mà nén rồi giải nén ở từng file test tốn hơn là ghi thẳng.
  const dump = await client.dumpDataDir('none');
  await handle.close();
  const dir = mkdtempSync(join(tmpdir(), 'hoiminh-test-db-'));
  writeFileSync(join(dir, DATA_FILE), Buffer.from(await dump.arrayBuffer()));
  writeFileSync(join(dir, META_FILE), JSON.stringify({ options: opts, seed } satisfies SnapshotMeta));
  return dir;
}

export function removeTestDbSnapshot(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function readSnapshot(opts: SeedOptions): { data: Blob; seed: SeedSummary } | null {
  const dir = process.env[TEST_DB_SNAPSHOT_ENV];
  if (!dir) return null;
  try {
    const meta = JSON.parse(readFileSync(join(dir, META_FILE), 'utf8')) as SnapshotMeta;
    // Bản chụp chỉ dùng được khi seed với đúng tham số test đang cần; lệch thì dựng từ đầu như cũ.
    if (meta.options.encryptionKey !== opts.encryptionKey || meta.options.appUrl !== opts.appUrl) return null;
    return { data: new Blob([readFileSync(join(dir, DATA_FILE))]), seed: meta.seed };
  } catch {
    return null;
  }
}

/**
 * Mở một PGlite trong bộ nhớ đã có migration và dữ liệu mẫu, riêng cho người gọi.
 * Có bản chụp của lượt test (globalSetup) thì nạp từ đó; không có (chạy lẻ ngoài vitest, tham số seed khác)
 * thì dựng từ đầu. Hai đường cho ra database giống nhau.
 */
export async function openSeededTestDb(opts: SeedOptions = TEST_SEED_OPTIONS): Promise<SeededTestDb> {
  const snapshot = readSnapshot(opts);
  if (!snapshot) return buildFresh(opts);
  const client = new PGlite({ loadDataDir: snapshot.data });
  await client.waitReady;
  const db = drizzle(client, { schema });
  return {
    handle: { db: db as unknown as Database, driver: db, kind: 'pglite', close: async () => client.close() },
    seed: snapshot.seed,
  };
}
