// Kết nối cơ sở dữ liệu: PGlite (local/test) hoặc PostgreSQL (Supabase) tùy DATABASE_URL.
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type Schema = typeof schema;
/** Kiểu DB chung cho cả hai driver (chỉ dùng API của PgDatabase). */
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type Transaction = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Kiểu truy vấn dùng chung cho db hoặc transaction. */
export type DbExecutor = Database | Transaction;

export interface DbHandle {
  db: Database;
  kind: 'pglite' | 'postgres';
  /** Đối tượng driver gốc (PGlite hoặc postgres-js) cho migrator. */
  driver: unknown;
  /** Đóng kết nối (dùng trong test và CLI). */
  close: () => Promise<void>;
}

const cache = new Map<string, Promise<DbHandle>>();

/** Mở kết nối theo URL. `pglite://<thư mục>` hoặc `pglite://memory` cho local, `postgresql://…` cho Supabase. */
export async function connect(url: string): Promise<DbHandle> {
  if (url.startsWith('pglite://')) {
    const target = url.slice('pglite://'.length);
    if (target === 'memory') return openPglite(target);
    let p = cache.get(target);
    if (!p) {
      p = openPglite(target);
      cache.set(target, p);
    }
    return p;
  }
  return openPostgres(url);
}

async function openPglite(target: string): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (target !== 'memory') {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(target, { recursive: true });
  }
  const client = target === 'memory' ? new PGlite() : new PGlite(target);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  return { db: db as unknown as Database, driver: db, kind: 'pglite', close: async () => client.close() };
}

async function openPostgres(url: string): Promise<DbHandle> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
  const db = drizzlePostgres(sql, { schema });
  return { db: db as unknown as Database, driver: db, kind: 'postgres', close: async () => sql.end({ timeout: 5 }) };
}

export { schema };
