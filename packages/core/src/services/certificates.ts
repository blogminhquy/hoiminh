// Chứng nhận hoàn thành khóa học (V1.5): cấp một lần khi học xong 100%, có mã tra cứu công khai.
import { randomCode } from '@hoiminh/config';
import { and, desc, eq } from 'drizzle-orm';
import { certificates, communities, courseProgress, courses, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { notFound } from '../errors';
import { requireUser } from '../permissions';

/** Mã in trên chứng nhận, ví dụ HM-CN-A3F9K. Bỏ ký tự dễ nhầm (randomCode của config đã lo). */
function newCertificateCode(): string {
  return `HM-CN-${randomCode(5)}`;
}

/** Dữ liệu một tờ chứng nhận, đủ để dựng mẫu và để tra cứu. */
export interface CertificateView {
  code: string;
  recipientName: string;
  courseTitle: string;
  issuerName: string;
  lessonCount: number;
  issuedAt: Date;
  revokedAt: Date | null;
  communitySlug: string | null;
  courseId: string;
}

/**
 * Cấp chứng nhận cho người học đã hoàn thành khóa. Idempotent: gọi lại trả về đúng tờ cũ.
 * Trả về null khi khóa tắt chứng nhận hoặc người học chưa xong 100%.
 */
export async function issueCertificate(ctx: Ctx, courseId: string, userId: string): Promise<CertificateView | null> {
  const existing = await ctx.db.query.certificates.findFirst({ where: and(eq(certificates.courseId, courseId), eq(certificates.userId, userId)) });
  if (existing) return toView(existing, await slugOf(ctx, existing.communityId));

  const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course || !course.certificateEnabled) return null;
  const progress = await ctx.db.query.courseProgress.findFirst({ where: and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)) });
  if (!progress || progress.percent < 100) return null;
  const learner = await ctx.db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true } });
  if (!learner) return null;
  const community = course.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, course.communityId), columns: { name: true, slug: true } }) : null;

  const [row] = await ctx.db
    .insert(certificates)
    .values({
      code: newCertificateCode(),
      courseId,
      userId,
      communityId: course.communityId,
      workspaceId: course.workspaceId,
      recipientName: learner.name,
      courseTitle: course.title,
      issuerName: community?.name ?? 'Hội Mình',
      lessonCount: course.lessonCount,
      issuedAt: ctx.now(),
    })
    .onConflictDoNothing()
    .returning();
  // Hai lần hoàn thành gần nhau có thể chạy song song; ai thua thì đọc lại tờ của người thắng.
  const saved = row ?? (await ctx.db.query.certificates.findFirst({ where: and(eq(certificates.courseId, courseId), eq(certificates.userId, userId)) }));
  if (!saved) return null;
  return toView(saved, community?.slug ?? null);
}

/** Chứng nhận của tôi cho một khóa, null nếu chưa có. */
export async function myCertificate(ctx: Ctx, courseId: string): Promise<CertificateView | null> {
  const userId = requireUser(ctx);
  const row = await ctx.db.query.certificates.findFirst({ where: and(eq(certificates.courseId, courseId), eq(certificates.userId, userId)) });
  if (row) return toView(row, await slugOf(ctx, row.communityId));
  // Học xong rồi mà chưa có tờ nào (khóa vừa bật chứng nhận, hoặc cấp hụt) thì cấp ngay tại đây.
  return issueCertificate(ctx, courseId, userId);
}

/** Tất cả chứng nhận của tôi, mới nhất trước. */
export async function listMyCertificates(ctx: Ctx): Promise<CertificateView[]> {
  const userId = requireUser(ctx);
  const rows = await ctx.db.query.certificates.findMany({ where: eq(certificates.userId, userId), orderBy: desc(certificates.issuedAt) });
  return Promise.all(rows.map(async (r) => toView(r, await slugOf(ctx, r.communityId))));
}

/** Tra cứu công khai theo mã in trên chứng nhận. Không cần đăng nhập. */
export async function verifyCertificate(ctx: Ctx, code: string): Promise<CertificateView> {
  const row = await ctx.db.query.certificates.findFirst({ where: eq(certificates.code, code.trim().toUpperCase()) });
  if (!row) throw notFound('Không tìm thấy chứng nhận với mã này');
  return toView(row, await slugOf(ctx, row.communityId));
}

async function slugOf(ctx: Ctx, communityId: string | null): Promise<string | null> {
  if (!communityId) return null;
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { slug: true } });
  return c?.slug ?? null;
}

function toView(row: typeof certificates.$inferSelect, communitySlug: string | null): CertificateView {
  return {
    code: row.code,
    recipientName: row.recipientName,
    courseTitle: row.courseTitle,
    issuerName: row.issuerName,
    lessonCount: row.lessonCount,
    issuedAt: row.issuedAt,
    revokedAt: row.revokedAt,
    communitySlug,
    courseId: row.courseId,
  };
}
