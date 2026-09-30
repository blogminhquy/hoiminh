// Cập nhật trạng thái dòng scheduled_jobs. Chỉ phụ thuộc DB (không import service) để tenant-scope.ts dùng được mà không vòng import.
import { and, eq, inArray } from 'drizzle-orm';
import { scheduledJobs, type Database } from '@hoiminh/db';

/** Message của dòng này đã vào Queue. Gọi lại thì chỉ làm mới `enqueued_at`; dòng đã done/failed thì giữ nguyên. */
export async function markScheduledEnqueued(db: Database, jobId: string, at: Date): Promise<void> {
  await db.update(scheduledJobs).set({ status: 'enqueued', enqueuedAt: at }).where(and(eq(scheduledJobs.id, jobId), inArray(scheduledJobs.status, ['pending', 'enqueued'])));
}

/** Đánh dấu thất bại hẳn (hết lượt retry hoặc lỗi vĩnh viễn). Dòng đã done thì không đè. */
export async function markScheduledFailed(db: Database, jobId: string, reason: string): Promise<void> {
  await db.update(scheduledJobs).set({ status: 'failed', lastError: reason }).where(and(eq(scheduledJobs.id, jobId), inArray(scheduledJobs.status, ['pending', 'enqueued', 'running'])));
}
