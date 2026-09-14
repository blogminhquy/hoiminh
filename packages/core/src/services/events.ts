// Sự kiện: danh sách theo tuần, tạo (lặp hằng tuần/tháng), chi tiết, đăng ký, câu hỏi gửi trước + bình chọn, bản ghi.
import { parseVideoUrl, type CreateEventInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { communityTiers, eventQuestionVotes, eventQuestions, eventRecordings, eventRegistrations, eventSeries, events, posts, spaces, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, invalid, notFound } from '../errors';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { memberTierKey } from './entitlements';
import { assertWorkspaceUnlocked } from './workspaces';

function meetingProvider(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/zoom\.us/.test(url)) return 'zoom';
  if (/meet\.google/.test(url)) return 'google_meet';
  const v = parseVideoUrl(url);
  return v?.provider ?? 'link';
}

/** Danh sách sự kiện: sắp tới / của tôi / đã qua, kèm trạng thái đăng ký và lịch tháng. */
export async function listEvents(ctx: Ctx, communityId: string, q: { filter?: 'upcoming' | 'mine' | 'past'; limit?: number; month?: string }) {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) throw forbidden();
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const now = ctx.now();
  const conds = [eq(events.communityId, communityId), sql`${events.status} <> 'cancelled'`];
  if (q.filter === 'past') conds.push(lt(events.endsAt, now));
  else conds.push(gte(events.endsAt, now));
  let rows = await ctx.db.select({ e: events }).from(events).where(and(...conds)).orderBy(q.filter === 'past' ? desc(events.startsAt) : asc(events.startsAt)).limit(q.limit ?? 40);
  const regs = userId && rows.length ? await ctx.db.query.eventRegistrations.findMany({ where: and(eq(eventRegistrations.userId, userId), inArray(eventRegistrations.eventId, rows.map((r) => r.e.id))) }) : [];
  if (q.filter === 'mine') rows = rows.filter((r) => regs.some((g) => g.eventId === r.e.id));
  const hostIds = [...new Set(rows.flatMap((r) => r.e.hostUserIds))];
  const hosts = hostIds.length ? await ctx.db.query.users.findMany({ where: inArray(users.id, hostIds), columns: { id: true, name: true, avatarUrl: true, coverColor: true, handle: true } }) : [];
  const [pastCount] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(events).where(and(eq(events.communityId, communityId), lt(events.endsAt, now)));
  const recordings = await ctx.db.query.eventRecordings.findMany({ where: eq(eventRecordings.communityId, communityId), orderBy: desc(eventRecordings.publishedAt), limit: 5 });
  const monthKey = q.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = monthKey.split('-').map(Number);
  const monthStart = new Date(y!, m! - 1, 1);
  const monthEnd = new Date(y!, m!, 1);
  const monthDays = await ctx.db.select({ d: sql<string>`to_char(${events.startsAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')` }).from(events).where(and(eq(events.communityId, communityId), gte(events.startsAt, monthStart), lt(events.startsAt, monthEnd)));
  return {
    items: rows.map((r) => ({ ...r.e, live: r.e.startsAt <= now && r.e.endsAt >= now, registered: regs.some((g) => g.eventId === r.e.id && g.status !== 'cancelled'), hosts: r.e.hostUserIds.map((id) => hosts.find((h) => h.id === id)).filter(Boolean), meetingUrl: regs.some((g) => g.eventId === r.e.id) || access.permissions.has('event.manage') ? r.e.meetingUrl : null })),
    pastCount: pastCount?.c ?? 0, recordings, calendarDays: [...new Set(monthDays.map((d) => d.d))], canManage: access.permissions.has('event.manage'),
  };
}

