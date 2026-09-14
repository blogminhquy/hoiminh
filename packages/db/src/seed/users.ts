// Người dùng mẫu: super admin, chủ hội Minh Quý, cộng sự, 30 thành viên.
import { hashPassword } from '@hoiminh/config';
import type { Database } from '../client';
import { userCredentials, users } from '../schema';
import { SEED_PASSWORD, daysFrom, sid } from './ids';

export interface SeedUser {
  key: string;
  id: string;
  name: string;
  handle: string;
  email: string;
  color: string;
  initials: string;
  bio?: string;
  isSuperAdmin?: boolean;
  joinedDaysAgo: number;
}

/** Danh sách người dùng mẫu, tên và màu khớp demo. */
export const SEED_PEOPLE: Array<Omit<SeedUser, 'id'>> = [
  { key: 'admin', name: 'Quản trị Hội Mình', handle: 'hoiminh-admin', email: 'admin@hoiminh.vn', color: '#14110E', initials: 'HM', isSuperAdmin: true, joinedDaysAgo: 400 },
  { key: 'minhquy', name: 'Minh Quý', handle: 'minhquy', email: 'minhquy@gmail.com', color: '#1F1B17', initials: 'MQ', bio: 'Làm MMO từ 2016, hiện điều hành hai hội và chương trình Funnel Money Model. Tin rằng một người với AI có thể vận hành một doanh nghiệp nhỏ có lãi.', joinedDaysAgo: 380 },
  { key: 'hoangvu', name: 'Hoàng Vũ', handle: 'hoang-vu', email: 'hoangvu@gmail.com', color: '#D4593A', initials: 'HV', bio: 'Chạy funnel affiliate cho các khóa học AI. Trước làm content cho agency, giờ làm một mình với 3 con AI agent. Hỏi mình về lead magnet và chuyển đổi.', joinedDaysAgo: 43 },
  { key: 'hongkim', name: 'Hồng Kim', handle: 'hong-kim', email: 'kimhong.hn@gmail.com', color: '#7A5C3E', initials: 'HK', joinedDaysAgo: 34 },
  { key: 'kienbui', name: 'Kiên Bùi', handle: 'kien-bui', email: 'kienbui@gmail.com', color: '#5C7A3E', initials: 'KB', joinedDaysAgo: 4 },
  { key: 'dien', name: 'Điền Phạm Ngọc', handle: 'dien-pham-ngoc', email: 'ngocdien1221@gmail.com', color: '#0E8E96', initials: 'ĐN', bio: 'Chủ shop phụ kiện, đang học làm funnel affiliate. Viết nhật ký mỗi ngày.', joinedDaysAgo: 1 },
  { key: 'duy', name: 'Duy Nguyễn', handle: 'duy-nguyen', email: 'duynguyen@gmail.com', color: '#3E5C7A', initials: 'DN', joinedDaysAgo: 1 },
  { key: 'cong', name: 'Công Trần', handle: 'cong-tran', email: 'congtran@gmail.com', color: '#7A5C3E', initials: 'CT', joinedDaysAgo: 1 },
  { key: 'thulan', name: 'Thu Lan', handle: 'thu-lan', email: 'thulan@gmail.com', color: '#5C3E7A', initials: 'TL', joinedDaysAgo: 20 },
  { key: 'lehanh', name: 'Lê Hạnh', handle: 'le-hanh', email: 'hanh.yoga@gmail.com', color: '#5C7A3E', initials: 'LH', joinedDaysAgo: 60 },
  { key: 'thaovy', name: 'Trần Thảo Vy', handle: 'tran-thao-vy', email: 'vy.english@gmail.com', color: '#3E5C7A', initials: 'TV', joinedDaysAgo: 11 },
  { key: 'huan', name: 'Nguyễn Huân', handle: 'nguyen-huan', email: 'huan@huan.vn', color: '#0E8E96', initials: 'NH', joinedDaysAgo: 200 },
  { key: 'thanhlong', name: 'Phạm Thành Long', handle: 'phamthanhlong', email: 'long@phamthanhlong.vn', color: '#7A5C3E', initials: 'PL', joinedDaysAgo: 300 },
  { key: 'phamduc', name: 'Phạm Đức', handle: 'pham-duc', email: 'phamduc@gmail.com', color: '#5C3E7A', initials: 'PD', joinedDaysAgo: 5 },
];

