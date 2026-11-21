// Khóa học: thư viện, chi tiết, tạo/sửa/đăng, module và bài học, nhúng video, tài liệu.
import { sha256Hex } from '@hoiminh/config';
import { parseLessonVideoUrl, toSlug, type CreateCourseInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { comments, communities, courseModules, courseProgress, courses, files, lessonProgress, lessonResources, lessons, products, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, invalid, notFound } from '../errors';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { canAccessCourse, resolveCourseAccess } from './entitlements';
import { releaseFiles } from './files';
import { assertCommunityHasPlan } from './plans';

/** Thư viện khóa học của hội: thẻ có % tiến độ, nhãn Nháp/khóa, khối "Học tiếp". */
export async function listCourses(ctx: Ctx, communityId: string) {
  const access = await resolveCommunityAccess(ctx, communityId);
  // Hội mở: người ngoài thấy danh sách khóa học, còn từng khóa vẫn khóa theo quyền (resolveCourseAccess trả 'not_member').
  if (!access.canView && !access.permissions.has('course.read') && !access.permissions.has('course.manage')) throw forbidden('Tham gia hội để xem khóa học');
  const staff = access.permissions.has('course.manage');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const conds = [eq(courses.communityId, communityId), isNull(courses.deletedAt)];
  if (!staff) conds.push(eq(courses.status, 'published'));
  const rows = await ctx.db.query.courses.findMany({ where: and(...conds), orderBy: [asc(courses.sortOrder), desc(courses.createdAt)] });
  const progress = userId && rows.length ? await ctx.db.query.courseProgress.findMany({ where: and(eq(courseProgress.userId, userId), inArray(courseProgress.courseId, rows.map((c) => c.id))) }) : [];
  // Quyền của cả danh sách trong một lượt, thay vì hỏi database riêng cho từng khóa.
  const decisions = await resolveCourseAccess(ctx, userId, rows.filter((c) => c.status !== 'draft'), { isStaff: staff });
  const items = [];
  for (const c of rows) {
    const p = progress.find((x) => x.courseId === c.id);
    const decision = c.status === 'draft' ? { allowed: staff, reason: 'locked' as const } : decisions.get(c.id)!;
    items.push({ ...c, percent: p?.percent ?? 0, completedLessons: p?.completedLessons ?? 0, lastLessonId: p?.lastLessonId ?? null, lastAccessedAt: p?.lastAccessedAt ?? null, locked: !decision.allowed, lockReason: decision.reason, completed: p?.percent === 100 });
  }
  const continueItem = items.filter((i) => i.percent > 0 && i.percent < 100 && i.lastAccessedAt).sort((a, b) => (b.lastAccessedAt?.getTime() ?? 0) - (a.lastAccessedAt?.getTime() ?? 0))[0] ?? null;
  const continueLesson = continueItem?.lastLessonId ? await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, continueItem.lastLessonId) }) : null;
  return { items, continue: continueItem && continueLesson ? { course: continueItem, lesson: continueLesson } : null, canManage: staff };
}

