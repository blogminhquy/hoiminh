// Điều phối seed: 1 super admin, chủ hội Minh Quý với hội Freemium, 4 khóa học, 30+ thành viên, 6 sự kiện, 6 sản phẩm, cộng sự có ví.
import type { Database } from '../client';
import { users } from '../schema';
import { seedAffiliate } from './affiliate';
import { seedCommerce } from './commerce';
import { seedCommunities } from './community';
import { seedContent } from './content';
import { seedCourses } from './courses';
import { seedEvents } from './events';
import { seedBase, sid } from './ids';
import { seedPlatform } from './platform';
import { seedUsers } from './users';

export interface SeedOptions {
  encryptionKey: string;
  appUrl: string;
}

export interface SeedSummary {
  alreadySeeded: boolean;
  users: number;
  communityId: string;
  communitySlug: string;
  superAdminEmail: string;
  ownerEmail: string;
  password: string;
}

/** Nạp toàn bộ dữ liệu mẫu. Idempotent: gọi lại không tạo trùng. */
export async function seedAll(db: Database, opts: SeedOptions): Promise<SeedSummary> {
  const base = seedBase();
  const adminId = await sid('user:admin');
  const existing = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, adminId) });
  const U = await seedUsers(db, base);
  const { main, others } = await seedCommunities(db, base, U);
  await seedContent(db, base, U, main);
  const cs = await seedCourses(db, base, U, main);
  await seedEvents(db, base, U, main);
  await seedCommerce(db, base, U, main, cs);
  await seedAffiliate(db, base, U, main, opts);
  await seedPlatform(db, base, U, main, others);
  const count = await db.select({ id: users.id }).from(users);
  return {
    alreadySeeded: Boolean(existing),
    users: count.length,
    communityId: main.id,
    communitySlug: main.slug,
    superAdminEmail: 'admin@hoiminh.vn',
    ownerEmail: 'minhquy@gmail.com',
    password: 'hoiminh123',
  };
}

export { SEED_PASSWORD, sid } from './ids';
export { SEED_PEOPLE } from './users';
