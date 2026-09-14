// Kiểm tra migration chạy được trên PGlite, seed idempotent, sổ cái ví đúng công thức, unique idempotency.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type DbHandle } from '../client';
import { runMigrations } from '../migrate';
import { affiliateWalletEntries } from '../schema';
import { seedAll, sid } from '../seed';

let handle: DbHandle;

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await handle.db.execute(q)) as unknown as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

beforeAll(async () => {
  handle = await connect('pglite://memory');
  await runMigrations(handle);
}, 120_000);

afterAll(async () => {
  await handle.close();
});

describe('schema + seed', () => {
  it('tạo đủ bảng nghiệp vụ', async () => {
    const list = await rows<{ table_name: string }>(sql`select table_name from information_schema.tables where table_schema = 'public'`);
    const names = new Set(list.map((r) => r.table_name));
    for (const t of ['users', 'workspaces', 'communities', 'community_members', 'posts', 'courses', 'lessons', 'events', 'products', 'orders', 'payments', 'webhook_events', 'entitlements', 'affiliate_wallet_entries', 'affiliate_withdrawal_requests', 'plans', 'api_keys', 'audit_logs', 'feature_flags', 'scheduled_jobs']) {
      expect(names.has(t), t).toBe(true);
    }
  });

  it('bật RLS trên bảng tenant', async () => {
    const list = await rows<{ relname: string; relrowsecurity: boolean }>(sql`select relname, relrowsecurity from pg_class where relname in ('posts','community_members','payments')`);
    expect(list.length).toBe(3);
    for (const r of list) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it('seed chạy hai lần không tạo trùng', async () => {
    const a = await seedAll(handle.db, { encryptionKey: '', appUrl: 'http://localhost:5173' });
    const b = await seedAll(handle.db, { encryptionKey: '', appUrl: 'http://localhost:5173' });
    expect(a.users).toBeGreaterThanOrEqual(30);
    expect(b.users).toBe(a.users);
    expect(b.alreadySeeded).toBe(true);
  }, 120_000);

  it('số dư ví = credit + release + adjustment − hold − debit và không âm sau seed', async () => {
    const acc = await sid('affiliate:kd:hoangvu');
    const r = await rows<{ balance: string }>(sql`
      select coalesce(sum(case when entry_type in ('credit','release','adjustment') then amount_minor else 0 end),0)
           - coalesce(sum(case when entry_type in ('hold','debit') then amount_minor else 0 end),0) as balance
      from affiliate_wallet_entries where affiliate_account_id = ${acc}`);
    expect(Number(r[0]?.balance)).toBeGreaterThanOrEqual(0);
  });

  it('idempotency_key của sổ cái là UNIQUE', async () => {
    const acc = await sid('affiliate:kd:hoangvu');
    await expect(
      handle.db.insert(affiliateWalletEntries).values({ affiliateAccountId: acc, entryType: 'credit', amountMinor: 1, idempotencyKey: 'commission-credit:' + (await sid('comm:hv:hongkim')) }),
    ).rejects.toThrow();
  });
});