/** Chi tiết khóa học: module/bài với trạng thái từng bài, tiến độ, tài liệu, thảo luận gần đây. */
export async function getCourse(ctx: Ctx, courseId: string) {
  const c = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, courseId), isNull(courses.deletedAt)) });
  if (!c) throw notFound('Khóa học không tồn tại');
  const access = c.communityId ? await resolveCommunityAccess(ctx, c.communityId) : null;
  const staff = access?.permissions.has('course.manage') ?? false;
  if (c.status === 'draft' && !staff) throw notFound('Khóa học không tồn tại');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const decision = await canAccessCourse(ctx, userId, courseId, { isStaff: staff, course: c });
  const [modules, lessonRows, progress, doneRows, owner, discussions, productRow] = await Promise.all([
    ctx.db.query.courseModules.findMany({ where: eq(courseModules.courseId, courseId), orderBy: asc(courseModules.sortOrder) }),
    ctx.db.query.lessons.findMany({ where: eq(lessons.courseId, courseId), orderBy: [asc(lessons.sortOrder)] }),
    userId ? ctx.db.query.courseProgress.findFirst({ where: and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)) }) : null,
    userId ? ctx.db.query.lessonProgress.findMany({ where: and(eq(lessonProgress.courseId, courseId), eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)), columns: { lessonId: true } }) : [],
    ctx.db.query.users.findFirst({ where: eq(users.id, c.ownerUserId), columns: { id: true, name: true, handle: true, avatarUrl: true, coverColor: true, bio: true } }),
    ctx.db.select({ c: comments, author: { name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, lesson: { title: lessons.title, id: lessons.id } }).from(comments).innerJoin(users, eq(users.id, comments.authorUserId)).innerJoin(lessons, eq(lessons.id, comments.targetId)).where(and(eq(comments.targetType, 'lesson'), eq(lessons.courseId, courseId), isNull(comments.deletedAt))).orderBy(desc(comments.createdAt)).limit(5),
    ctx.db.query.products.findFirst({ where: and(eq(products.courseId, courseId), isNull(products.deletedAt), eq(products.status, 'published')) }),
  ]);
  // Slug hội để Khu học tập (/hoc) dựng được link mua/xem hội mà không cần khung hội.
  const communitySlug = c.communityId ? (await ctx.db.query.communities.findFirst({ where: eq(communities.id, c.communityId), columns: { slug: true } }))?.slug ?? null : null;
  const done = new Set(doneRows.map((d) => d.lessonId));
  const resources = lessonRows.length ? await ctx.db.query.lessonResources.findMany({ where: inArray(lessonResources.lessonId, lessonRows.map((l) => l.id)), orderBy: asc(lessonResources.sortOrder) }) : [];
  const firstModuleId = modules[0]?.id;
  // Khóa theo thứ tự: khóa bật "Bắt buộc học theo thứ tự" thì bài sau chỉ mở khi mọi bài trước
  // đã hoàn thành; một bài bật "Phải hoàn thành" thì riêng bài kế tiếp chờ nó. Người quản lý
  // khóa không bị chặn. Hai cờ này trước đây chỉ được lưu, không nơi nào đọc.
  let allPrevDone = true;
  let prevRequires = false;
  const tree = modules.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id).map((l) => {
    const sequentialLocked = !staff && ((c.sequential && !allPrevDone) || (prevRequires && !allPrevDone));
    const isDone = done.has(l.id);
    // Cờ "phải hoàn thành" chỉ giữ bài kế tiếp; hết bài đó thì xét lại theo bài mới.
    prevRequires = l.requireComplete && !isDone;
    if (!isDone) allPrevDone = false;
    const previewable = l.isPreview || (c.previewFirstModule && m.id === firstModuleId);
    return { id: l.id, title: l.title, kind: l.kind, durationSeconds: l.durationSeconds, isPreview: previewable, done: isDone, locked: !(decision.allowed || previewable) || sequentialLocked, sequentialLocked, current: progress?.lastLessonId === l.id };
  }) }));
  const [learners] = await ctx.db.select({ c: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where percent = 100)::int` }).from(courseProgress).where(eq(courseProgress.courseId, courseId));
  return { ...c, communitySlug, owner, modules: tree, progress: progress ?? null, access: decision, canManage: staff, resources: resources.map((r) => ({ id: r.id, fileId: r.fileId, name: r.name, url: r.url, lessonId: r.lessonId, sizeBytes: r.sizeBytes })), discussions: discussions.map((d) => ({ ...d.c, author: d.author, lesson: d.lesson })), learners: { total: learners?.c ?? 0, completed: learners?.done ?? 0 }, product: productRow ? { id: productRow.id, priceMinor: productRow.priceMinor, compareAtMinor: productRow.compareAtMinor, slug: productRow.slug } : null };
}

/**
 * Chứng nhận hoàn thành: công khai để ai có link cũng kiểm tra được. Chỉ tồn tại khi khóa bật
 * certificateEnabled và người học đã đạt 100%; dữ liệu đọc thẳng từ course_progress nên không
 * làm giả được bằng cách sửa link.
 */
export async function certificate(ctx: Ctx, courseId: string, userId: string) {
  const c = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, courseId), isNull(courses.deletedAt)) });
  if (!c || !c.certificateEnabled || c.status !== 'published') throw notFound('Khóa học này không cấp chứng nhận');
  const progress = await ctx.db.query.courseProgress.findFirst({ where: and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)) });
  if (!progress || progress.percent < 100 || !progress.completedAt) throw notFound('Người học chưa hoàn thành khóa này');
  const [learner, owner, community] = await Promise.all([
    ctx.db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true, handle: true } }),
    ctx.db.query.users.findFirst({ where: eq(users.id, c.ownerUserId), columns: { name: true } }),
    c.communityId ? ctx.db.query.communities.findFirst({ where: eq(communities.id, c.communityId), columns: { name: true, slug: true, logoMark: true, logoColor: true, logoUrl: true } }) : null,
  ]);
  if (!learner) throw notFound();
  const code = (await sha256Hex(`certificate:${courseId}:${userId}`)).slice(0, 12).toUpperCase();
  return { code, learner, course: { id: c.id, title: c.title, lessonCount: c.lessonCount, totalDurationSeconds: c.totalDurationSeconds }, owner: owner?.name ?? null, community, completedAt: progress.completedAt, verifyUrl: `${ctx.env.APP_URL}/chung-nhan/${courseId}/${userId}` };
}

/** Bài học: video nhúng, nội dung, tài liệu (signed URL nếu riêng), bài trước/sau, khóa nếu chưa có quyền. */
export async function getLesson(ctx: Ctx, lessonId: string) {
  const l = await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw notFound('Bài học không tồn tại');
  const course = await getCourse(ctx, l.courseId);
  const flat = course.modules.flatMap((m) => m.lessons);
  const idx = flat.findIndex((x) => x.id === lessonId);
  const entry = flat[idx];
  const locked = entry?.locked ?? true;
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  if (!locked && userId) {
    await ctx.db.insert(courseProgress).values({ courseId: l.courseId, userId, totalLessons: course.lessonCount, lastLessonId: lessonId, lastAccessedAt: ctx.now() }).onConflictDoUpdate({ target: [courseProgress.courseId, courseProgress.userId], set: { lastLessonId: lessonId, lastAccessedAt: ctx.now() } });
  }
  const resources = locked ? [] : await Promise.all(course.resources.filter((r) => r.lessonId === lessonId).map(async (r) => ({ ...r, url: r.url.startsWith('seed://') || r.url.startsWith('http') ? r.url : await ctx.media.getSignedUrl(r.url, 3600) })));
  const embed = l.videoUrl ? parseLessonVideoUrl(l.videoUrl) : null;
  // Tệp Google Drive: người học chỉ nhận địa chỉ khung xem trước, không nhận link chia sẻ gốc hay id tệp ở dạng trường riêng.
  // Người quản lý khóa vẫn nhận đủ để sửa bài. (Địa chỉ khung vẫn chứa id tệp vì trình duyệt phải tải thẳng từ Google.)
  const hideSource = embed?.provider === 'gdrive' && !course.canManage;
  // Nhỏ giọt chỉ có tác dụng khi khóa bật dripEnabled; trước đây dripDays của bài tự khóa dù công tắc khóa đang tắt.
  const drip = course.dripEnabled && course.progress?.startedAt && l.dripDays > 0 ? new Date(course.progress.startedAt.getTime() + l.dripDays * 86_400_000) : null;
  const dripLocked = Boolean(drip && drip > ctx.now() && !course.canManage);
  const sequentialLocked = entry?.sequentialLocked ?? false;
  return { lesson: locked ? { ...l, contentMd: l.contentMd.slice(0, 200), videoUrl: null, videoExternalId: null } : hideSource ? { ...l, videoUrl: null, videoExternalId: null } : l, embed: locked ? null : hideSource && embed ? { ...embed, externalId: '', originalUrl: '' } : embed, locked, sequentialLocked, dripLocked, dripUnlocksAt: dripLocked ? drip : null, lockReason: sequentialLocked ? 'sequential' : course.access.reason, course: { id: course.id, title: course.title, lessonCount: course.lessonCount, communityId: course.communityId, communitySlug: course.communitySlug ?? null, modules: course.modules, progress: course.progress, previewFirstModule: course.previewFirstModule, accessMode: course.accessMode, product: course.product, coverColor: course.coverColor }, prev: flat[idx - 1] ?? null, next: flat[idx + 1] ?? null, resources, done: entry?.done ?? false };
}

/** Đánh dấu hoàn thành bài, cập nhật course_progress, phát lesson.completed / course.completed. */
export async function completeLesson(ctx: Ctx, lessonId: string) {
  const userId = requireUser(ctx);
  const l = await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw notFound();
  const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, l.courseId) });
  if (!course) throw notFound();
  const access = course.communityId ? await resolveCommunityAccess(ctx, course.communityId) : null;
  const decision = await canAccessCourse(ctx, userId, l.courseId, { isStaff: access?.permissions.has('course.manage'), lessonIsPreview: l.isPreview, course });
  if (!decision.allowed) throw forbidden('Bài này chưa mở với bạn');
  await ctx.db.insert(lessonProgress).values({ lessonId, courseId: l.courseId, userId, completed: true, completedAt: ctx.now() }).onConflictDoUpdate({ target: [lessonProgress.lessonId, lessonProgress.userId], set: { completed: true, completedAt: ctx.now(), updatedAt: ctx.now() } });
  const [agg] = await ctx.db.select({ done: sql<number>`count(*)::int` }).from(lessonProgress).where(and(eq(lessonProgress.courseId, l.courseId), eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)));
  const done = agg?.done ?? 0;
  const total = course.lessonCount || 1;
  const percent = Math.min(100, Math.round(((done ?? 0) / total) * 100));
  const nextLesson = await ctx.db.query.lessons.findFirst({ where: and(eq(lessons.courseId, l.courseId), sql`(${lessons.sortOrder} > ${l.sortOrder} and ${lessons.moduleId} = ${l.moduleId})`), orderBy: asc(lessons.sortOrder) });
  await ctx.db.insert(courseProgress).values({ courseId: l.courseId, userId, completedLessons: done ?? 0, totalLessons: total, percent, lastLessonId: nextLesson?.id ?? lessonId, lastAccessedAt: ctx.now(), completedAt: percent === 100 ? ctx.now() : null }).onConflictDoUpdate({ target: [courseProgress.courseId, courseProgress.userId], set: { completedLessons: done ?? 0, totalLessons: total, percent, lastLessonId: nextLesson?.id ?? lessonId, lastAccessedAt: ctx.now(), completedAt: percent === 100 ? ctx.now() : null } });
  await ctx.events.emit('lesson.completed', { userId, lessonId, courseId: l.courseId, communityId: course.communityId, percent });
  if (percent === 100) await ctx.events.emit('course.completed', { userId, courseId: l.courseId, communityId: course.communityId });
  return { percent, completedLessons: done ?? 0, totalLessons: total, nextLessonId: nextLesson?.id ?? null };
}

/** Tạo khóa học nháp. */
export async function createCourse(ctx: Ctx, communityId: string, input: CreateCourseInput) {
  const userId = requireUser(ctx);
  const access = await requireCommunityPermission(ctx, communityId, 'course.manage');
  await assertCommunityHasPlan(ctx, communityId);
  const cover = input.coverFileId ? await ctx.db.query.files.findFirst({ where: eq(files.id, input.coverFileId) }) : null;
  const [c] = await ctx.db.insert(courses).values({ workspaceId: access.workspaceId, communityId, ownerUserId: userId, title: input.title, slug: `${toSlug(input.title)}-${Date.now().toString(36).slice(-4)}`, shortDescription: input.shortDescription, descriptionMd: input.descriptionMd, coverUrl: cover?.url ?? null, coverColor: input.coverColor ?? '#D4593A', introVideoUrl: input.introVideoUrl ?? null, accessMode: input.accessMode, priceMinor: input.priceMinor ?? null, compareAtMinor: input.compareAtMinor ?? null, previewFirstModule: input.previewFirstModule, affiliateEnabled: input.affiliateEnabled, dripEnabled: input.dripEnabled, certificateEnabled: input.certificateEnabled, sequential: input.sequential, hiddenFromStore: input.hiddenFromStore, status: 'draft' }).returning();
  await audit(ctx, { action: 'course.create', resourceType: 'course', resourceId: c!.id, communityId });
  return c!;
}

/** Sửa khóa học; status → published thì kiểm tra có ≥1 bài và tạo sản phẩm cửa hàng nếu bán lẻ. */
export async function updateCourse(ctx: Ctx, courseId: string, input: Partial<CreateCourseInput> & { status?: 'draft' | 'published' | 'archived' }) {
  const c = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, courseId), isNull(courses.deletedAt)) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  if (input.status === 'published' && c.lessonCount === 0) throw invalid('Cần ít nhất 1 module và 1 bài trước khi đăng');
  const cover = input.coverFileId ? await ctx.db.query.files.findFirst({ where: eq(files.id, input.coverFileId) }) : null;
  const patch: Partial<typeof courses.$inferInsert> = { updatedAt: ctx.now() };
  for (const k of ['title', 'shortDescription', 'descriptionMd', 'coverColor', 'introVideoUrl', 'accessMode', 'priceMinor', 'compareAtMinor', 'previewFirstModule', 'affiliateEnabled', 'dripEnabled', 'certificateEnabled', 'sequential', 'hiddenFromStore', 'status'] as const) if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  if (cover) patch.coverUrl = cover.url;
  if (input.status === 'published' && !c.publishedAt) patch.publishedAt = ctx.now();
  const [row] = await ctx.db.update(courses).set(patch).where(eq(courses.id, courseId)).returning();
  const sells = row!.accessMode === 'store_only' || row!.accessMode === 'premium_and_store';
  if (row!.status === 'published' && sells && row!.priceMinor) {
    const existing = await ctx.db.query.products.findFirst({ where: and(eq(products.courseId, courseId), isNull(products.deletedAt)) });
    if (existing) await ctx.db.update(products).set({ name: row!.title, shortDescription: row!.shortDescription, priceMinor: row!.priceMinor, compareAtMinor: row!.compareAtMinor, coverColor: row!.coverColor, coverUrl: row!.coverUrl, status: row!.hiddenFromStore ? 'draft' : 'published', updatedAt: ctx.now() }).where(eq(products.id, existing.id));
    else {
      const { createProduct } = await import('./store');
      await createProduct(ctx, c.communityId, { kind: 'course', name: row!.title, shortDescription: row!.shortDescription, coverColor: row!.coverColor, priceMinor: row!.priceMinor, compareAtMinor: row!.compareAtMinor, currency: 'VND', courseId, bundleItemProductIds: [], digitalFileIds: [], page: { headline: row!.title, subheadline: row!.shortDescription, benefits: [], faq: [], ctaText: 'Mua ngay', guarantee: 'Hoàn tiền trong 7 ngày nếu bạn xem chưa quá 20% nội dung.', salesMode: 'native' }, status: row!.hiddenFromStore ? 'draft' : 'published' });
    }
  }
  // Đổi ảnh bìa (kể cả bản sao ở sản phẩm cửa hàng, đã cập nhật ở trên) thì tệp cũ trên R2 không còn ai dùng.
  if (cover && c.coverUrl && c.coverUrl !== cover.url) await releaseFiles(ctx, { urls: [c.coverUrl] }, { ownerUserIds: [c.ownerUserId], communityId: c.communityId });
  await audit(ctx, { action: input.status ? `course.${input.status}` : 'course.update', resourceType: 'course', resourceId: courseId, communityId: c.communityId });
  return row!;
}

/** Module: thêm, sửa tên, xóa. */
export async function upsertModule(ctx: Ctx, courseId: string, input: { id?: string; title: string; sortOrder?: number }) {
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  if (input.id) {
    const [row] = await ctx.db.update(courseModules).set({ title: input.title, sortOrder: input.sortOrder ?? undefined, updatedAt: ctx.now() }).where(and(eq(courseModules.id, input.id), eq(courseModules.courseId, courseId))).returning();
    return row!;
  }
  const [cnt] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(courseModules).where(eq(courseModules.courseId, courseId));
  const [row] = await ctx.db.insert(courseModules).values({ courseId, title: input.title, sortOrder: input.sortOrder ?? cnt?.n ?? 0 }).returning();
  return row!;
}
export async function deleteModule(ctx: Ctx, moduleId: string) {
  const m = await ctx.db.query.courseModules.findFirst({ where: eq(courseModules.id, moduleId) });
  if (!m) throw notFound();
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, m.courseId) });
  await requireCommunityPermission(ctx, c!.communityId!, 'course.manage');
  await ctx.db.delete(courseModules).where(eq(courseModules.id, moduleId));
  await recountCourse(ctx, m.courseId);
}

/** Bài học: tạo/sửa; dán link video tự nhận diện provider; tài liệu từ files. */
export async function upsertLesson(ctx: Ctx, courseId: string, input: { id?: string; moduleId?: string; title?: string; kind?: 'video' | 'text' | 'task' | 'file'; videoUrl?: string | null; contentMd?: string; isPreview?: boolean; dripDays?: number; requireComplete?: boolean; durationSeconds?: number | null; sortOrder?: number; resourceFileIds?: string[] }) {
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  let video: { provider: string | null; id: string | null; url: string | null } = { provider: null, id: null, url: null };
  if (input.videoUrl) {
    const e = parseLessonVideoUrl(input.videoUrl);
    if (!e) throw invalid('Link video không nhận diện được. Hỗ trợ YouTube, Google Drive (link tệp), TikTok, Facebook, Loom, Vimeo, Bunny.');
    video = { provider: e.provider, id: e.externalId, url: input.videoUrl };
  }
  let row: typeof lessons.$inferSelect;
  if (input.id) {
    const patch: Partial<typeof lessons.$inferInsert> = { updatedAt: ctx.now() };
    for (const k of ['moduleId', 'title', 'kind', 'contentMd', 'isPreview', 'dripDays', 'requireComplete', 'durationSeconds', 'sortOrder'] as const) if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
    if (input.videoUrl !== undefined) Object.assign(patch, { videoProvider: video.provider, videoExternalId: video.id, videoUrl: video.url });
    [row] = (await ctx.db.update(lessons).set(patch).where(and(eq(lessons.id, input.id), eq(lessons.courseId, courseId))).returning()) as [typeof lessons.$inferSelect];
  } else {
    if (!input.moduleId || !input.title) throw invalid('Cần module và tên bài');
    const [cnt] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(lessons).where(eq(lessons.moduleId, input.moduleId));
    [row] = (await ctx.db.insert(lessons).values({ courseId, moduleId: input.moduleId, title: input.title, kind: input.kind ?? 'video', videoProvider: video.provider, videoExternalId: video.id, videoUrl: video.url, contentMd: input.contentMd ?? '', isPreview: input.isPreview ?? false, dripDays: input.dripDays ?? 0, requireComplete: input.requireComplete ?? false, durationSeconds: input.durationSeconds ?? null, sortOrder: input.sortOrder ?? cnt?.n ?? 0 }).returning()) as [typeof lessons.$inferSelect];
  }
  if (input.resourceFileIds) {
    await ctx.db.delete(lessonResources).where(eq(lessonResources.lessonId, row.id));
    const fileRows = input.resourceFileIds.length ? await ctx.db.query.files.findMany({ where: inArray(files.id, input.resourceFileIds) }) : [];
    if (fileRows.length) await ctx.db.insert(lessonResources).values(fileRows.map((f, i) => ({ lessonId: row.id, fileId: f.id, name: f.originalName, url: f.visibility === 'private' ? f.objectKey : (f.url ?? f.objectKey), sizeBytes: f.sizeBytes, sortOrder: i })));
  }
  await recountCourse(ctx, courseId);
  return row;
}
export async function deleteLesson(ctx: Ctx, lessonId: string) {
  const l = await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw notFound();
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, l.courseId) });
  await requireCommunityPermission(ctx, c!.communityId!, 'course.manage');
  await ctx.db.delete(lessons).where(eq(lessons.id, lessonId));
  await recountCourse(ctx, l.courseId);
}

/** Sắp xếp lại module và bài (kéo thả). */
export async function reorder(ctx: Ctx, courseId: string, modules: Array<{ id: string; sortOrder: number; lessonIds: string[] }>) {
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  await ctx.db.transaction(async (tx) => {
    for (const m of modules) {
      await tx.update(courseModules).set({ sortOrder: m.sortOrder }).where(and(eq(courseModules.id, m.id), eq(courseModules.courseId, courseId)));
      for (const [i, lid] of m.lessonIds.entries()) await tx.update(lessons).set({ moduleId: m.id, sortOrder: i }).where(and(eq(lessons.id, lid), eq(lessons.courseId, courseId)));
    }
  });
}

/**
 * Thứ tự thẻ khóa học trong thư viện của hội (menu ba chấm trên thẻ: Chuyển lên trước, Chuyển ra sau).
 * Nhận danh sách id theo thứ tự mới; khóa của hội không có trong danh sách giữ thứ tự cũ và xếp sau.
 * Không đổi updated_at, để dòng "cập nhật ..." trên thẻ vẫn nói về nội dung khóa.
 */
export async function reorderCourses(ctx: Ctx, communityId: string, courseIds: string[]) {
  await requireCommunityPermission(ctx, communityId, 'course.manage');
  const rows = await ctx.db.query.courses.findMany({ where: and(eq(courses.communityId, communityId), isNull(courses.deletedAt)), columns: { id: true }, orderBy: [asc(courses.sortOrder), desc(courses.createdAt)] });
  const known = new Set(rows.map((r) => r.id));
  const wanted = [...new Set(courseIds)];
  if (wanted.some((id) => !known.has(id))) throw invalid('Có khóa học không thuộc hội này');
  const picked = new Set(wanted);
  const order = [...wanted, ...rows.map((r) => r.id).filter((id) => !picked.has(id))];
  await ctx.db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(courses).set({ sortOrder: i }).where(eq(courses.id, id));
  });
  await audit(ctx, { action: 'course.reorder', resourceType: 'community', resourceId: communityId, communityId });
}

/**
 * Nhân bản khóa học: bản sao là nháp, tên thêm "(bản sao)", đủ thông tin, cài đặt, chương, bài và tài liệu đính kèm.
 * Không chép tiến độ học viên, bình luận hay sản phẩm cửa hàng (sản phẩm được tạo khi đăng bản sao).
 * Ảnh bìa và tệp tài liệu dùng chung với khóa gốc; việc dọn tệp chỉ xóa khi không còn khóa nào trỏ tới.
 */
export async function duplicateCourse(ctx: Ctx, courseId: string) {
  requireUser(ctx);
  const src = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, courseId), isNull(courses.deletedAt)) });
  if (!src || !src.communityId) throw notFound('Khóa học không tồn tại');
  const communityId = src.communityId;
  await requireCommunityPermission(ctx, communityId, 'course.manage');
  await assertCommunityHasPlan(ctx, communityId);
  const [moduleRows, lessonRows] = await Promise.all([
    ctx.db.query.courseModules.findMany({ where: eq(courseModules.courseId, courseId), orderBy: asc(courseModules.sortOrder) }),
    ctx.db.query.lessons.findMany({ where: eq(lessons.courseId, courseId), orderBy: asc(lessons.sortOrder) }),
  ]);
  const resourceRows = lessonRows.length ? await ctx.db.query.lessonResources.findMany({ where: inArray(lessonResources.lessonId, lessonRows.map((l) => l.id)) }) : [];
  const siblings = await ctx.db.query.courses.findMany({ where: and(eq(courses.communityId, communityId), isNull(courses.deletedAt)), columns: { id: true }, orderBy: [asc(courses.sortOrder), desc(courses.createdAt)] });
  const suffix = ' (bản sao)';
  const title = `${src.title.slice(0, 80 - suffix.length).trimEnd()}${suffix}`;
  const moduleIds = new Map(moduleRows.map((m) => [m.id, crypto.randomUUID()]));
  const lessonIds = new Map(lessonRows.map((l) => [l.id, crypto.randomUUID()]));
  const copy = await ctx.db.transaction(async (tx) => {
    const [row] = await tx.insert(courses).values({
      workspaceId: src.workspaceId, communityId, ownerUserId: src.ownerUserId, title, slug: `${toSlug(title)}-${Date.now().toString(36).slice(-4)}`,
      shortDescription: src.shortDescription, descriptionMd: src.descriptionMd, coverUrl: src.coverUrl, coverColor: src.coverColor, introVideoUrl: src.introVideoUrl,
      status: 'draft', accessMode: src.accessMode, priceMinor: src.priceMinor, compareAtMinor: src.compareAtMinor, previewFirstModule: src.previewFirstModule,
      affiliateEnabled: src.affiliateEnabled, dripEnabled: src.dripEnabled, certificateEnabled: src.certificateEnabled, sequential: src.sequential, hiddenFromStore: src.hiddenFromStore,
      lessonCount: lessonRows.length, totalDurationSeconds: lessonRows.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0),
    }).returning();
    const newId = row!.id;
    if (moduleRows.length) await tx.insert(courseModules).values(moduleRows.map((m) => ({ id: moduleIds.get(m.id)!, courseId: newId, title: m.title, sortOrder: m.sortOrder })));
    // Chèn theo lô 100 bài để khóa vài trăm bài không vượt giới hạn tham số của một câu lệnh.
    for (let i = 0; i < lessonRows.length; i += 100) {
      await tx.insert(lessons).values(lessonRows.slice(i, i + 100).map((l) => ({ id: lessonIds.get(l.id)!, courseId: newId, moduleId: moduleIds.get(l.moduleId)!, title: l.title, kind: l.kind, videoProvider: l.videoProvider, videoExternalId: l.videoExternalId, videoUrl: l.videoUrl, contentMd: l.contentMd, isPreview: l.isPreview, dripDays: l.dripDays, requireComplete: l.requireComplete, durationSeconds: l.durationSeconds, sortOrder: l.sortOrder, status: l.status })));
    }
    if (resourceRows.length) await tx.insert(lessonResources).values(resourceRows.map((r) => ({ lessonId: lessonIds.get(r.lessonId)!, fileId: r.fileId, name: r.name, url: r.url, sizeBytes: r.sizeBytes, sortOrder: r.sortOrder })));
    // Bản sao đứng ngay sau khóa gốc trong thư viện.
    const order = siblings.flatMap((s) => (s.id === courseId ? [s.id, newId] : [s.id]));
    for (const [i, id] of order.entries()) await tx.update(courses).set({ sortOrder: i }).where(eq(courses.id, id));
    return { ...row!, sortOrder: order.indexOf(newId) };
  });
  await audit(ctx, { action: 'course.duplicate', resourceType: 'course', resourceId: copy.id, communityId, metadata: { sourceCourseId: courseId } });
  return copy;
}

/** Đếm lại số bài, thời lượng và total_lessons cho mọi học viên (mục 196). */
export async function recountCourse(ctx: Ctx, courseId: string): Promise<void> {
  const [agg] = await ctx.db.select({ n: sql<number>`count(*)::int`, dur: sql<number>`coalesce(sum(duration_seconds),0)::int` }).from(lessons).where(eq(lessons.courseId, courseId));
  await ctx.db.update(courses).set({ lessonCount: agg?.n ?? 0, totalDurationSeconds: agg?.dur ?? 0, updatedAt: ctx.now() }).where(eq(courses.id, courseId));
  await ctx.db.update(courseProgress).set({ totalLessons: agg?.n ?? 0, percent: sql`least(100, round(completed_lessons * 100.0 / greatest(${agg?.n ?? 0}, 1)))::int` }).where(eq(courseProgress.courseId, courseId));
}

/** Xóa mềm khóa học; ảnh bìa bị gỡ và dọn khỏi R2 (giữ lại nếu sản phẩm cửa hàng của khóa còn dùng chung). */
export async function deleteCourse(ctx: Ctx, courseId: string) {
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  await ctx.db.update(courses).set({ deletedAt: ctx.now(), status: 'archived', coverUrl: null }).where(eq(courses.id, courseId));
  await releaseFiles(ctx, { urls: [c.coverUrl] }, { ownerUserIds: [c.ownerUserId], communityId: c.communityId });
  await audit(ctx, { action: 'course.delete', resourceType: 'course', resourceId: courseId, communityId: c.communityId });
}
