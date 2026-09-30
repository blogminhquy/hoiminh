// Consumer hàng đợi: ack / retry theo loại lỗi, lịch lùi theo số lần thử, log có cấu trúc, và xử lý DLQ.
// Logic nằm ở đây (không nằm trong Worker) để test được mà không cần runtime Cloudflare.
import type { AppContext } from '../context';
import { PermanentJobError } from './errors';
import { createJobHandler } from './handlers';
import type { Job, JobHandler } from './queue';
import { markScheduledFailed } from './scheduled-state';

/** Phần của Message (Cloudflare Queues) mà consumer dùng. */
export interface QueueMessageLike {
  readonly id?: string;
  readonly body: Job;
  /** Số lần message đã được giao, tính từ 1. */
  readonly attempts?: number;
  ack(): void;
  retry(opts?: { delaySeconds?: number }): void;
}

/** Lỗi tạm thời: thử lại sau 1, 5, 15, 60 phút rồi giữ 60 phút; hết `max_retries` thì vào DLQ. */
export const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600] as const;

export function retryDelay(attempts: number | undefined): number {
  const n = Math.max(1, attempts ?? 1);
  return RETRY_DELAYS_SECONDS[Math.min(n, RETRY_DELAYS_SECONDS.length) - 1]!;
}

function errorInfo(err: unknown): { type: string; message: string } {
  return err instanceof Error ? { type: err.name, message: err.message } : { type: 'unknown', message: String(err) };
}

function jobMeta(msg: QueueMessageLike, status: string, startedAt: number): Record<string, unknown> {
  const payload = (msg.body.payload ?? {}) as { communityId?: unknown; workspaceId?: unknown };
  return {
    job: { name: msg.body.name, id: msg.id, attempt: msg.attempts ?? 1, dedupeKey: msg.body.dedupeKey, durationMs: Date.now() - startedAt, status },
    ...(typeof payload.communityId === 'string' ? { communityId: payload.communityId } : {}),
    ...(typeof payload.workspaceId === 'string' ? { workspaceId: payload.workspaceId } : {}),
  };
}

/**
 * Xử lý một batch, từng message độc lập: message này lỗi không kéo theo message khác.
 * Thành công → ack. Lỗi vĩnh viễn → ack + log `job.dropped`. Lỗi khác (kể cả tên job lạ) → retry có delay.
 */
export async function processBatch(app: AppContext, messages: readonly QueueMessageLike[], handle: JobHandler = createJobHandler(app)): Promise<void> {
  for (const msg of messages) {
    const started = Date.now();
    try {
      await handle(msg.body);
      msg.ack();
      app.log.info('job.done', jobMeta(msg, 'ok', started));
    } catch (err) {
      if (err instanceof PermanentJobError) {
        msg.ack();
        app.log.warn('job.dropped', { ...jobMeta(msg, 'dropped', started), error: errorInfo(err) });
      } else {
        msg.retry({ delaySeconds: retryDelay(msg.attempts) });
        app.log.warn('job.retry', { ...jobMeta(msg, 'retry', started), error: errorInfo(err) });
      }
    }
  }
}

/** Consumer của hoiminh-jobs-dlq: ghi log lỗi để cảnh báo, đánh dấu dòng scheduled_jobs tương ứng là failed, rồi ack. */
export async function processDeadLetters(app: AppContext, messages: readonly QueueMessageLike[]): Promise<void> {
  for (const msg of messages) {
    const started = Date.now();
    app.log.error('job.dead_letter', jobMeta(msg, 'dead', started));
    if (msg.body.name === 'scheduled.run') {
      try {
        await markScheduledFailed(app.db, msg.body.payload.jobId, 'Hết lượt retry (dead letter)');
      } catch (err) {
        app.log.error('job.dead_letter_mark_failed', { job: { name: msg.body.name, id: msg.id }, error: errorInfo(err) });
      }
    }
    msg.ack();
  }
}