const EXTRA_NAMES = [
  'An Nguyễn', 'Bảo Trần', 'Chi Lê', 'Dũng Phạm', 'Giang Hoàng', 'Hà Vũ', 'Hùng Đặng', 'Khánh Bùi', 'Lan Đỗ', 'Linh Hồ',
  'Long Ngô', 'Mai Dương', 'Nam Lý', 'Ngân Trịnh', 'Nhung Phan', 'Phong Vương', 'Quang Tạ', 'Sơn Đinh', 'Tâm Lưu', 'Thảo Mạc',
  'Trang Cao', 'Tuấn Kiều', 'Uyên Hà', 'Việt Chu', 'Yến Tô',
];
const EXTRA_COLORS = ['#7A5C3E', '#3E5C7A', '#5C7A3E', '#5C3E7A', '#0E8E96', '#D4593A', '#C89B3C'];

/** Sinh thêm thành viên để tổng số thành viên hội ≥ 30. */
export function extraPeople(): Array<Omit<SeedUser, 'id'>> {
  return EXTRA_NAMES.map((name, i) => {
    const handle = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const parts = name.split(' ');
    return {
      key: `member${i + 1}`,
      name,
      handle,
      email: `${handle.replace(/-/g, '.')}@example.com`,
      color: EXTRA_COLORS[i % EXTRA_COLORS.length] ?? '#7A5C3E',
      initials: parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
      joinedDaysAgo: 2 + ((i * 7) % 90),
    };
  });
}

/** Chèn người dùng và mật khẩu local. Trả về map key → SeedUser. */
export async function seedUsers(db: Database, base: Date): Promise<Record<string, SeedUser>> {
  const all = [...SEED_PEOPLE, ...extraPeople()];
  const passwordHash = await hashPassword(SEED_PASSWORD, 20_000);
  const out: Record<string, SeedUser> = {};
  for (const p of all) {
    const id = await sid(`user:${p.key}`);
    out[p.key] = { ...p, id };
    await db
      .insert(users)
      .values({
        id,
        email: p.email,
        name: p.name,
        handle: p.handle,
        bio: p.bio ?? '',
        coverColor: p.color,
        isSuperAdmin: p.isSuperAdmin ?? false,
        emailVerifiedAt: base,
        links: p.key === 'hoangvu'
          ? [
              { kind: 'website', label: 'Website', url: 'https://hoangvu.vn' },
              { kind: 'facebook', label: 'Facebook', url: 'https://facebook.com/hoangvu.mmo' },
              { kind: 'youtube', label: 'YouTube', url: 'https://youtube.com/@hoangvu' },
            ]
          : p.key === 'minhquy'
            ? [
                { kind: 'website', label: 'Website', url: 'https://minhquy.vn' },
                { kind: 'facebook', label: 'Facebook', url: 'https://facebook.com/blogminhquy' },
                { kind: 'youtube', label: 'YouTube', url: 'https://youtube.com/@minhquy' },
              ]
            : [],
        location: p.key === 'minhquy' ? 'Hà Nội' : '',
        occupation: p.key === 'minhquy' ? 'Sáng lập MMO for Freedom' : '',
        lastSeenAt: daysFrom(base, 0, 9),
        createdAt: daysFrom(base, -p.joinedDaysAgo, 9),
      })
      .onConflictDoNothing();
    await db.insert(userCredentials).values({ userId: id, passwordHash }).onConflictDoNothing();
  }
  return out;
}
