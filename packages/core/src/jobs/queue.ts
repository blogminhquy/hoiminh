// Hàng đợi job: Cloudflare Queues ở production, in-memory ở local/test. Job hẹn giờ lưu bảng scheduled_jobs.
import { PermanentJobError } from './errors';

export interface JobMap {
  'email.send': { to: string; template: string; args: unknown[] };
  'webhook.deliver': { deliveryId: string };
  /** Job cha: chia thành viên thành lô `post.broadcast.batch`. */
  'post.broadcast': { postId: string };
  'post.broadcast.batch': { postId: string; userIds: string[] };
  'welcome_dm.send': { communityId: string; userId: string };
  /** Job cha: chia người đăng ký thành lô `event.remind.batch`. `runAt` để phát hiện sự kiện đã đổi giờ. */
  'event.remind': { eventId: string; label: string; runAt?: string };
  'event.remind.batch': { eventId: string; label: string; jobKey: string; userIds: string[] };
  'leaderboard.snapshot': { communityId: string };
  'course.recount': { courseId: string };
  /** Gửi một thông báo đẩy (Web Push) tới mọi thiết bị đã đăng ký của một người. */
  'push.send': { userId: string; title: string; body: string; link: string | null; tag: string };
  /** Chạy một dòng scheduled_jobs (welcome DM, xóa tệp, nhắc sự kiện...). */
  'scheduled.run': { jobId: string };
}
export type JobName = keyof JobMap;
export type Job = { [K in JobName]: { name: K; payload: JobMap[K]; attempt: number; dedupeKey?: string } }[JobName];

export type JobHandler = (job: Job) => Promise<void>;

/** Cloudflare Queues chỉ cho hẹn tối đa 24 giờ; việc xa hơn phải nằm ở DB chờ bộ quét. */
export const MAX_DELAY_SECONDS = 86_400;

export interface EnqueueOptions {
  /** Số giây hoãn trước khi consumer nhận được, 0..86400. */
  delaySeconds?: number;
  /** Nhãn để log và truy vết. Queue không tự khử trùng: khử trùng thật nằm ở DB. */
  dedupeKey?: string;
}

export interface JobQueue {
  enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void>;
}

/** Delay ngoài 0..86400 hoặc không nguyên là lỗi lập trình: người gọi phải để việc xa hơn ở DB. */
export function assertDelay(opts?: EnqueueOptions): void {
  const d = opts?.delaySeconds;
  if (d === undefined) return;
  if (!Number.isInteger(d) || d < 0 || d > MAX_DELAY_SECONDS) throw new RangeError(`delaySeconds phải là số nguyên trong 0..${MAX_DELAY_SECONDS}, nhận ${d}`);
}

interface DelayedEntry {
  job: Job;
  delaySeconds: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Hàng đợi trong bộ nhớ: chạy ngay sau tick hiện tại (hoặc sau delay), retry 3 lần lùi dần. */
export class InMemoryQueue implements JobQueue {
  private handler: JobHandler | null = null;
  private pending = 0;
  readonly processed: Job[] = [];
  /** Job bị bỏ vì lỗi vĩnh viễn. */
  readonly dropped: Job[] = [];
  /** Job hết lượt retry (tương đương vào DLQ). */
  readonly dead: Job[] = [];
  /** Job đang chờ tới hẹn; test đọc ở đây và gọi releaseDelayed() thay vì chờ đồng hồ thật. */
  readonly delayed: DelayedEntry[] = [];

  setHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    assertDelay(opts);
    const job = { name, payload, attempt: 0, ...(opts?.dedupeKey ? { dedupeKey: opts.dedupeKey } : {}) } as Job;
    const delaySeconds = opts?.delaySeconds ?? 0;
    if (delaySeconds <= 0) {
      this.start(job);
      return;
    }
    const entry: DelayedEntry = { job, delaySeconds, timer: null };
    entry.timer = setTimeout(() => this.release(entry), delaySeconds * 1000);
    (entry.timer as { unref?: () => void }).unref?.();
    this.delayed.push(entry);
  }

