// Chứng minh policy `tenant_isolation` thật sự chặn, không chỉ tồn tại.
//
// Ở local và ở production hiện tại, vai trò kết nối là chủ sở hữu bảng nên Postgres cho đi
// qua RLS. Test này dựng một vai trò KHÁC (không phải chủ sở hữu), bật FORCE ROW LEVEL
// SECURITY rồi `SET ROLE` sang vai trò đó — đúng trạng thái sau khi chạy `pnpm db:rls on`.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type DbHandle } from '../client';
import { runMigrations } from '../migrate';
import { seedAll, sid } from '../seed';

let handle: DbHandle;
let kd = '';
let other = '';
let minhquy = '';
let otherSpace = '';
/** Số liệu thật khi đọc bằng chủ sở hữu bảng, để so với số liệu qua RLS. */
let truth = { all: 0, mine: 0, theirs: 0 };

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await handle.db.execute(q)) as unknown as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

/** Chạy truy vấn dưới vai trò hạn chế với bộ biến phiên cho trước. */
async function asTenant<T>(scope: { userId?: string; communityIds?: string[]; workspaceIds?: string[]; bypass?: boolean }, q: ReturnType<typeof sql>): Promise<T[]> {
  await handle.db.execute(sql`set role hoiminh_app_test`);
  await handle.db.execute(sql`select
    set_config('app.user_id', ${scope.userId ?? ''}, false),
    set_config('app.workspace_ids', ${(scope.workspaceIds ?? []).join(',')}, false),
    set_config('app.community_ids', ${(scope.communityIds ?? []).join(',')}, false),
    set_config('app.bypass', ${scope.bypass ? 'on' : 'off'}, false)`);
  try {
    return await rows<T>(q);
  } finally {
    await handle.db.execute(sql`reset role`);
  }
}

beforeAll(async () => {
  handle = await connect('pglite://memory');
  await runMigrations(handle);
  await seedAll(handle.db, { encryptionKey: '', appUrl: 'http://localhost:5173' });
  kd = await sid('community:kd');
  other = await sid('community:yt');
  minhquy = await sid('user:minhquy');

  // Vai trò ứng dụng: có quyền đọc/ghi nhưng KHÔNG sở hữu bảng, nên RLS áp dụng.
  // PGlite chỉ nhận một câu lệnh mỗi lần gọi nên tách ra từng câu.
  for (const stmt of [
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app_test') THEN CREATE ROLE hoiminh_app_test NOLOGIN; END IF; END $$`,
    'GRANT USAGE ON SCHEMA public TO hoiminh_app_test',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hoiminh_app_test',
    'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hoiminh_app_test',
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hoiminh_app_test',
  ]) {
    await handle.db.execute(sql.raw(stmt));
  }
  // Dữ liệu mẫu chỉ có bài viết ở một hội. Tạo thêm một bài ở hội thứ hai để phép thử
  // "không thấy hội khác" có ý nghĩa thay vì đúng vì bảng rỗng.
  await handle.db.execute(sql`insert into spaces (id, community_id, name, slug, sort_order)
    values (gen_random_uuid(), ${other}, 'Chung', 'chung', 0) on conflict do nothing`);
  await handle.db.execute(sql`insert into posts (community_id, author_user_id, title, content_md, excerpt, space_id)
    select ${other}, ${minhquy}, 'Bài của hội khác', 'x', 'x', id from spaces where community_id = ${other} limit 1`);
  otherSpace = (await rows<{ id: string }>(sql`select id from spaces where community_id = ${other} limit 1`))[0]!.id;
  const totals = await rows<{ all: number; mine: number; theirs: number }>(sql`select
    (select count(*)::int from posts) as all,
    (select count(*)::int from posts where community_id = ${kd}) as mine,
    (select count(*)::int from posts where community_id = ${other}) as theirs`);
  truth = { all: Number(totals[0]!.all), mine: Number(totals[0]!.mine), theirs: Number(totals[0]!.theirs) };
  expect(truth.theirs).toBeGreaterThan(0);

  // Đúng việc mà `pnpm db:rls on` làm.
  await handle.db.execute(sql.raw(`
    DO $$ DECLARE t record; BEGIN
      FOR t IN SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE '\\_\\_%' AND c.relname <> 'drizzle_migrations'
      LOOP EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.name); END LOOP;
    END $$;`));
}, 180_000);

afterAll(async () => {
  await handle.close();
});

describe('RLS chặn theo tenant khi đã bật thi hành', () => {
  it('thành viên chỉ thấy bài viết của hội mình, không thấy hội khác', async () => {
    const scope = { userId: minhquy, communityIds: [kd] };
    const mine = await asTenant<{ c: number }>(scope, sql`select count(*)::int as c from posts where community_id = ${kd}`);
    expect(Number(mine[0]!.c)).toBe(truth.mine);

    const theirs = await asTenant<{ c: number }>(scope, sql`select count(*)::int as c from posts where community_id = ${other}`);
    expect(Number(theirs[0]!.c)).toBe(0);

    // Truy vấn không lọc gì cũng chỉ ra đúng phần của mình: đây mới là điều RLS bảo đảm.
    const unfiltered = await asTenant<{ c: number }>(scope, sql`select count(*)::int as c from posts`);
    expect(Number(unfiltered[0]!.c)).toBe(truth.mine);
    expect(truth.all).toBeGreaterThan(truth.mine);
  });

  it('không có biến phiên thì không thấy gì', async () => {
    const none = await asTenant<{ c: number }>({}, sql`select count(*)::int as c from posts`);
    expect(Number(none[0]!.c)).toBe(0);
  });

  it('bypass của tiến trình hệ thống thấy mọi tenant', async () => {
    const all = await asTenant<{ c: number }>({ bypass: true }, sql`select count(*)::int as c from posts`);
    expect(Number(all[0]!.c)).toBe(truth.all);
  });

  it('không ghi được vào hội không thuộc phạm vi', async () => {
    // Dùng id lấy sẵn bằng quyền chủ sở hữu: nếu chọn id qua truy vấn thì RLS đã lọc mất
    // hàng nguồn và câu lệnh ghi 0 dòng, không chạm tới WITH CHECK.
    const insert = sql`insert into posts (community_id, author_user_id, title, content_md, excerpt, space_id)
      values (${other}, ${minhquy}, 'Lén', 'x', 'x', ${otherSpace})`;
    await expect(asTenant({ userId: minhquy, communityIds: [kd] }, insert)).rejects.toThrow(/row-level security|policy/i);

    const after = await rows<{ c: number }>(sql`select count(*)::int as c from posts where community_id = ${other}`);
    expect(Number(after[0]!.c)).toBe(truth.theirs);
  });

  it('dữ liệu riêng của người dùng chỉ chính chủ đọc được', async () => {
    const own = await asTenant<{ c: number }>({ userId: minhquy }, sql`select count(*)::int as c from notifications where user_id = ${minhquy}`);
    const someoneElse = await sid('user:hoangvu');
    const others = await asTenant<{ c: number }>({ userId: minhquy }, sql`select count(*)::int as c from notifications where user_id = ${someoneElse}`);
    expect(Number(own[0]!.c) + Number(others[0]!.c)).toBe(Number(own[0]!.c));
    expect(Number(others[0]!.c)).toBe(0);
  });
});