/** Tạo sự kiện; lặp thì sinh N buổi trong chuỗi; tùy chọn đăng bài thông báo. */
export async function createEvent(ctx: Ctx, communityId: string, input: CreateEventInput) {
  const userId = requireUser(ctx);
  const access = await requireCommunityPermission(ctx, communityId, 'event.manage');
  await assertWorkspaceUnlocked(ctx, access.workspaceId);
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (end <= start) throw invalid('Giờ kết thúc phải sau giờ bắt đầu');
  let seriesId = input.seriesId ?? null;
  const count = input.recurrence === 'none' ? 1 : input.occurrences;
  const created: Array<typeof events.$inferSelect> = [];
  await ctx.db.transaction(async (tx) => {
    if (input.recurrence !== 'none' && !seriesId) {
      const [s] = await tx.insert(eventSeries).values({ communityId, title: input.seriesTitle ?? input.title, recurrence: input.recurrence, coverColor: input.coverColor ?? '#0E8E96' }).returning();
      seriesId = s!.id;
    }
    const [cnt] = seriesId ? await tx.select({ existing: sql<number>`count(*)::int` }).from(events).where(eq(events.seriesId, seriesId)) : [{ existing: 0 }];
    const existing = cnt?.existing ?? 0;
    for (let i = 0; i < count; i++) {
      const s = new Date(start);
      const e = new Date(end);
      if (input.recurrence === 'weekly') { s.setDate(s.getDate() + 7 * i); e.setDate(e.getDate() + 7 * i); }
      if (input.recurrence === 'monthly') { s.setMonth(s.getMonth() + i); e.setMonth(e.getMonth() + i); }
      const [row] = await tx.insert(events).values({ communityId, seriesId, seriesIndex: seriesId ? (existing ?? 0) + i + 1 : null, createdByUserId: userId, title: input.title, descriptionMd: input.descriptionMd, coverColor: input.coverColor ?? '#0E8E96', kind: input.kind, recurrence: input.recurrence, startsAt: s, endsAt: e, timezone: input.timezone, meetingUrl: input.meetingUrl ?? null, meetingProvider: meetingProvider(input.meetingUrl), location: input.location ?? null, hostUserIds: input.hostUserIds.length ? input.hostUserIds : [userId], capacity: input.capacity ?? null, access: input.access, allowQuestions: input.allowQuestions, autoPublishRecording: input.autoPublishRecording, reminders: input.reminders, status: 'scheduled' }).returning();
      created.push(row!);
    }
    if (input.announceOnFeed && created[0]) {
      const space = await tx.query.spaces.findFirst({ where: and(eq(spaces.communityId, communityId), eq(spaces.slug, 'thong-bao')) }) ?? await tx.query.spaces.findFirst({ where: eq(spaces.communityId, communityId) });
      if (space) await tx.insert(posts).values({ communityId, spaceId: space.id, authorUserId: userId, title: `Sự kiện mới: ${input.title}`, contentMd: `${input.descriptionMd}\n\n**Thời gian:** ${start.toLocaleString('vi-VN', { timeZone: input.timezone })}${count > 1 ? ` · lặp ${input.recurrence === 'weekly' ? 'hằng tuần' : 'hằng tháng'}, ${count} buổi` : ''}`, excerpt: input.descriptionMd.slice(0, 200), broadcast: input.broadcastEmail });
    }
  });
  await ctx.events.emit('event.created', { eventId: created[0]!.id, communityId, announce: input.announceOnFeed, broadcast: input.broadcastEmail });
  await audit(ctx, { action: 'event.create', resourceType: 'event', resourceId: created[0]!.id, communityId, metadata: { count } });
  return { event: created[0]!, created: created.length, seriesId };
}

/** Sửa một buổi. */
export async function updateEvent(ctx: Ctx, eventId: string, input: Partial<CreateEventInput> & { status?: 'scheduled' | 'live' | 'ended' | 'cancelled' }) {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound();
  await requireCommunityPermission(ctx, e.communityId, 'event.manage');
  const patch: Partial<typeof events.$inferInsert> = { updatedAt: ctx.now() };
  for (const k of ['title', 'descriptionMd', 'coverColor', 'kind', 'timezone', 'location', 'hostUserIds', 'capacity', 'access', 'allowQuestions', 'autoPublishRecording', 'reminders', 'status'] as const) if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  if (input.startsAt) patch.startsAt = new Date(input.startsAt);
  if (input.endsAt) patch.endsAt = new Date(input.endsAt);
  if (input.meetingUrl !== undefined) { patch.meetingUrl = input.meetingUrl; patch.meetingProvider = meetingProvider(input.meetingUrl); }
  const [row] = await ctx.db.update(events).set(patch).where(eq(events.id, eventId)).returning();
  await audit(ctx, { action: 'event.update', resourceType: 'event', resourceId: eventId, communityId: e.communityId });
  return row!;
}

