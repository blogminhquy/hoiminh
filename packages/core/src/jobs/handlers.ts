// Consumer hàng đợi: email, webhook gửi đi, broadcast bài viết, tin nhắn chào, nhắc sự kiện, snapshot, đếm lại khóa.
import { templates } from '@hoiminh/email';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { communities, emailLogs, eventRegistrations, events, notificationPrefs, posts, users } from '@hoiminh/db';
import { systemCtx, type AppContext } from '../context';
import { withSystemScope } from '../lib/tenant-scope';
import { raw } from '../lib/db';
import { snapshotLeaderboards } from '../services/affiliate';
import { recountCourse } from '../services/courses';
import { sendWelcomeDm } from '../services/messaging';
import { notify } from '../services/notifications';
import { deliver } from '../services/webhooks-out';
import type { Job } from './queue';

/** Tạo handler cho hàng đợi. */
export function createJobHandler(app: AppContext): (job: Job) => Promise<void> {
  return async (job) =>
    // Job chạy ngoài request nên tự mở transaction có biến phiên bypass (RLS).
    withSystemScope(systemCtx(app, `job-${job.name}`), async (ctx) => {
    switch (job.name) {
      case 'webhook.deliver':
        await deliver(ctx, job.payload.deliveryId);
        return;
      case 'welcome_dm.send':
        await sendWelcomeDm(ctx, job.payload.communityId, job.payload.userId);
        return;
      case 'leaderboard.snapshot':
        await snapshotLeaderboards(ctx, job.payload.communityId);
        return;
      case 'course.recount':
        await recountCourse(ctx, job.payload.courseId);
        return;
      case 'email.send': {
        const fn = (templates as Record<string, (...a: never[]) => ReturnType<(typeof templates)['verifyCode']>>)[job.payload.template];
        if (fn) await ctx.email.send(fn(...(job.payload.args as never[])));
        return;
      }
      case 'post.broadcast': {
        const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, job.payload.postId) });
        if (!post) return;
        const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, post.communityId) });
        if (!community) return;
        // Gửi theo lô 500, tôn trọng tùy chọn thông báo (mục 195).
        const members = await raw(ctx.db, sql`select u.id, u.email, u.name from community_members m join users u on u.id = m.user_id where m.community_id = ${post.communityId} and m.status in ('active','cancelling') and u.status = 'active'`);
        const rows = members as Array<{ id: string; email: string; name: string }>;
        const prefs = rows.length ? await ctx.db.query.notificationPrefs.findMany({ where: inArray(notificationPrefs.userId, rows.map((r) => r.id)) }) : [];
        let sent = 0;
        for (let i = 0; i < rows.length; i += 500) {
          for (const r of rows.slice(i, i + 500)) {
            const p = prefs.find((x) => x.userId === r.id);
            if (p && (p.emailDigest === false || p.perCommunity[post.communityId] === 'off')) continue;
            const res = await ctx.email.send(templates.broadcastPost(r.email, community.name, post.title || post.excerpt.slice(0, 60), post.excerpt, `${ctx.env.APP_URL}/${community.slug}/bai-viet/${post.id}`));
            await ctx.db.insert(emailLogs).values({ toEmail: r.email, template: 'broadcast_post', subject: post.title, status: res.status, providerMessageId: res.providerMessageId ?? null, error: res.error ?? null });
            sent++;
          }
        }
        ctx.log.info('post.broadcast.done', { postId: post.id, sent });
        return;
      }
      case 'event.remind': {
        const e = await ctx.db.query.events.findFirst({ where: eq(events.id, job.payload.eventId) });
        if (!e) return;
        const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, e.communityId) });
        const regs = await ctx.db.select({ u: users }).from(eventRegistrations).innerJoin(users, eq(users.id, eventRegistrations.userId)).where(and(eq(eventRegistrations.eventId, e.id), sql`${eventRegistrations.status} <> 'cancelled'`));
        const when = job.payload.label === 'start' ? 'ngay bây giờ' : job.payload.label === '1h' ? 'sau 1 giờ' : job.payload.label === '15m' ? 'sau 15 phút' : 'vào ngày mai';
        for (const { u } of regs) {
          await notify(ctx, { userId: u.id, communityId: e.communityId, kind: 'event.reminder', category: 'event', title: `Sự kiện ${e.title} bắt đầu ${when}`, link: `/${community?.slug}/su-kien/${e.id}`, actionLabel: 'Vào phòng' });
          await ctx.email.send(templates.eventReminder(u.email, u.name, e.title, when, `${ctx.env.APP_URL}/${community?.slug}/su-kien/${e.id}`));
        }
        return;
      }
    }
  });
}
