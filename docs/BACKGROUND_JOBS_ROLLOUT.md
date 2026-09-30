# Rollout background jobs event-driven: triển khai, quan sát 7 ngày, gỡ cron phút

Đi kèm [BACKGROUND_JOBS_SPEC.md](BACKGROUND_JOBS_SPEC.md). Phase 0 tới 4 nằm ở nhánh `claude/event-driven-jobs-arch-d60c6b`; Phase 6 nằm ở nhánh riêng `claude/jobs-phase6-remove-minute-cron` và **không được merge trước khi Phase 5 sạch**.

## 0. Trước khi merge vào `main` (bắt buộc)

Workflow `deploy.yml` tự deploy mỗi lần đẩy lên `main` và **không chạy migration**. Vì vậy:

1. **Áp migration `0004_background_jobs` lên Supabase trước**, bằng kết nối trực tiếp (cổng 5432):
   ```bash
   DATABASE_DIRECT_URL=... pnpm db:migrate
   ```
   Migration chỉ thêm: cột `scheduled_jobs.enqueued_at`, bảng `job_recipients`, ba index một phần (`events`, `orders`). Không xoá, không đổi cột cũ, nên bản code cũ vẫn chạy được sau khi áp.
   Kiểm tra sau khi áp:
   ```sql
   select column_name from information_schema.columns where table_name = 'scheduled_jobs' and column_name = 'enqueued_at';
   select to_regclass('public.job_recipients'), to_regclass('public.orders_pending_expiry_idx');
   ```
2. **Deploy `hoiminh-jobs` trước `hoiminh-api` cho lần phát hành này.** Workflow deploy theo thứ tự api rồi jobs. Bản `hoiminh-jobs` cũ gặp tên job lạ (`scheduled.run`) thì **ack và mất tin** (switch không có `default`). Nếu api lên trước, trong vài phút bản api mới có thể gửi `scheduled.run` cho consumer cũ. Cách tránh: deploy jobs bằng tay trước khi merge:
   ```bash
   pnpm --filter @hoiminh/jobs exec wrangler deploy
   ```
   Bản jobs mới đọc được cả tin do api cũ gửi (`event.remind`, `post.broadcast`, `webhook.deliver`), nên thứ tự này an toàn. Nếu lỡ để api lên trước: tin bị mất tự lành nhờ bộ quét (chậm tối đa khoảng 25 phút); sau khi jobs lên có thể ép chạy ngay bằng
   ```sql
   update scheduled_jobs set status = 'pending' where status = 'enqueued' and run_at < now() - interval '5 minutes';
   ```
   (cron phút cũ còn chạy nên sẽ nhặt các dòng `pending` này).
3. Consumer mới cho `hoiminh-jobs-dlq` và `max_concurrency = 10` nằm trong `apps/jobs/wrangler.toml`; `wrangler deploy` áp cả hai. Sau deploy, xem trong Cloudflare, Queues, `hoiminh-jobs-dlq`, tab Consumers có `hoiminh-jobs`.

## 1. Trạng thái sau khi deploy Phase 0 tới 4 (chạy song song)

- **Đường mới:** ghi `scheduled_jobs`, đẩy vào Queue sau commit (delay ≤ 24 giờ), bộ quét `*/10` đẩy job xa và cứu tin mất.
- **Đường cũ còn nguyên làm lưới:** cron `* * * * *` vẫn chạy `runScheduledJobs`, `scheduleEventReminders` (quét), `expirePendingOrders`, `retryDue`. Cả hai đường idempotent (claim có điều kiện, cùng `dedupeKey`, khoá dòng webhook, `job_recipients`), nên chạy song song không gửi trùng.
- Việc cần thấy ngay sau deploy: log `sweep.done` mỗi 10 phút; welcome DM tới đúng giờ (không chờ cron); xoá tệp R2 xong trong vài giây.

## 2. Quan sát 7 ngày (Phase 5)

Mỗi ngày xem các mục sau. Tiêu chí qua cổng ở mục 3.

### Log (Cloudflare, Workers, `hoiminh-jobs`, Logs)

| Tìm | Kỳ vọng | Ý nghĩa nếu khác |
|---|---|---|
| `job.dead_letter` | 0 | có job hết lượt retry: đọc `job.name`, `error`, sửa nguyên nhân |
| `queue.flush_failed` | 0 hoặc rất hiếm | Queue từ chối gửi sau commit; bộ quét đã cứu, nhưng cần biết vì sao |
| `sweep.requeue` | 0 | Queue mất tin (đang xảy ra thì cần điều tra). Vài dòng ngay sau deploy là bình thường |
| `sweep.done` với `requeued > 0` ba lần liên tiếp | không có | Queue hoặc consumer có vấn đề kéo dài |
| `job.stale` | có, lý do `rescheduled`/`event_cancelled` | bình thường: sửa giờ hoặc huỷ sự kiện |
| `job.retry` | thấp, không tăng dần | lỗi tạm thời; tăng dần là dấu hiệu Postgres hoặc nhà cung cấp có vấn đề |
| Không có `sweep.done` quá 30 phút | không xảy ra | cron `*/10` chết |

### SQL (Supabase, chỉ đọc)