/** Chi tiết sự kiện: link phòng chỉ cho người đã đăng ký, câu hỏi theo bình chọn, người tham gia, chuỗi. */
export async function getEvent(ctx: Ctx, eventId: string) {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound('Sự kiện không tồn tại');
  const access = await resolveCommunityAccess(ctx, e.communityId);
  const isPublic = e.access === 'public';
  if (!isPublic && !access.permissions.has('community.read')) throw forbidden('Tham gia hội để xem sự kiện');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const manage = access.permissions.has('event.manage');
  const [reg, questions, attendees, series, recordings, hosts] = await Promise.all([
    userId ? ctx.db.query.eventRegistrations.findFirst({ where: and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)) }) : null,
    ctx.db.select({ q: eventQuestions, user: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(eventQuestions).innerJoin(users, eq(users.id, eventQuestions.userId)).where(eq(eventQuestions.eventId, eventId)).orderBy(desc(eventQuestions.voteCount), asc(eventQuestions.createdAt)),
    ctx.db.select({ user: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(eventRegistrations).innerJoin(users, eq(users.id, eventRegistrations.userId)).where(and(eq(eventRegistrations.eventId, eventId), sql`${eventRegistrations.status} <> 'cancelled'`)).limit(12),
    e.seriesId ? ctx.db.query.events.findMany({ where: eq(events.seriesId, e.seriesId), orderBy: asc(events.startsAt), columns: { id: true, title: true, startsAt: true, seriesIndex: true, status: true, registrationCount: true } }) : [],
    ctx.db.query.eventRecordings.findMany({ where: eq(eventRecordings.eventId, eventId) }),
    e.hostUserIds.length ? ctx.db.query.users.findMany({ where: inArray(users.id, e.hostUserIds), columns: { id: true, name: true, handle: true, avatarUrl: true, coverColor: true } }) : [],
  ]);
  const myVotes = userId ? new Set((await ctx.db.select({ q: eventQuestionVotes.questionId }).from(eventQuestionVotes).innerJoin(eventQuestions, eq(eventQuestions.id, eventQuestionVotes.questionId)).where(and(eq(eventQuestions.eventId, eventId), eq(eventQuestionVotes.userId, userId)))).map((r) => r.q)) : new Set<string>();
  const registered = Boolean(reg && reg.status !== 'cancelled');
  const tierKey = userId ? await memberTierKey(ctx, userId, e.communityId) : null;
  const premiumLocked = e.access === 'premium' && !manage && tierKey !== 'premium' && tierKey !== 'vip';
  const now = ctx.now();
  const showLink = (registered || manage) && e.meetingUrl && (manage || e.startsAt.getTime() - now.getTime() < 15 * 60_000);
  return { ...e, meetingUrl: showLink ? e.meetingUrl : null, live: e.startsAt <= now && e.endsAt >= now, registered, premiumLocked, questions: questions.map((r) => ({ ...r.q, user: r.user, voted: myVotes.has(r.q.id) })), attendees: attendees.map((a) => a.user), attendeesVisible: manage || tierKey === 'premium' || tierKey === 'vip', series, recordings, hosts, canManage: manage };
}

/** Đăng ký / hủy đăng ký. */
export async function registerEvent(ctx: Ctx, eventId: string, join = true) {
  const userId = requireUser(ctx);
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound();
  const access = await resolveCommunityAccess(ctx, e.communityId);
  if (e.access !== 'public' && !access.permissions.has('community.read')) throw forbidden('Tham gia hội để đăng ký sự kiện');
  if (e.access === 'premium' && !access.permissions.has('event.manage')) {
    const tier = access.tierId ? await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, access.tierId), columns: { key: true } }) : null;
    if (!tier || tier.key === 'standard') throw forbidden('Sự kiện dành cho thành viên Premium');
  }
  const existing = await ctx.db.query.eventRegistrations.findFirst({ where: and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)) });
  if (join) {
    if (e.capacity && e.registrationCount >= e.capacity && !existing) throw invalid('Sự kiện đã hết chỗ');
    if (existing?.status === 'registered') return { registered: true };
    if (existing) await ctx.db.update(eventRegistrations).set({ status: 'registered' }).where(eq(eventRegistrations.id, existing.id));
    else await ctx.db.insert(eventRegistrations).values({ eventId, userId, reminderPrefs: e.reminders });
    await ctx.db.update(events).set({ registrationCount: sql`${events.registrationCount} + 1` }).where(eq(events.id, eventId));
    await ctx.events.emit('event.registered', { eventId, communityId: e.communityId, userId });
    return { registered: true };
  }
  if (existing && existing.status !== 'cancelled') {
    await ctx.db.update(eventRegistrations).set({ status: 'cancelled' }).where(eq(eventRegistrations.id, existing.id));
    await ctx.db.update(events).set({ registrationCount: sql`greatest(${events.registrationCount} - 1, 0)` }).where(eq(events.id, eventId));
  }
  return { registered: false };
}

