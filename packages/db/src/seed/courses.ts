// 4 khóa học đã đăng + 1 khóa nháp, module, bài học, tài liệu, tiến độ.
import type { Database } from '../client';
import { courseEnrollments, courseModules, courseProgress, courses, lessonProgress, lessonResources, lessons } from '../schema';
import type { SeedCommunity } from './community';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

interface CourseSpec {
  key: string; title: string; slug: string; short: string; color: string; accessMode: 'all_members' | 'premium' | 'store_only' | 'premium_and_store';
  price?: number; compareAt?: number; status?: 'draft' | 'published'; modules: Array<{ title: string; lessons: Array<[string, number | null]> }>;
  descriptionMd?: string; sortOrder: number;
}

const m = (title: string, ...lessons: Array<[string, number | null]>) => ({ title, lessons });
const gen = (prefix: string, n: number, from = 1): Array<[string, number | null]> =>
  Array.from({ length: n }, (_, i) => [`${prefix} ${from + i}`, 420 + ((i * 97) % 480)] as [string, number | null]);

/** Nội dung khóa học khớp demo (Funnel Money Model 2026 chi tiết, các khóa khác sinh bài). */
export const COURSE_SPECS: CourseSpec[] = [
  {
    key: 'fmm', title: 'Funnel Money Model 2026', slug: 'funnel-money-model-2026', color: '#D4593A', accessMode: 'premium_and_store', price: 1_000_000, compareAt: 1_686_000, sortOrder: 0,
    short: 'Thiết kế offer, lead magnet và tripwire để hoàn vốn quảng cáo ngay từ đơn đầu, cho người bán một mình.',
    descriptionMd: '**Sau khóa này** bạn viết được một offer bằng công thức giá trị, dựng lead magnet một trang và đặt giá tripwire để hoàn vốn ads ngay đơn đầu.\n\n## Dành cho\n\n- Người bán một mình\n- Chủ shop nhỏ, coach, freelancer',
    modules: [
      m('Tư duy mô hình tiền', ['Tiền chảy theo mô hình, không theo may mắn', 490], ['Ba con số quyết định lãi', 622], ['Điểm hòa vốn sớm là gì', 465], ['Ví dụ: shop 1 người thu 30 triệu', 725], ['Bài tập: vẽ dòng tiền của bạn', null]),
      m('Thiết kế Offer', ['Khách hàng thực sự mua gì', 552], ['Ba lớp giá trị của một offer', 664], ['Viết offer bằng công thức giá trị', 761], ['Định giá theo kết quả', 535], ['Bảo hành và đảo ngược rủi ro', 450], ['Bài tập: Offer Canvas của bạn', null]),
      m('Lead magnet và Tripwire', ...gen('Lead magnet bài', 7)),
      m('Scale bằng cộng sự affiliate', ['Thiết kế hoa hồng 50%', 610], ...gen('Scale bài', 7, 2)),
    ],
  },
  { key: 'fbads', title: 'Facebook Ads chuyển đổi 2026', slug: 'facebook-ads-2026', color: '#0E8E96', accessMode: 'premium', sortOrder: 1, short: 'Chạy quảng cáo về trang giới thiệu, retarget và đo lường đăng ký.', modules: [m('Nền tảng', ...gen('Nền tảng bài', 14)), m('Chiến dịch', ...gen('Chiến dịch bài', 14)), m('Retarget', ...gen('Retarget bài', 14)), m('Đo lường', ...gen('Đo lường bài', 13))] },
  { key: 'aiagent', title: 'AI Agent cho người bán hàng', slug: 'ai-agent-cho-nguoi-ban-hang', color: '#3E5C7A', accessMode: 'premium_and_store', price: 1_200_000, compareAt: 1_900_000, sortOrder: 2, short: 'Dựng trợ lý trả lời khách, chốt đơn và chăm sóc sau bán.', modules: [m('Trợ lý AI làm được gì', ['Trợ lý AI khác chatbot cũ chỗ nào', 460], ['Ba việc giao cho AI ngay hôm nay', 552], ['Chuẩn bị tài khoản và dữ liệu shop', null], ['Bài tập: liệt kê 20 câu khách hay hỏi', null]), m('Dựng trợ lý trả lời khách', ...gen('Dựng bài', 9)), m('Chốt đơn và chăm sóc sau bán', ...gen('Chốt đơn bài', 9))] },
  { key: 'affiliate', title: 'Kiếm tiền với Funnel Affiliate', slug: 'kiem-tien-voi-funnel-affiliate', color: '#7A5C3E', accessMode: 'premium_and_store', price: 490_000, sortOrder: 3, short: 'Chương trình cộng sự: nhận link, chia sẻ, nhận hoa hồng định kỳ.', modules: [m('Bắt đầu', ...gen('Bắt đầu bài', 6)), m('Kéo 100 đăng ký đầu tiên', ...gen('Kéo bài', 6)), m('Tối ưu chuyển đổi', ...gen('Tối ưu bài', 6))] },
  { key: 'congsu', title: 'Chương trình Cộng sự MMO', slug: 'chuong-trinh-cong-su-mmo', color: '#5C7A3E', accessMode: 'all_members', status: 'draft', sortOrder: 4, short: 'Khóa nội bộ cho cộng sự, đang soạn.', modules: [m('Giới thiệu', ...gen('Giới thiệu bài', 6))] },
];

