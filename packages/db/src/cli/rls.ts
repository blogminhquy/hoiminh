// Bật/tắt thi hành Row Level Security: `pnpm db:rls on | off | status`.
//
// Vì sao cần bước riêng: vai trò của API là chủ sở hữu bảng, mà Postgres mặc định cho chủ
// sở hữu đi qua RLS. `FORCE ROW LEVEL SECURITY` bắt chính chủ sở hữu cũng phải theo policy.
// Chỉ bật khi ứng dụng đã đặt biến phiên trong mọi đường chạy (xem packages/core/lib/tenant-scope.ts),
// và bật trong lúc có người theo dõi log: bật sai thì truy vấn không lỗi mà trả về rỗng.
import { sql } from 'drizzle-orm';
import { connect } from '../client';
import { loadCliEnv } from './env';

const TABLES = sql`
  select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not like '\\_\\_%' and c.relname <> 'drizzle_migrations'
  order by c.relname`;

function setForce(on: boolean) {
  return sql.raw(`
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE '\\_\\_%' AND c.relname <> 'drizzle_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ${on ? 'FORCE' : 'NO FORCE'} ROW LEVEL SECURITY', t.name);
  END LOOP;
END $$;`);
}

async function main() {
  const action = (process.argv[2] ?? 'status').toLowerCase();
  if (!['on', 'off', 'status'].includes(action)) {
    console.error('Dùng: pnpm db:rls on | off | status');
    process.exit(1);
  }
  const env = loadCliEnv();
  const handle = await connect(env.DATABASE_DIRECT_URL || env.DATABASE_URL);
  try {
    if (action !== 'status') await handle.db.execute(setForce(action === 'on'));
    const res = (await handle.db.execute(TABLES)) as unknown as { rows?: Array<{ name: string; enabled: boolean; forced: boolean }> } | Array<{ name: string; enabled: boolean; forced: boolean }>;
    const list = Array.isArray(res) ? res : (res.rows ?? []);
    const enabled = list.filter((r) => r.enabled).length;
    const forced = list.filter((r) => r.forced).length;
    const missing = list.filter((r) => !r.enabled).map((r) => r.name);
    console.info(`Bảng: ${list.length} · bật RLS: ${enabled} · đang thi hành (FORCE): ${forced}`);
    if (missing.length) console.warn(`Chưa bật RLS: ${missing.join(', ')}`);
    if (action === 'on') console.info('Đã bật thi hành. Theo dõi log: truy vấn thiếu biến phiên sẽ trả về rỗng chứ không báo lỗi. Tắt lại bằng: pnpm db:rls off');
    if (action === 'off') console.info('Đã tắt thi hành. Policy vẫn còn nguyên, chỉ không chặn chủ sở hữu bảng.');
  } finally {
    await handle.close();
  }
}

void main();
