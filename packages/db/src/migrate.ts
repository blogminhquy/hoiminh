// Chạy migration SQL trong thư mục migrations/ (journal của drizzle-kit) cho cả PGlite và PostgreSQL.
// Mọi thứ phụ thuộc hệ tệp đều nằm trong hàm: Worker import @hoiminh/db nhưng không bao giờ gọi
// runMigrations, mà ở runtime Workers `import.meta.url` không có nên tính ở cấp module sẽ nổ lúc khởi động.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DbHandle, Schema } from './client';

/** Áp dụng mọi migration còn thiếu. An toàn khi gọi lặp lại. Chỉ chạy được ở Node. */
export async function runMigrations(handle: DbHandle): Promise<void> {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  if (handle.kind === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(handle.driver as PgliteDatabase<Schema>, { migrationsFolder });
  } else {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    await migrate(handle.driver as PostgresJsDatabase<Schema>, { migrationsFolder });
  }
}