```sql
-- Job quá hạn mà chưa chạy (kỳ vọng 0 dòng, hoặc chỉ dòng mới trong vài phút)
select status, count(*), min(run_at) from scheduled_jobs
where status in ('pending','enqueued') and run_at < now() - interval '15 minutes' group by status;

-- Job thất bại hẳn (kỳ vọng 0)
select kind, count(*), max(last_error) from scheduled_jobs where status = 'failed' and created_at > now() - interval '7 days' group by kind;

-- Đơn pending đã quá hạn mà cờ chưa được dọn (kỳ vọng 0; bộ quét chạy mỗi 10 phút)
select count(*) from orders where status = 'pending' and expires_at < now() - interval '15 minutes';

-- Webhook đã quá hạn retry mà chưa được giao (kỳ vọng 0)
select count(*) from webhook_deliveries where status in ('pending','failed') and next_attempt_at < now() - interval '15 minutes';

-- Email nhắc/broadcast bị gửi trùng cho cùng một người trong 7 ngày (kỳ vọng 0 dòng)
select to_email, subject, template, count(*) from email_logs
where template in ('event_reminder','broadcast_post') and created_at > now() - interval '7 days'
group by to_email, subject, template having count(*) > 1;
```

Truy vấn email trùng có thể báo nhầm nếu một sự kiện có hai mốc nhắc cùng tiêu đề (`1h` và `start` cùng subject). Khi thấy dòng, so `created_at` của hai email: trùng thật thì cách nhau vài giây, còn hai mốc khác nhau thì cách nhau đúng bằng chênh lệch mốc.

Thông báo trong ứng dụng (bảng `notifications`, `kind = 'event.reminder'`) không thể trùng theo (sự kiện, mốc, người) vì `job_recipients` có khoá chính `(job_key, user_id)`.

### Việc cần người xử lý

**Job `failed`** (hết chuỗi retry, đã có cảnh báo `job.dead_letter`): đọc `last_error`, sửa nguyên nhân (ví dụ R2 hoặc DB hồi phục), rồi đặt lại để bộ quét đẩy chạy tiếp trong tối đa 10 phút:

```sql
update scheduled_jobs set status = 'pending', created_at = now() - interval '5 minutes'
where status = 'failed' and kind = 'file.delete';  -- đổi kind theo job cần chạy lại
```

**Giới hạn gửi email:** `max_concurrency = 10` cho phép tới 10 lô (mỗi lô 100 email gửi tuần tự) chạy cùng lúc. Nếu tài khoản Resend có giới hạn số request mỗi giây thấp, một phần email của lô lớn sẽ bị từ chối. `ResendSender.send` không ném lỗi mà trả `failed` và ghi vào `email_logs`, nên người đó **không được gửi lại** (đã claim). Sau mỗi đợt gửi lớn, xem `select status, count(*) from email_logs where created_at > now() - interval '1 hour' group by status;`. Nếu thấy nhiều `failed`, hạ `max_concurrency` hoặc chuyển sang API gửi theo lô của Resend. Hành vi "không gửi lại email lỗi" đã có từ trước refactor.

### Cảnh báo nên đặt

| Điều kiện | Ngưỡng |
|---|---|
| `job.dead_letter` | ≥ 1 |
| `sweep.done` có `requeued > 0` | 3 lần liên tiếp |
| Không có `sweep.done` | 30 phút |
| Backlog của `hoiminh-jobs` | tăng liên tục 15 phút (dashboard Queues) |

## 3. Qua cổng để làm Phase 6

Đủ cả bốn điều kiện trong **7 ngày liên tục** (tính từ lần deploy cuối của Phase 0 tới 4):

1. `job.dead_letter` = 0 (hoặc mọi dòng đã được điều tra và sửa).
2. `sweep.requeue` = 0 ngoài cửa sổ deploy.
3. Các truy vấn SQL ở trên đều ra 0 dòng.
4. Không có báo cáo người dùng về nhắc sự kiện, email hay webhook trùng hoặc trễ.

Chưa đạt thì **không** làm Phase 6; sửa nguyên nhân rồi tính lại 7 ngày.

## 4. Phase 6: gỡ cron phút

Nhánh `claude/jobs-phase6-remove-minute-cron` (chồng lên nhánh Phase 0 tới 4). Nội dung:

- `apps/jobs/wrangler.toml`: `crons = ["*/10 * * * *", "0 18 * * *"]`.
- Gỡ `'every_minute'` khỏi `CronName`, `worker.ts`, `apps/api/src/node.ts`.
- Gỡ `runScheduledJobs`, `scheduleEventReminders` (bản quét), `retryDue` và phần liên quan của cron.
- Bộ quét `*/10` thay đúng vai trò của chúng; cron hằng ngày thêm bước `reconcileEventReminders` (đối soát nhắc cho sự kiện trong 3 ngày tới mà chưa có job). Bước này cần vì sự kiện tạo trước Phase 2 không có job nhắc: trước đây bản quét cũ nhặt chúng, gỡ bản quét mà không đối soát thì các sự kiện đó mất nhắc.

Sau khi merge và deploy, cron `* * * * *` được gỡ khỏi Worker. Kiểm tra trên Cloudflare, Workers, `hoiminh-jobs`, Triggers: chỉ còn hai cron.

### Rollback

Revert commit Phase 6 rồi deploy lại: cron phút và code quét cũ quay lại, đường Queue vẫn chạy song song như Phase 5. Không cần khôi phục dữ liệu vì migration chỉ thêm.