  /** Cho mọi job đang hẹn chạy ngay, bất kể giờ. Trả về số job được thả. */
  releaseDelayed(): number {
    const all = [...this.delayed];
    for (const e of all) this.release(e);
    return all.length;
  }

  private release(entry: DelayedEntry): void {
    const i = this.delayed.indexOf(entry);
    if (i < 0) return;
    this.delayed.splice(i, 1);
    if (entry.timer) clearTimeout(entry.timer);
    this.start(entry.job);
  }

  private start(job: Job): void {
    this.pending++;
    setTimeout(() => void this.run(job), 0);
  }

  private async run(job: Job): Promise<void> {
    let finished = true;
    try {
      if (!this.handler) throw new Error('Chưa đăng ký handler cho hàng đợi');
      await this.handler(job);
      this.processed.push(job);
    } catch (err) {
      if (err instanceof PermanentJobError) {
        this.dropped.push(job);
        console.error('[queue] job bị bỏ (lỗi vĩnh viễn)', job.name, err.message);
      } else if (job.attempt < 3) {
        job.attempt++;
        finished = false;
        setTimeout(() => void this.run(job), 250 * 2 ** job.attempt);
      } else {
        this.dead.push(job);
        console.error('[queue] job thất bại sau 3 lần', job.name, err);
      }
    } finally {
      if (finished) this.pending--;
    }
  }

  /** Chờ mọi job đang chờ chạy xong (dùng trong test). Job còn hẹn giờ không tính. */
  async drain(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.pending > 0 && Date.now() - start < timeoutMs) await new Promise((r) => setTimeout(r, 10));
  }
}

/** Hàng đợi Cloudflare: gửi message vào Queue binding. */
export class CloudflareQueue implements JobQueue {
  constructor(private readonly binding: { send(body: Job, options?: { delaySeconds?: number }): Promise<void> }) {}
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    assertDelay(opts);
    const body = { name, payload, attempt: 0, ...(opts?.dedupeKey ? { dedupeKey: opts.dedupeKey } : {}) } as Job;
    if (opts?.delaySeconds) await this.binding.send(body, { delaySeconds: opts.delaySeconds });
    else await this.binding.send(body);
  }
}

/** Message đang được DeferredQueue giữ. */
export interface HeldMessage {
  name: JobName;
  payload: unknown;
  opts?: EnqueueOptions;
}

/**
 * Giữ mọi enqueue cho tới khi transaction commit (cùng kiểu DeferredSender của email).
 * Đẩy vào Queue giữa transaction thì consumer có thể chạy trước commit và không thấy dữ liệu,
 * hoặc transaction hủy mà message vẫn đi. Dùng `flush` sau commit, `discard` khi hủy.
 */
export class DeferredQueue implements JobQueue {
  private held: HeldMessage[] = [];
  constructor(readonly inner: JobQueue) {}

  get size(): number {
    return this.held.length;
  }

  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    assertDelay(opts);
    this.held.push({ name, payload, opts });
  }

  /**
   * Gửi mọi message đang giữ. Message nào lỗi thì gọi `onError` rồi đi tiếp, không làm hỏng thao tác đã commit.
   * `onSent` chạy sau mỗi message gửi thành công (đánh dấu dòng scheduled_jobs là enqueued).
   */
  async flush(onError: (m: HeldMessage, err: unknown) => void, onSent?: (m: HeldMessage) => Promise<void> | void): Promise<void> {
    for (const m of this.held.splice(0)) {
      try {
        await this.inner.enqueue(m.name, m.payload as JobMap[typeof m.name], m.opts);
      } catch (err) {
        onError(m, err);
        continue;
      }
      try {
        await onSent?.(m);
      } catch (err) {
        onError(m, err);
      }
    }
  }

  /** Bỏ mọi message đang giữ; gọi khi transaction bị hủy. */
  discard(): number {
    return this.held.splice(0).length;
  }
}
