// Khóa học: thư viện, chi tiết, tạo/sửa/đăng, module và bài học, nhúng video, tài liệu.
import { parseVideoUrl, toSlug, type CreateCourseInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { comments, communities, courseModules, courseProgress, courses, files, lessonProgress, lessonResources, lessons, products, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, invalid, notFound } from '../errors';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { canAccessCourse } from './entitlements';
import { assertWorkspaceUnlocked } from './workspaces';

/** Thư viện khóa học của hội: thẻ có % tiến độ, nhãn Nháp/khóa, khối "Học tiếp". */
export async function listCourses(ctx: Ctx, communityId: string) {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('course.read') && !access.permissions.has('course.manage')) throw forbidden('Tham gia hội để xem khóa học');
  const staff = access.permissions.has('course.manage');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const conds = [eq(courses.communityId, communityId), isNull(courses.deletedAt)];
  if (!staff) conds.push(eq(courses.status, 'published'));
  const rows = await ctx.db.query.courses.findMany({ where: and(...conds), orderBy: [asc(courses.sortOrder), desc(courses.createdAt)] });
  const progress = userId && rows.length ? await ctx.db.query.courseProgress.findMany({ where: and(eq(courseProgress.userId, userId), inArray(courseProgress.courseId, rows.map((c) => c.id))) }) : [];
  const items = [];
  for (const c of rows) {
    const p = progress.find((x) => x.courseId === c.id);
    const decision = c.status === 'draft' ? { allowed: staff, reason: 'locked' as const } : await canAccessCourse(ctx, userId, c.id, { isStaff: staff });
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
  const decision = await canAccessCourse(ctx, userId, courseId, { isStaff: staff });
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
  const tree = modules.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id).map((l) => ({ id: l.id, title: l.title, kind: l.kind, durationSeconds: l.durationSeconds, isPreview: l.isPreview || (c.previewFirstModule && m.id === firstModuleId), done: done.has(l.id), locked: !(decision.allowed || l.isPreview || (c.previewFirstModule && m.id === firstModuleId)), current: progress?.lastLessonId === l.id })) }));
  const [learners] = await ctx.db.select({ c: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where percent = 100)::int` }).from(courseProgress).where(eq(courseProgress.courseId, courseId));
  return { ...c, communitySlug, owner, modules: tree, progress: progress ?? null, access: decision, canManage: staff, resources: resources.map((r) => ({ id: r.id, fileId: r.fileId, name: r.name, url: r.url, lessonId: r.lessonId, sizeBytes: r.sizeBytes })), discussions: discussions.map((d) => ({ ...d.c, author: d.author, lesson: d.lesson })), learners: { total: learners?.c ?? 0, completed: learners?.done ?? 0 }, product: productRow ? { id: productRow.id, priceMinor: productRow.priceMinor, compareAtMinor: productRow.compareAtMinor, slug: productRow.slug } : null };
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
  const embed = l.videoUrl ? parseVideoUrl(l.videoUrl) : null;
  const drip = course.progress?.startedAt && l.dripDays > 0 ? new Date(course.progress.startedAt.getTime() + l.dripDays * 86_400_000) : null;
  const dripLocked = Boolean(drip && drip > ctx.now() && !course.canManage);
  return { lesson: locked ? { ...l, contentMd: l.contentMd.slice(0, 200), videoUrl: null, videoExternalId: null } : l, embed: locked ? null : embed, locked, dripLocked, dripUnlocksAt: dripLocked ? drip : null, lockReason: course.access.reason, course: { id: course.id, title: course.title, lessonCount: course.lessonCount, communityId: course.communityId, communitySlug: course.communitySlug ?? null, modules: course.modules, progress: course.progress, previewFirstModule: course.previewFirstModule, accessMode: course.accessMode, product: course.product, coverColor: course.coverColor }, prev: flat[idx - 1] ?? null, next: flat[idx + 1] ?? null, resources, done: entry?.done ?? false };
}

/** Đánh dấu hoàn thành bài, cập nhật course_progress, phát lesson.completed / course.completed. */
export async function completeLesson(ctx: Ctx, lessonId: string) {
  const userId = requireUser(ctx);
  const l = await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw notFound();
  const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, l.courseId) });
  if (!course) throw notFound();
  const access = course.communityId ? await resolveCommunityAccess(ctx, course.communityId) : null;
  const decision = await canAccessCourse(ctx, userId, l.courseId, { isStaff: access?.permissions.has('course.manage'), lessonIsPreview: l.isPreview });
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
  await assertWorkspaceUnlocked(ctx, access.workspaceId);
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
    const e = parseVideoUrl(input.videoUrl);
    if (!e) throw invalid('Link video không nhận diện được. Hỗ trợ YouTube, TikTok, Facebook, Loom, Vimeo, Bunny.');
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

/** Đếm lại số bài, thời lượng và total_lessons cho mọi học viên (mục 196). */
export async function recountCourse(ctx: Ctx, courseId: string): Promise<void> {
  const [agg] = await ctx.db.select({ n: sql<number>`count(*)::int`, dur: sql<number>`coalesce(sum(duration_seconds),0)::int` }).from(lessons).where(eq(lessons.courseId, courseId));
  await ctx.db.update(courses).set({ lessonCount: agg?.n ?? 0, totalDurationSeconds: agg?.dur ?? 0, updatedAt: ctx.now() }).where(eq(courses.id, courseId));
  await ctx.db.update(courseProgress).set({ totalLessons: agg?.n ?? 0, percent: sql`least(100, round(completed_lessons * 100.0 / greatest(${agg?.n ?? 0}, 1)))::int` }).where(eq(courseProgress.courseId, courseId));
}

/** Xóa mềm khóa học. */
export async function deleteCourse(ctx: Ctx, courseId: string) {
  const c = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!c || !c.communityId) throw notFound();
  await requireCommunityPermission(ctx, c.communityId, 'course.manage');
  await ctx.db.update(courses).set({ deletedAt: ctx.now(), status: 'archived' }).where(eq(courses.id, courseId));
  await audit(ctx, { action: 'course.delete', resourceType: 'course', resourceId: courseId, communityId: c.communityId });
}