/** Gửi câu hỏi trước buổi. */
export async function askQuestion(ctx: Ctx, eventId: string, question: string) {
  const userId = requireUser(ctx);
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound();
  if (!e.allowQuestions) throw invalid('Sự kiện không nhận câu hỏi gửi trước');
  await requireCommunityPermission(ctx, e.communityId, 'community.read');
  const [row] = await ctx.db.insert(eventQuestions).values({ eventId, userId, question }).returning();
  return row!;
}

/** Bình chọn / bỏ bình chọn câu hỏi. */
export async function voteQuestion(ctx: Ctx, questionId: string) {
  const userId = requireUser(ctx);
  const q = await ctx.db.query.eventQuestions.findFirst({ where: eq(eventQuestions.id, questionId) });
  if (!q) throw notFound();
  const existing = await ctx.db.query.eventQuestionVotes.findFirst({ where: and(eq(eventQuestionVotes.questionId, questionId), eq(eventQuestionVotes.userId, userId)) });
  if (existing) {
    await ctx.db.delete(eventQuestionVotes).where(eq(eventQuestionVotes.id, existing.id));
    const [row] = await ctx.db.update(eventQuestions).set({ voteCount: sql`greatest(${eventQuestions.voteCount} - 1, 0)` }).where(eq(eventQuestions.id, questionId)).returning();
    return { voted: false, voteCount: row!.voteCount };
  }
  await ctx.db.insert(eventQuestionVotes).values({ questionId, userId });
  const [row] = await ctx.db.update(eventQuestions).set({ voteCount: sql`${eventQuestions.voteCount} + 1` }).where(eq(eventQuestions.id, questionId)).returning();
  return { voted: true, voteCount: row!.voteCount };
}

/** Thêm bản ghi vào "Xem lại" (link video nhúng ngoài). */
export async function addRecording(ctx: Ctx, eventId: string, input: { videoUrl: string; title?: string; durationSeconds?: number | null }) {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound();
  await requireCommunityPermission(ctx, e.communityId, 'event.manage');
  const v = parseVideoUrl(input.videoUrl);
  if (!v) throw invalid('Link video không nhận diện được');
  const [row] = await ctx.db.insert(eventRecordings).values({ eventId, communityId: e.communityId, title: input.title ?? e.title, videoUrl: input.videoUrl, videoProvider: v.provider, videoExternalId: v.externalId, durationSeconds: input.durationSeconds ?? null }).returning();
  await ctx.db.update(events).set({ status: 'ended' }).where(eq(events.id, eventId));
  return row!;
}

/** Danh sách bản ghi của hội. */
export async function listRecordings(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'community.read');
  return ctx.db.query.eventRecordings.findMany({ where: eq(eventRecordings.communityId, communityId), orderBy: desc(eventRecordings.publishedAt) });
}

/** Người đăng ký (cho người tổ chức: nhắn tất cả, xuất danh sách). */
export async function eventAttendees(ctx: Ctx, eventId: string) {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!e) throw notFound();
  await requireCommunityPermission(ctx, e.communityId, 'event.manage');
  return ctx.db.select({ id: users.id, name: users.name, email: users.email, handle: users.handle }).from(eventRegistrations).innerJoin(users, eq(users.id, eventRegistrations.userId)).where(and(eq(eventRegistrations.eventId, eventId), sql`${eventRegistrations.status} <> 'cancelled'`));
}
