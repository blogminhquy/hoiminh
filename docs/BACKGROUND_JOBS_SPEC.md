# Hội Mình — Spec Background Jobs Event-Driven (v2)

**Trạng thái:** Đã triển khai (Phase 0 tới 6, phát hành 1.11.0) · **Ngày:** 2026-09-30 · **Thay cho:** bản spec đầu (đã đối chiếu với code, các chỗ sai lệch nêu ở mục 1)
**Phạm vi:** `apps/jobs`, `apps/api`, `packages/core/src/jobs`, các service: webhook ra ngoài, sự kiện, thanh toán/đơn, file, bài viết. Không đổi logic nghiệp vụ.

## 0. Tóm tắt

Bỏ cron mỗi phút bằng cách: mọi việc được ghi vào DB (sổ gốc) rồi đẩy vào Cloudflare Queue **sau khi transaction commit**; việc hẹn giờ ≤ 24 giờ dùng `delaySeconds` của Queue; việc hẹn xa hơn nằm ở DB chờ một bộ quét thưa (mỗi 10 phút, dùng cron `*/10` đã có) đưa vào Queue khi còn ≤ 24 giờ. Đúng/sai nghiệp vụ (hết hạn đơn, nhắc sự kiện) không phụ thuộc cron. **Không thêm Workflow hay Durable Object** ở giai đoạn này.

**Nguyên tắc chốt**

