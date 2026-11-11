// Consumer hàng đợi: email, webhook gửi đi, broadcast bài viết, tin nhắn chào, nhắc sự kiện, snapshot, đếm lại khóa.
import { templates } from '@hoiminh/email';
import { systemCtx, type AppContext } from '../context';
import { withSystemScope } from '../lib/tenant-scope';
import { snapshotLeaderboards } from '../services/affiliate';
import { recountCourse } from '../services/courses';
import { sendWelcomeDm } from '../services/messaging';
import { deliver } from '../services/webhooks-out';
import { runPostBroadcast, runPostBroadcastBatch } from './broadcast';
import { runEventReminder, runEventReminderBatch } from './event-reminders';
import type { Job } from './queue';
import { runScheduledJob } from './scheduled';
import { sendPushToUser } from '../services/push';

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
      case 'post.broadcast':
        await runPostBroadcast(ctx, job.payload);
        return;
      case 'post.broadcast.batch':
        await runPostBroadcastBatch(ctx, job.payload);
        return;
      case 'event.remind':
        await runEventReminder(ctx, job.payload);
        return;
      case 'event.remind.batch':
        await runEventReminderBatch(ctx, job.payload);
        return;
      case 'push.send':
        await sendPushToUser(ctx, job.payload.userId, { title: job.payload.title, body: job.payload.body, link: job.payload.link, tag: job.payload.tag });
        return;
      case 'scheduled.run': {
        const result = await runScheduledJob(ctx, job.payload.jobId);
        ctx.log.info('scheduled.run', { jobId: job.payload.jobId, result });
        return;
      }
      default:
        // Tên job chưa biết: thường do hoiminh-api đã deploy bản mới hơn hoiminh-jobs. Ném lỗi để Queue retry
        // thay vì ack (ack là mất tin); consumer coi đây là lỗi tạm thời cho tới khi bản mới của jobs lên.
        throw new Error(`job.unknown:${String((job as { name?: unknown }).name)}`);
    }
  });
}
