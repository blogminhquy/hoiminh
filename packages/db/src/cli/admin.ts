// pnpm db:admin <email> <mật khẩu> [tên] — tạo hoặc nâng một tài khoản thành quản trị hệ thống.
// Dùng khi dựng môi trường mới: database trống chưa có ai, không thể nâng quyền từ giao diện.
import { hashPassword } from '@hoiminh/config';
import { eq } from 'drizzle-orm';
import { connect } from '../client';
import { userCredentials, users } from '../schema';
import { loadCliEnv } from './env';

const [emailArg, password, ...nameParts] = process.argv.slice(2);
if (!emailArg || !password) {
  console.error('Dùng: pnpm db:admin <email> <mật khẩu> [tên hiển thị]');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();
const name = nameParts.join(' ').trim() || (email.split('@')[0] ?? 'Quản trị');
if (password.length < 8) {
  console.error('Mật khẩu tối thiểu 8 ký tự.');
  process.exit(1);
}

const env = loadCliEnv();
const handle = await connect(env.DATABASE_DIRECT_URL || env.DATABASE_URL);
const db = handle.db;

/** Slug tiếng Việt không dấu (giống toSlug của @hoiminh/contracts, chép lại để packages/db không phụ thuộc thêm gói). */
function slug(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

/** Handle duy nhất sinh từ tên. */
async function uniqueHandle(base: string): Promise<string> {
  const root = slug(base).slice(0, 24) || 'quan-tri';
  for (let i = 0; i < 50; i++) {
    const h = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await db.query.users.findFirst({ where: eq(users.handle, h), columns: { id: true } });
    if (!taken) return h;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
const now = new Date();
const passwordHash = await hashPassword(password);

if (existing) {
  await db.update(users).set({ isSuperAdmin: true, status: 'active', emailVerifiedAt: existing.emailVerifiedAt ?? now, updatedAt: now }).where(eq(users.id, existing.id));
  await db.insert(userCredentials).values({ userId: existing.id, passwordHash }).onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash, updatedAt: now } });
  await db.update(users).set({ authProviderId: existing.authProviderId ?? existing.id }).where(eq(users.id, existing.id));
  console.log(`✔ Đã nâng ${email} thành quản trị hệ thống và đặt lại mật khẩu.`);
} else {
  const [created] = await db.insert(users).values({ email, name, handle: await uniqueHandle(name), isSuperAdmin: true, emailVerifiedAt: now }).returning();
  await db.update(users).set({ authProviderId: created!.id }).where(eq(users.id, created!.id));
  await db.insert(userCredentials).values({ userId: created!.id, passwordHash });
  console.log(`✔ Đã tạo quản trị hệ thống ${email} (${name}).`);
}
console.log('Đăng nhập ở /dang-nhap rồi vào /he-thong. Đổi mật khẩu ngay ở Tài khoản · Hồ sơ.');
await handle.close();