1. DB là sổ gốc, Queue là đường chạy nhanh. Mất tin trong Queue thì bộ quét thưa cứu lại.
2. Chỉ đẩy vào Queue **sau commit**, không đẩy giữa transaction.
3. Mọi handler idempotent bằng điều kiện trong DB. Queue giao ít nhất một lần và không tự khử trùng.
4. Việc gửi cho nhiều người phải chia lô và ghi nhận từng người, để retry không gửi trùng.
5. Việc nền có trần đồng thời, có index, có giới hạn lô: nghẽn khi đông người là Postgres (DECISIONS #29), không phải Queue.
6. Chỉ thêm loại hạ tầng mới khi chạm ngưỡng ở mục 11.

## 1. Khác gì bản đầu

| Hạng mục | Bản đầu | Bản này | Lý do (đã kiểm với code) |
|---|---|---|---|
| Đẩy vào Queue | Không nhắc | `DeferredQueue`, đẩy sau commit | `runInScope` chỉ hoãn email, không hoãn queue (`tenant-scope.ts:76`). Hôm nay `retryDue` vá ngầm lỗ này |
| Job hẹn > 24 giờ | Workflow / Durable Object Alarm | Nằm ở DB, bộ quét `*/10` đẩy vào Queue khi còn ≤ 24 giờ | Mọi độ trễ thật ≤ 12 giờ, trừ nhắc "1 ngày trước" của sự kiện xa. Giữ 2 Worker (DECISIONS #29) |
| Hết hạn đơn | "Hết hạn thì từ chối" + job trễ mỗi đơn | Trạng thái hiệu lực khi đọc + quét thưa. **Webhook thanh toán vẫn nhận đơn trễ** | `confirmPayment` cố ý nhận payment `expired` (`payments.ts:129`): tiền đã vào thì phải cấp quyền. Hết hạn chỉ đổi cờ, không nhả kho hay mã |
| Idempotency | dedupeKey + điều kiện update | Thêm: chia lô + bảng `job_recipients` | `event.remind`, `post.broadcast` gửi tuần tự cho cả danh sách trong một message; retry là gửi lại từ đầu |
| Sửa giờ sự kiện | version | dedupeKey gắn giờ bắt đầu + kiểm tra khi chạy | Hôm nay `onConflictDoNothing` giữ giờ nhắc cũ; sự kiện huỷ vẫn nhắc |
| Retry webhook | Queue delay | Giống, nhưng **lỗi HTTP của khách không ném ra consumer** | Tránh nhân hai tầng retry (lịch 5 lần × `max_retries=5` = tới 25 lần) |
| DLQ | "Alert khi > 0" | Thêm consumer cho `hoiminh-jobs-dlq` | DLQ đã khai báo (`wrangler.toml:50`) nhưng chưa ai đọc |
| Trạng thái sự kiện | Không nhắc | Tính khi đọc + quét thưa | Cron phút đang đổi `live`/`ended` (`cron.ts:88`) |
| Claim job | Không nhắc | Claim chạy trong chính transaction của job | Claim khóa dòng nên message trùng chạy lần lượt. Job lỗi thì transaction hoàn tác, dòng tự trở về trạng thái cũ: không cần lease, không có "job kẹt" (bản đầu của spec này nhận định sai chỗ này) |
| Thứ tự làm | Xoá cron rồi theo dõi | Chạy song song 7 ngày rồi mới xoá | Cả hai đường đều idempotent nên chạy song song an toàn |

## 2. Hiện trạng đã đối chiếu

| Thành phần | Nơi | Hiện tại | Vấn đề |
|---|---|---|---|
| Cron phút | `cron.ts:21` | `runScheduledJobs`, `scheduleEventReminders`, `expirePendingOrders`, `retryDue` | Khoảng 8 lượt đi về DB mỗi phút khi rảnh, kèm một lần gọi `SHARED_ENV` sang `hoiminh-api`. Truy vấn `events` không có index phù hợp (`events_community_time_idx` dẫn đầu bằng `community_id`) |
| Queue producer | `queue.ts:16` | `enqueue(name, payload)` | Không có delay, không có dedupeKey |
| Enqueue trong transaction | `webhooks-out.ts:47`, `posts.ts:92` | Gọi giữa transaction | Consumer có thể đọc trước commit; `post.broadcast` mất im lặng (`if (!post) return`) |
| Consumer | `apps/jobs/src/worker.ts:21` | Mọi lỗi `retry(60s)`; `attempt` luôn 0 | Không phân loại lỗi. `switch` ở `handlers.ts` không có `default`: tên job lạ bị ack và mất |
| Webhook ra ngoài | `webhooks-out.ts:11,86` | Backoff `[1,5,30,120,720]` phút lưu DB, `retryDue` quét | Chuyển sang Queue delay |
| Nhắc sự kiện | `cron.ts:72`, `handlers.ts:60` | Quét sự kiện trong 25 giờ, dedupe theo (sự kiện, nhãn) | Xem mục 1 |
| Hết hạn đơn | `payments.ts:232`, `checkout.ts:111` | Cron cập nhật hàng loạt; `orderStatus` trả `status` thô | Đơn quá hạn vẫn hiện `pending` tới lần cron |
| Xoá file | `files.ts:103` | Ghi `scheduled_jobs` cùng transaction, cron xoá R2 | Đây là outbox đúng. Giữ, chỉ đổi cách kích hoạt |

## 3. Kiến trúc đích

```
Hành động người dùng / webhook cổng thanh toán
        │
   Service (trong transaction)
        │  ghi DB: scheduled_jobs / webhook_deliveries ...        ← sổ gốc
        │  ctx.queue.enqueue(...)  → DeferredQueue giữ lại
        ▼
     COMMIT ── rollback thì bỏ hết, không gửi gì
        │
        ▼  flush sau commit (lỗi chỉ log, không làm hỏng request)
 Cloudflare Queue `hoiminh-jobs` ◄── bộ quét: đẩy dòng DB còn ≤ 24 giờ
        │  delaySeconds ≤ 86400
        ▼
 hoiminh-jobs (consumer, max_concurrency = 10)
        │  lỗi vĩnh viễn: ack + log · hết retry: DLQ
        ▼
 `hoiminh-jobs-dlq` ─► consumer DLQ: log lỗi có cấu trúc + đánh dấu `failed`

 Cron: `*/10` = leaderboard + bộ quét · `0 18 * * *` = như cũ · KHÔNG còn cron phút
```

| Loại việc | Ví dụ | Cách chạy |
|---|---|---|
| Ngay | lần giao webhook đầu, `post.broadcast`, xoá file | enqueue không delay, sau commit |
| Hẹn ≤ 24 giờ | retry webhook, welcome DM, nhắc 1h / 15m / lúc bắt đầu | ghi `scheduled_jobs` + enqueue `delaySeconds` sau commit |
| Hẹn > 24 giờ | nhắc "1 ngày trước" của sự kiện xa | chỉ ghi `scheduled_jobs` (`pending`); bộ quét đẩy khi còn ≤ 24 giờ |
| Định kỳ | leaderboard, hold hoa hồng, churn, billing | cron như cũ |
| Đúng/sai nghiệp vụ | hết hạn đơn, trạng thái sự kiện | tính khi đọc; bộ quét chỉ dọn cờ |

## 4. Nền tảng (Phase 0)

### 4.1 `DeferredQueue`

- Lớp `DeferredQueue implements JobQueue` trong `queue.ts`, cùng kiểu `DeferredSender`: `enqueue` chỉ giữ, `flush()` sau commit, `discard()` khi rollback.
- `runInScope` (`tenant-scope.ts`) thay `queue` trong ctx bằng `DeferredQueue`, flush cùng chỗ với `email.flush`. Áp cho cả `withTenantScope` và `withSystemScope`.
- Flush lỗi: log `queue.flush_failed`, **không** làm request thất bại. Dòng DB đã có nên bộ quét sẽ đẩy lại (xem 4.3).

### 4.2 Hợp đồng enqueue

```ts
enqueue(name, payload, opts?: { delaySeconds?: number; dedupeKey?: string })
Job = { name, payload, attempt, dedupeKey? }
```

- `delaySeconds` chỉ nhận 0..86400. Lớn hơn là lỗi lập trình: người gọi phải để việc đó ở DB.
- `CloudflareQueue` gọi `binding.send(body, { delaySeconds })`. `InMemoryQueue` hỗ trợ delay và cho test đọc danh sách job đang hẹn.
- `dedupeKey` chỉ là nhãn để log và làm khoá DB. Khử trùng thật nằm ở DB (mục 6).

Thay đổi `JobMap`:

| Job | Payload | Ghi chú |
|---|---|---|
| `scheduled.run` (mới) | `{ jobId }` | chạy một dòng `scheduled_jobs` theo `kind` |
| `event.remind.batch` (mới) | `{ eventId, label, jobKey, userIds[] }` | một lô ≤ 100 người; là **dòng `scheduled_jobs`** (bền vững), không phải message trần |
| `post.broadcast.batch` (mới) | `{ postId, userIds[] }` | một lô ≤ 100 người; cũng là dòng `scheduled_jobs` |
| `event.remind`, `post.broadcast` | như cũ | thành job cha chia lô. Cả hai nay cũng là dòng `scheduled_jobs` (`post.broadcast` ghi khi đăng bài, khóa `post-broadcast:{postId}:parent`); tên message trần vẫn được xử lý để tin đang bay lúc deploy không mất |

### 4.3 Migration `0004`

| Thay đổi | Lý do |
|---|---|
| `scheduled_jobs`: thêm `enqueued_at` (timestamptz, null); `status` thêm `enqueued` | phân biệt chưa đẩy / đã đẩy; bộ quét không đẩy lại dồn dập |
| Bảng mới `job_recipients (job_key text, user_id uuid, created_at, PK(job_key, user_id))` | khử trùng gửi theo từng người |
| Index `events_active_end_idx` trên `events(ends_at)` `WHERE status IN ('scheduled','live')` | bước quét trạng thái sự kiện |
| Index `events_scheduled_start_idx` trên `events(starts_at)` `WHERE status = 'scheduled'` | như trên |
| Index `orders_pending_expiry_idx` trên `orders(expires_at)` `WHERE status = 'pending'` | bước quét hết hạn đơn |

Giữ nguyên: `scheduled_jobs_due_idx (status, run_at)`, `scheduled_jobs_dedupe_uq`, `webhook_deliveries_pending_idx (status, next_attempt_at)`.

**Vòng đời một dòng `scheduled_jobs`:** helper `scheduleJob()` ghi dòng `pending` trong transaction và đăng ký đẩy sau commit. Đẩy xong thì cập nhật `enqueued` (best-effort). Nếu Worker chết giữa commit và flush, dòng vẫn `pending` nên bộ quét đẩy lại trong ≤ 10 phút.

### 4.4 Consumer chuẩn (`apps/jobs/src/worker.ts`)

- `max_concurrency = 10` trong `wrangler.toml`. Đây là trần bảo vệ Postgres, tăng dần theo số đo. Mở app một lần cho mỗi batch như hiện tại.
- Lỗi vĩnh viễn (`PermanentJobError`: payload sai, thực thể mất, trạng thái không hợp lệ): ack, log `job.dropped`, không retry.
- Lỗi tạm thời (timeout, 429, 5xx, mạng, DB): `msg.retry({ delaySeconds })` theo `msg.attempts`, lịch `[60, 300, 900, 3600]`, hết `max_retries` thì vào DLQ.
- Tên job không nhận ra, và `kind` của dòng `scheduled_jobs` không nhận ra: **ném lỗi tạm thời** (không ack, không đánh dấu failed). Nhờ vậy khi `hoiminh-api` deploy trước `hoiminh-jobs`, tin của job mới không bị mất.
- Log có cấu trúc cho mỗi job (mục 10).

### 4.5 DLQ

Thêm consumer cho `hoiminh-jobs-dlq` trong `hoiminh-jobs`: log `job.dead_letter` (tên job, jobId/dedupeKey, lỗi), đánh dấu dòng `scheduled_jobs` tương ứng `failed`, rồi ack. Cảnh báo dựa trên log. **`failed` là trạng thái kết thúc, không tự thử lại**: hết chuỗi retry (khoảng 2,35 giờ) mà phụ thuộc (R2, DB) vẫn hỏng thì cần người xem. Sửa xong thì đặt lại `pending` (xem tài liệu rollout) và bộ quét đẩy chạy tiếp. Tự thử lại mãi sẽ che lỗi thật và dồn tải lên phụ thuộc đang chết.

## 5. Bộ quét thưa `runSweep(ctx)`

Chạy trong cron `*/10 * * * *`, cùng leaderboard. Mỗi bước duyệt theo con trỏ `(thời điểm, id)`, 200 dòng mỗi trang, tối đa 5 trang (1.000 dòng) mỗi lần chạy; phần còn lại để lần sau. Không lặp lại cùng điều kiện trong một lần chạy vì trạng thái `enqueued` chỉ được ghi sau commit.

| # | Bước | Điều kiện | Hành động |
|---|---|---|---|
| 1 | Đẩy job sắp tới hạn | `scheduled_jobs` `pending`, `run_at <= now() + 24h`, `created_at < now() - 1 phút` | enqueue `scheduled.run` với `delaySeconds = max(0, run_at - now)` |
| 2 | Cứu tin đã mất | `enqueued`, `run_at` và `enqueued_at` đều cũ hơn 30 phút | enqueue lại (handler khử trùng); log `sweep.requeue`. Ngưỡng 30 phút để không chen vào chuỗi retry còn đang chạy của Queue (1, 5, 15, 60 phút) |
| 3 | Webhook lọt | `webhook_deliveries` `pending`/`failed`, `next_attempt_at < now() - 5 phút` | enqueue `webhook.deliver` |
| 4 | Hết hạn đơn | `orders` `pending`, `expires_at < now()` | giữ `expirePendingOrders` |
| 5 | Trạng thái sự kiện | `scheduled → live → ended` | giữ 2 câu UPDATE hiện có, có index mới |

Chi phí khi rảnh: 144 lần chạy mỗi ngày, mỗi lần vài truy vấn có index, thay cho 1.440 lần × khoảng 8 lượt đi về DB.

**Độ trễ xấu nhất khi Queue mất tin:** tối đa khoảng 40 phút sau giờ hẹn (`run_at` + độ trễ của bước 2 + chu kỳ quét). Chấp nhận được vì đây là đường lỗi của lỗi; đường bình thường đúng từng phút nhờ `delaySeconds`.

## 6. Idempotency

| Job | Khoá khử trùng | Cơ chế |
|---|---|---|
| `scheduled.run` | `scheduled_jobs.dedupe_key` (unique) | claim `UPDATE ... SET status='running', attempts=attempts+1 WHERE id=? AND status IN ('pending','enqueued')` trong transaction của job (khóa dòng); 0 dòng thì bỏ qua |
| `webhook.deliver` | `webhook_deliveries.id` | khoá dòng `SELECT ... FOR UPDATE SKIP LOCKED` trong transaction của job: message trùng chạy đồng thời thì bỏ qua thay vì cùng POST; bỏ qua cả message tới sớm (`next_attempt_at` còn ở tương lai). Bên nhận khử trùng bằng header `X-HoiMinh-Delivery` |
| Nhắc sự kiện | `event-remind:{eventId}:{label}:{floor(startsAt/60000)}` | job cha + lô; từng người claim qua `job_recipients` |
| `post.broadcast` | `post-broadcast:{postId}` | như trên, lô 100 |
| Hết hạn đơn | không cần | `WHERE status='pending' AND expires_at < now()`, 0 dòng là no-op |
| Xoá file | `file.delete:{objectKey}` | `media.delete` idempotent |
| Welcome DM | `welcome_dm:{communityId}:{userId}` | như cũ |

**Gửi theo từng người:** `INSERT INTO job_recipients ... ON CONFLICT DO NOTHING RETURNING`. Có dòng trả về thì mới thông báo và gửi email; không có thì bỏ qua. Chọn "claim trước, gửi sau": nếu chết giữa chừng thì sót một người, không gửi trùng.

## 7. Đặc tả từng luồng

### 7.1 Webhook ra ngoài

- `dispatch()`: chèn delivery (`next_attempt_at = now`) rồi enqueue qua `DeferredQueue`.
- `deliver()` thất bại: cập nhật DB như hiện tại (`attempt`, `next_attempt_at`, `status`), rồi `enqueue('webhook.deliver', { deliveryId }, { delaySeconds: BACKOFF_MINUTES[attempt-1] * 60 })`. Lớn nhất 720 phút = 12 giờ, nằm trong giới hạn 24 giờ.
- Hết lượt (5) thì `exhausted`, không enqueue. Sau 20 lỗi liên tiếp thì webhook `paused` (giữ nguyên).
- Lỗi HTTP hay timeout của khách là **kết quả nghiệp vụ**, không ném ra consumer. Chỉ lỗi hạ tầng của mình (DB) mới ném để Queue retry.
- Bỏ `retryDue` khỏi đường cron phút; logic của nó thành bước 3 của bộ quét.

### 7.2 Nhắc sự kiện

- Hàm `scheduleEventReminders(ctx, eventId)` thay hàm quét toàn bảng. Offset: `1d = 1440`, `1h = 60`, `15m = 15`, `start = 0` phút. Với mỗi nhãn trong `event.reminders`: `runAt = startsAt - offset`, bỏ qua nếu đã qua, chèn `scheduled_jobs` (`kind='event.remind'`) với `dedupeKey` ở mục 6, `onConflictDoNothing`. Nếu `runAt - now ≤ 24h` thì đăng ký enqueue có delay.
- Gọi từ `createEvent` (mỗi buổi của chuỗi) và `updateEvent` khi đổi `startsAt`, `reminders` hoặc `status`, cùng transaction với thay đổi.
- Sửa giờ: `dedupeKey` mới nên sinh job mới; job cũ tự vô hiệu ở bước kiểm tra. **Không huỷ vật lý** job cũ.
- **Kiểm tra khi chạy (stale check):** sự kiện còn tồn tại, `status = 'scheduled'`, nhãn còn trong `reminders`, và `startsAt - offset` khớp `runAt` của job (lệch ≤ 1 phút). Sai một điều kiện thì ack no-op, log `job.stale`.
- Chia lô: job cha đọc người đăng ký chưa huỷ theo trang 100 (keyset theo `user_id`), mỗi trang thành một dòng `scheduled_jobs` kind `event.remind.batch` (bền vững: Queue lỗi sau commit thì bộ quét vẫn đẩy được lô, không ai bị bỏ sót). Mỗi người claim qua `job_recipients`, rồi mới `notify` và gửi email.

### 7.3 Hết hạn đơn

- Hàm `effectiveOrderStatus(order, now)`: `pending` mà `expiresAt < now` thì coi là `expired`. Dùng trong `orderStatus` (`checkout.ts:111`) và các hành động khách tự khởi tạo: `markProcessing` không ghi nhận gì và trả về trạng thái `expired`: giao diện Checkout đã hiện "Đơn đã hết hạn" từ `status`, còn ném lỗi thì nút chỉ ngừng quay mà không báo gì (mutation không có `onError`). Trạng thái thanh toán chưa xong của đơn hết hạn cũng trả `expired`.
- **Không áp cho webhook thanh toán.** `confirmPayment` vẫn nhận thanh toán đến sau hạn và chuyển đơn sang `paid`. Có test khoá hành vi này.
- **Không tạo job trễ cho từng đơn.** Hết hạn chỉ đổi cờ (không nhả kho, mã giảm giá hay quyền), và đa số đơn bị bỏ dở nên mỗi đơn sẽ tốn một message cộng một lần đọc DB. Bộ quét bước 4 dọn cờ mỗi 10 phút.
- Chấp nhận: các danh sách quản trị đọc cột `status` có thể lệch tối đa 10 phút so với thực tế.

### 7.4 `scheduled_jobs` chung

- `scheduleJob(ctx, { kind, payload, dedupeKey, runAt })` như mô tả ở 4.3.
- Handler `scheduled.run`: claim (mục 6), chạy theo `kind` (`welcome_dm.send`, `event.remind`, `file.delete`), đánh dấu `done`. Lỗi tạm thời thì nhả lock về `enqueued` và ném để Queue retry theo lịch; hết `max_retries` thì consumer DLQ đánh dấu `failed`. Tách thân `runScheduledJobs` hiện tại thành `runScheduledJob(ctx, id)`.
- Xoá file: vẫn ghi `scheduled_jobs` cùng transaction với việc gỡ tham chiếu, `runAt = now`. Nhờ `DeferredQueue`, R2 chỉ bị xoá **sau commit**; rollback thì không xoá gì. Cập nhật chú thích `files.ts:56`.
- Welcome DM: `runAt = now + delayMinutes` (cấu hình của plugin), thường vài phút.

### 7.5 Trạng thái sự kiện

- `effectiveEventStatus(e, now)`: `cancelled` giữ nguyên; trước `startsAt` là `scheduled`; trong khoảng `startsAt..endsAt` là `live`; sau đó là `ended`.
- Cột `status` do bộ quét bước 5 cập nhật để lọc và báo cáo. `endEvent` giữ nguyên.
- Lúc soạn spec, tìm `status === 'live'` trong `apps` và `packages` không ra chỗ nào, nên rủi ro thấp. Phase 3 phải grep lại trước khi bỏ cron.

## 8. Cron sau refactor

| Cron | Trước | Sau |
|---|---|---|
| `* * * * *` | job hẹn giờ, nhắc sự kiện, hết hạn đơn, retry webhook | **Xoá** |
| `*/10 * * * *` | snapshot xếp hạng | snapshot xếp hạng + `runSweep` |
| `0 18 * * *` | hold hoa hồng, churn, entitlement, upload dở, billing | như cũ + dọn `job_recipients` (30 ngày) và `scheduled_jobs` (`done` 30 ngày, `failed` 90 ngày; không bao giờ xoá `pending`/`enqueued`) |

Đổi kèm: bỏ `'every_minute'` khỏi `CronName`; `worker.ts:28` và `wrangler.toml` cập nhật; `apps/api/src/node.ts` (dev) bỏ interval phút vì `InMemoryQueue` đã có delay. Các test gọi `runCron(..., 'every_minute')` (`api.test.ts:227,238,244`, `flows.test.ts:261`) chuyển sang `runSweep` hoặc `queue.drain()`.

## 9. Chính sách retry

| Loại | Lịch | Nơi giữ | Kết thúc |
|---|---|---|---|
| Giao webhook cho khách | 1, 5, 30, 120, 720 phút (5 lần) | DB + Queue delay | `exhausted`; `paused` sau 20 lỗi liên tiếp |
| Job nội bộ lỗi tạm thời | 1, 5, 15, 60 phút | `msg.retry` | DLQ sau `max_retries = 5` |
| `scheduled.run` | như trên, nhả lock khi lỗi | Queue | `failed` do consumer DLQ |
| Lỗi vĩnh viễn | không retry | — | ack + log `job.dropped` |

## 10. Quan sát

Log JSON cho mỗi job: `job.name`, `job.id`, `job.attempt` (lấy từ `msg.attempts`), `job.dedupeKey`, `job.durationMs`, `job.status` (`ok` / `stale` / `skipped` / `retry` / `dropped` / `dead`), `workspaceId`, `communityId`, `error.type`.

Sự kiện log cố định: `job.done`, `job.stale`, `job.retry`, `job.dropped`, `job.dead_letter`, `queue.flush_failed`, `sweep.done` (`pushed`, `requeued`, `unlocked`, `webhookRequeued`, `ordersExpired`, `eventsFlipped`, `durationMs`).

| Cảnh báo | Ngưỡng |
|---|---|
| `job.dead_letter` | ≥ 1 |
| `sweep.requeued > 0` | 3 lần chạy liên tiếp (Queue đang mất tin) |
| Không có `sweep.done` | quá 30 phút (cron chết) |
| Dòng `scheduled_jobs` quá hạn còn `pending`/`enqueued` | quá 30 phút |
| Backlog Queue | tăng liên tục 15 phút |
| Webhook `exhausted` | tăng đột biến |

Số đo để theo dõi: độ sâu Queue, số job xử lý mỗi phút, số retry, p50/p95/p99 thời lượng job, CPU của Worker, số lần chạy cron mỗi ngày (kỳ vọng 144 + 1).

## 11. Đường mở rộng

| Điểm nghẽn | Đã có trong spec | Khi nào cần thêm |
|---|---|---|
| Kết nối Postgres | `max_concurrency = 10`, mở app một lần mỗi batch, Hyperdrive | tăng dần theo p95 truy vấn |
| Hội rất đông người | lô 100, `job_recipients` | dùng API gửi theo lô của nhà cung cấp email |
| Broadcast chặn việc gấp | — | tách queue riêng `hoiminh-jobs-bulk` khi p95 thời gian chờ của webhook/thanh toán > 1 phút |
| `scheduled_jobs` phình | index `(status, run_at)`, dọn hằng ngày | phân vùng theo tháng khi bảng đủ lớn để dọn hằng ngày không kịp |
| Bộ quét chậm | giới hạn 200 dòng × 5 vòng | tăng tần suất hoặc tách theo `kind` |

**Ngưỡng cân nhắc Workflow / Durable Object:** có quy trình từ 3 bước trở lên với thời gian chờ > 24 giờ giữa các bước và cần trạng thái từng bước; hoặc cần đánh thức chính xác từng giây theo từng thực thể mà quét 10 phút không đáp ứng. Khi đó chia theo workspace/community, không dùng một Durable Object toàn cục.

## 12. Kế hoạch triển khai

Mỗi phase là một PR nhỏ, theo quy trình đồng bộ GitHub trong `CLAUDE.md`. Thứ tự deploy giữ nguyên: `hoiminh-api` trước, `hoiminh-jobs` sau (an toàn nhờ 4.4: tên job lạ thì retry, không ack).

| Phase | Nội dung | File chính | Qua cổng khi | Rollback |
|---|---|---|---|---|
| 0 | Nền tảng: `DeferredQueue`, tham số delay, migration 0004, consumer chuẩn, DLQ consumer, `InMemoryQueue` có delay, `runSweep` (chưa nối cron) | `queue.ts`, `tenant-scope.ts`, `worker.ts`, `wrangler.toml`, `cron.ts`, schema | test hiện có pass, hành vi không đổi | revert PR (migration chỉ thêm) |
| 1 | Webhook retry qua Queue delay + claim có điều kiện | `webhooks-out.ts` | test webhook mục 13 pass; cron phút vẫn còn làm lưới | bỏ delay, cron lo |
| 2 | Nhắc sự kiện + chia lô; `post.broadcast` chia lô | `events.ts`, `cron.ts`, `handlers.ts`, `posts.ts` | test sự kiện pass | như trên |
| 3 | Đơn: trạng thái hiệu lực + bước quét hết hạn; trạng thái sự kiện | `checkout.ts`, `payments.ts` | test đơn pass, grep `status === 'live'` sạch | như trên |
| 4 | `scheduled.run`: welcome DM, xoá file | `events/handlers.ts`, `files.ts`, `cron.ts` | test file-cleanup pass | như trên |
| 5 | **Chạy song song 7 ngày**: đường mới cùng cron phút cũ | — | không email/nhắc/webhook trùng; `sweep.requeued = 0` | — |
| 6 | Xoá `* * * * *`, `'every_minute'`, code quét cũ, tên job cũ | `wrangler.toml`, `cron.ts`, `node.ts` | 7 ngày sạch | thêm lại một dòng cron |

Cũng cập nhật `DECISIONS.md`: mục #18 (welcome DM dùng "cron mỗi phút") và thêm một mục ghi quyết định này.

## 13. Kế hoạch test

| Nhóm | Ca | Khẳng định |
|---|---|---|
| `DeferredQueue` | commit / rollback / flush lỗi | commit thì message ra; rollback thì không; flush lỗi thì request vẫn thành công và dòng còn `pending` để bộ quét đẩy lại |
| Sự kiện | tạo | có job cho từng nhãn còn ở tương lai; nhãn đã qua bị bỏ; nhãn > 24 giờ chỉ nằm ở DB |
| | sửa `startsAt` | job cũ ra `job.stale` và không gửi; job mới đúng giờ |
| | huỷ hoặc xoá | job chạy là no-op |
| | giao trùng, hoặc lỗi giữa lô rồi retry | mỗi người đúng một email (`job_recipients`) |
| Webhook | thất bại | enqueue với `delaySeconds` đúng bậc backoff |
| | thành công ở lần retry | dừng, không enqueue thêm |
| | lần thứ 5 thất bại | `exhausted`, không enqueue |
| | hai message cùng `deliveryId` chạy đồng thời | đúng một lần POST |
| Đơn | quá hạn, cron chưa chạy | `orderStatus` trả `expired`; `markProcessing` bị từ chối |
| | webhook thanh toán đến sau hạn | đơn vẫn `paid`, quyền vẫn được cấp |
| | quét | đơn quá hạn thành `expired`; đơn `paid` trước hạn là no-op; chạy quét hai lần vẫn an toàn |
| Consumer | lỗi tạm thời | `retry` với delay theo `msg.attempts` |
| | `PermanentJobError` | ack, không retry |
| | tên job lạ | retry, không ack |
| | message trùng | kết quả nghiệp vụ không đổi |
| Bộ quét | `pending` ≤ 24 giờ / > 24 giờ | đẩy / không đẩy |
| | `enqueued` quá hạn 30 phút | đẩy lại |
| | mất tin do giả lập lỗi Queue | job vẫn chạy trong ≤ 40 phút |
| Cấu hình | `wrangler.toml` của jobs | đúng hai dòng cron |

Hạ tầng test: `InMemoryQueue` có delay và dùng đồng hồ giả qua `ctx.now()`; chuyển các test đang gọi `runCron(..., 'every_minute')` (mục 8).

## 14. Tiêu chí nghiệm thu

1. `crons = ["*/10 * * * *", "0 18 * * *"]`.
2. Khi rảnh: tối đa 145 lần chạy cron mỗi ngày; mọi truy vấn của bộ quét dùng index (`EXPLAIN` không quét tuần tự bảng lớn).
3. Đường cron không còn `retryDue`, `scheduleEventReminders` bản quét toàn bảng, `runScheduledJobs`.
4. Sửa giờ hoặc huỷ sự kiện không tạo lời nhắc sai giờ.
5. Thanh toán đến sau hạn vẫn cấp quyền.
6. Mất tin Queue được cứu trong ≤ 40 phút (test giả lập).
7. Bảy ngày chạy song song không có email, lời nhắc hay webhook trùng.
8. Có consumer DLQ và đã thử bắn một cảnh báo thật.
9. Toàn bộ test hiện có và test mới pass; typecheck của monorepo pass.
10. Độ trễ request API ở các endpoint tạo sự kiện, đăng bài, đẩy webhook không tăng đáng kể so với trước (đo trước/sau).

## 15. Ngoài phạm vi và ghi chú

- Không thêm Workflow, Durable Object hay binding mới. Không đổi cron hằng ngày và leaderboard.
- `event.remind` hiện bỏ qua `event_registrations.reminder_prefs` (mọi người nhận mọi nhãn). Có thể là lỗi nghiệp vụ; tách issue riêng, không sửa trong refactor này.
- Job `email.send` còn trong `JobMap` nhưng email đang gửi sau commit (DECISIONS #30); không đụng.
