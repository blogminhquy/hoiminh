// Hàng đợi job: Cloudflare Queues ở production, in-memory ở local/test. Job hẹn giờ lưu bảng scheduled_jobs.
export interface JobMap {
  'email.send': { to: string; template: string; args: unknown[] };
  'webhook.deliver': { deliveryId: string };
  'post.broadcast': { postId: string };
  'welcome_dm.send': { communityId: string; userId: string };
  'event.remind': { eventId: string; label: string };
  'leaderboard.snapshot': { communityId: string };
  'course.recount': { courseId: string };
}
export type JobName = keyof JobMap;
export type Job = { [K in JobName]: { name: K; payload: JobMap[K]; attempt: number } }[JobName];

export type JobHandler = (job: Job) => Promise<void>;

export interface JobQueue {
  enqueue<K extends JobName>(name: K, payload: JobMap[K]): Promise<void>;
}

/** Hàng đợi trong bộ nhớ: chạy ngay sau tick hiện tại, retry 3 lần lùi dần. */
export class InMemoryQueue implements JobQueue {
  private handler: JobHandler | null = null;
  private pending = 0;
  readonly processed: Job[] = [];

  setHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  async enqueue<K extends JobName>(name: K, payload: JobMap[K]): Promise<void> {
    const job = { name, payload, attempt: 0 } as Job;
    this.pending++;
    setTimeout(() => void this.run(job), 0);
  }

  private async run(job: Job): Promise<void> {
    try {
      if (!this.handler) throw new Error('Chưa đăng ký handler cho hàng đợi');
      await this.handler(job);
      this.processed.push(job);
    } catch (err) {
      if (job.attempt < 3) {
        job.attempt++;
        setTimeout(() => void this.run(job), 250 * 2 ** job.attempt);
        return;
      }
      console.error('[queue] job thất bại sau 3 lần', job.name, err);
    } finally {
      if (job.attempt >= 3 || this.processed.includes(job)) this.pending--;
    }
  }

  /** Chờ mọi job đang chờ chạy xong (dùng trong test). */
  async drain(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.pending > 0 && Date.now() - start < timeoutMs) await new Promise((r) => setTimeout(r, 10));
  }
}

/** Hàng đợi Cloudflare: gửi message vào Queue binding. */
export class CloudflareQueue implements JobQueue {
  constructor(private readonly binding: { send(body: Job, options?: unknown): Promise<void> }) {}
  async enqueue<K extends JobName>(name: K, payload: JobMap[K]): Promise<void> {
    await this.binding.send({ name, payload, attempt: 0 } as Job);
  }
}
