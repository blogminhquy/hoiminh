// Chạy migration SQL trong thư mục migrations/ (journal của drizzle-kit) cho cả PGlite và PostgreSQL.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DbHandle, Schema } from './client';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Áp dụng mọi migration còn thiếu. An toàn khi gọi lặp lại. */
export async function runMigrations(handle: DbHandle): Promise<void> {
  if (handle.kind === 'pglite') {
    await migratePglite(handle.driver as PgliteDatabase<Schema>, { migrationsFolder });
  } else {
    await migratePostgres(handle.driver as PostgresJsDatabase<Schema>, { migrationsFolder });
  }
}