export interface SeedCourses {
  courseIds: Record<string, string>;
  lessonIds: Record<string, string[]>;
}

/** Chèn khóa học, bài học, tài liệu và tiến độ của các thành viên chính. */
export async function seedCourses(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity): Promise<SeedCourses> {
  const courseIds: Record<string, string> = {};
  const lessonIds: Record<string, string[]> = {};
  for (const spec of COURSE_SPECS) {
    const courseId = await sid(`course:${spec.key}`);
    courseIds[spec.key] = courseId;
    const total = spec.modules.reduce((n, mod) => n + mod.lessons.length, 0);
    const duration = spec.modules.reduce((n, mod) => n + mod.lessons.reduce((s, [, d]) => s + (d ?? 0), 0), 0);
    await db
      .insert(courses)
      .values({
        id: courseId, workspaceId: c.workspaceId, communityId: c.id, ownerUserId: U.minhquy!.id, title: spec.title, slug: spec.slug, shortDescription: spec.short,
        descriptionMd: spec.descriptionMd ?? spec.short, coverColor: spec.color, introVideoUrl: spec.key === 'fmm' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : null,
        status: spec.status ?? 'published', accessMode: spec.accessMode, priceMinor: spec.price ?? null, compareAtMinor: spec.compareAt ?? null,
        lessonCount: total, totalDurationSeconds: duration, sortOrder: spec.sortOrder, publishedAt: spec.status === 'draft' ? null : daysFrom(base, -100),
        createdAt: daysFrom(base, -120),
      })
      .onConflictDoNothing();
    lessonIds[spec.key] = [];
    for (const [mi, mod] of spec.modules.entries()) {
      const moduleId = await sid(`module:${spec.key}:${mi}`);
      await db.insert(courseModules).values({ id: moduleId, courseId, title: mod.title, sortOrder: mi }).onConflictDoNothing();
      for (const [li, [title, dur]] of mod.lessons.entries()) {
        const lessonId = await sid(`lesson:${spec.key}:${mi}:${li}`);
        lessonIds[spec.key]!.push(lessonId);
        const isTask = dur === null;
        const ytId = `vid${spec.key}${mi}${li}`.padEnd(11, 'x').slice(0, 11);
        await db
          .insert(lessons)
          .values({
            id: lessonId, courseId, moduleId, title: `${mi + 1}.${li + 1} ${title}`, kind: isTask ? 'task' : 'video',
            videoProvider: isTask ? null : 'youtube', videoExternalId: isTask ? null : ytId, videoUrl: isTask ? null : `https://www.youtube.com/watch?v=${ytId}`,
            contentMd: isTask ? 'Hoàn thành bài tập rồi đăng lên Hỏi đáp để được góp ý.' : `Kết quả mơ ước × xác suất đạt được, chia cho thời gian và công sức. Bài này đi qua từng vế với ví dụ của một người bán khóa học AI cho chủ shop nhỏ.\n\n## Prompt mẫu\n\nTải ở phần tài liệu bên dưới.`,
            isPreview: mi === 0, durationSeconds: dur, sortOrder: li,
          })
          .onConflictDoNothing();
      }
    }
  }
  const fmmLessons = lessonIds.fmm!;
  const l23 = fmmLessons[7]!;
  await db
    .insert(lessonResources)
    .values([
      { id: await sid('res:fmm:1'), lessonId: l23, name: 'Offer Canvas.pdf', url: 'seed://file/offer-canvas.pdf', sizeBytes: 240_000, sortOrder: 0 },
      { id: await sid('res:fmm:2'), lessonId: l23, name: 'Prompt AI viết offer.txt', url: 'seed://file/prompt-offer.txt', sizeBytes: 4_000, sortOrder: 1 },
    ])
    .onConflictDoNothing();

  // Tiến độ: Minh Quý 7/26 (27%) đang ở 2.3; Hoàng Vũ hoàn thành FMM và FB Ads; Kiên Bùi xong module 1 (miễn phí); Điền 12%.
  await progress(db, base, U.minhquy!.id, courseIds.fmm!, fmmLessons, 7);
  await progress(db, base, U.hoangvu!.id, courseIds.fmm!, fmmLessons, fmmLessons.length);
  await progress(db, base, U.hoangvu!.id, courseIds.fbads!, lessonIds.fbads!, lessonIds.fbads!.length);
  await progress(db, base, U.hoangvu!.id, courseIds.aiagent!, lessonIds.aiagent!, 14);
  await progress(db, base, U.hoangvu!.id, courseIds.affiliate!, lessonIds.affiliate!, lessonIds.affiliate!.length);
  await progress(db, base, U.kienbui!.id, courseIds.fmm!, fmmLessons, 5);
  await progress(db, base, U.dien!.id, courseIds.fmm!, fmmLessons, 3);
  await progress(db, base, U.minhquy!.id, courseIds.fbads!, lessonIds.fbads!, lessonIds.fbads!.length);
  await progress(db, base, U.minhquy!.id, courseIds.aiagent!, lessonIds.aiagent!, 2);
  for (const k of ['hongkim', 'duy', 'cong', 'thulan']) await progress(db, base, U[k]!.id, courseIds.fmm!, fmmLessons, 1 + (k.length % 4));
  return { courseIds, lessonIds };
}

async function progress(db: Database, base: Date, userId: string, courseId: string, ids: string[], done: number): Promise<void> {
  for (let i = 0; i < done; i++) {
    await db.insert(lessonProgress).values({ id: await sid(`lp:${userId}:${ids[i]}`), lessonId: ids[i]!, courseId, userId, completed: true, completedAt: daysFrom(base, -(done - i)), watchedSeconds: 600 }).onConflictDoNothing();
  }
  const pct = Math.round((done / ids.length) * 100);
  await db
    .insert(courseProgress)
    .values({ id: await sid(`cp:${userId}:${courseId}`), courseId, userId, completedLessons: done, totalLessons: ids.length, percent: pct, lastLessonId: ids[Math.min(done, ids.length - 1)] ?? null, lastAccessedAt: daysFrom(base, -1, 22), completedAt: pct === 100 ? daysFrom(base, -5) : null, startedAt: daysFrom(base, -done - 3) })
    .onConflictDoNothing();
  await db.insert(courseEnrollments).values({ id: await sid(`enr:${userId}:${courseId}`), courseId, userId, status: pct === 100 ? 'completed' : 'active', completedAt: pct === 100 ? daysFrom(base, -5) : null }).onConflictDoNothing();
}
