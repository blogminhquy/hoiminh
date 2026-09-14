// Truy vấn SQL thô trả về mảng dòng, đồng nhất giữa PGlite (Results.rows) và postgres-js (RowList).
import type { SQL } from 'drizzle-orm';
import type { DbExecutor } from '@hoiminh/db';

/** Chạy câu SQL thô và trả về mảng dòng đã ép kiểu. */
export async function raw<T = Record<string, unknown>>(db: DbExecutor, query: SQL): Promise<T[]> {
  const r = (await db.execute(query)) as unknown;
  if (Array.isArray(r)) return r as T[];
  return ((r as { rows?: unknown[] }).rows ?? []) as T[];
}
