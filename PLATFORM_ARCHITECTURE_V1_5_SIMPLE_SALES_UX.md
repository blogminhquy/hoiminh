# PLATFORM ARCHITECTURE V1
## Nền tảng Community / Membership kiểu Skool cho thị trường Việt Nam

---

# 1. Mục tiêu sản phẩm

Xây một nền tảng SaaS dạng community/membership, tương tự mô hình Skool nhưng tối ưu cho thị trường Việt Nam.

Nền tảng cho phép:

- Người dùng đăng ký tài khoản.
- Một chủ tài khoản có thể tạo nhiều community/workspace.
- Mỗi community có thể có từ vài chục đến hàng chục nghìn thành viên.
- Mỗi community có thể có khóa học, bài viết, thành viên, thanh toán, thông báo, tích hợp và automation.
- Có khả năng mở rộng lên hàng trăm nghìn đến hàng triệu tài khoản mà không phải đập lại kiến trúc lõi.
- Có API và MCP để tích hợp với hệ thống khác và cho AI thao tác nền tảng.
- Có khả năng mở rộng về sau sang mobile app, Chrome extension, AI agent và nhiều module khác.

---

# 2. Nguyên tắc kiến trúc tổng thể

Mục tiêu là:

> Thiết kế sẵn để scale lớn, nhưng không over-engineering từ ngày đầu.

Hướng triển khai:

- Modular Monolith trước.
- Một backend/service layer dùng chung.
- PostgreSQL làm database chính.
- Multi-tenant architecture.
- Cloudflare làm lớp frontend/edge/deploy.
- Supabase cung cấp PostgreSQL + Auth.
- Cloudflare R2 lưu ảnh và file.
- Video MVP dùng embed bên ngoài.
- Email hệ thống và email marketing tách riêng.
- API và MCP chỉ là các cổng truy cập khác nhau vào cùng business logic.

Không cần microservices ngay từ đầu.

---

# 3. Kiến trúc tổng quan

```text
Users
   ↓
Web App
   ↓
Cloudflare Workers / Pages
   ↓
Application Service Layer
   ↓
PostgreSQL (Supabase)
   ↓
Domain Modules
   ├── Auth
   ├── Workspace
   ├── Community
   ├── Membership
   ├── Courses
   ├── Posts
   ├── Comments
   ├── Payments
   ├── Notifications
   ├── Email
   ├── Automation
   ├── Integrations
   ├── API
   ├── MCP
   └── Admin
```

External services:

```text
Images / Files → Cloudflare R2
Video → YouTube / TikTok / Facebook / Instagram / X / Bunny / Loom
Transactional Email → Resend
Marketing Email → Customer-owned provider
Payments → SePay / VNPAY / MoMo / PayPal qua Payment Integration Layer
```

---

# 4. Multi-tenant architecture

Bản chất hệ thống là multi-tenant.

Một tài khoản có thể:

- Sở hữu nhiều workspace/community.
- Tham gia nhiều community khác nhau.
- Có vai trò khác nhau ở từng community.

Không được thiết kế kiểu:

```text
User → chỉ thuộc một Community
```

Mà phải là:

```text
User
   ↓
Membership
   ↓
Workspace / Community
```

Một user có thể:

- Owner ở Community A.
- Admin ở Community B.
- Member ở Community C.

---

# 5. Cấu trúc tenant

Đề xuất:

```text
Platform
   ↓
Account
   ↓
Workspace
   ↓
Community
```

Trong giai đoạn đầu có thể gộp Workspace và Community nếu muốn đơn giản.

Nhưng để scale sản phẩm tốt hơn nên tách khái niệm:

## Workspace

Là tài khoản tổ chức / chủ sở hữu.

Chứa:

- Billing.
- API keys.
- Integrations.
- Team.
- Subscription plan.
- Global settings.

## Community

Là một hội nhóm cụ thể.

Chứa:

- Members.
- Courses.
- Posts.
- Events.
- Permissions.
- Content.

Ví dụ:

```text
Workspace: Công ty ABC

Community 1: Khóa học Marketing
Community 2: Cộng đồng học viên VIP
Community 3: Cộng đồng Affiliate
```

---

# 6. PostgreSQL

Database chính:

> PostgreSQL

Không dùng SQLite cho production SaaS này.

SQLite chỉ phù hợp:

- Local app.
- Desktop app.
- Offline cache.
- Small embedded database.

PostgreSQL phù hợp:

- Multi-user.
- Multi-tenant.
- Hàng triệu record.
- Quan hệ phức tạp.
- Transaction.
- Index.
- Reporting.
- Partitioning.
- Replication.

---

# 7. Supabase

Supabase dùng cho:

- PostgreSQL.
- Auth.
- Database management.
- Backup.
- Basic monitoring.

Giai đoạn đầu nên dùng managed database thay vì tự host trên VPS.

Lý do:

- Ít DevOps.
- Có backup.
- Dễ scale.
- Dễ quản lý.
- Tập trung vào sản phẩm.

Nếu sau này scale lớn hoặc cần tối ưu chi phí thì có thể migrate PostgreSQL sang:

- Self-hosted Postgres.
- AWS RDS.
- Neon.
- Railway.
- Hetzner VPS.
- Dedicated DB cluster.

Schema không nên phụ thuộc quá sâu vào Supabase-specific logic.

---

# 8. Database schema cốt lõi

## users

```text
id
email
name
avatar_url
status
created_at
updated_at
```

## workspaces

```text
id
owner_user_id
name
slug
plan_id
status
created_at
updated_at
```

## workspace_members

```text
id
workspace_id
user_id
role
status
created_at
```

## communities

```text
id
workspace_id
name
slug
description
status
created_at
updated_at
```

## community_members

```text
id
community_id
user_id
role
status
joined_at
```

## courses

```text
id
community_id
title
description
status
created_at
updated_at
```

## course_modules

```text
id
course_id
title
sort_order
```

## lessons

```text
id
module_id
title
content
video_provider
video_external_id
sort_order
status
```

## lesson_progress

```text
id
lesson_id
user_id
completed
completed_at
```

## posts

```text
id
community_id
author_user_id
title
content
status
created_at
updated_at
```

## comments

```text
id
post_id
author_user_id
parent_comment_id
content
created_at
updated_at
```

## reactions

```text
id
user_id
target_type
target_id
reaction_type
created_at
```

---

# 9. Tenant isolation

Mọi bảng business quan trọng phải truy vết được tenant.

Ví dụ:

```text
workspace_id
community_id
```

Không nên dựa chỉ vào user_id.

Lý do:

- Phân quyền.
- Truy vấn.
- Billing.
- Analytics.
- Data isolation.
- Migration.
- Scaling.

Có thể dùng Row Level Security của PostgreSQL/Supabase.

---

# 10. Permissions

Nên thiết kế RBAC ngay từ đầu.

Ví dụ role:

```text
platform_super_admin
workspace_owner
workspace_admin
community_admin
moderator
instructor
member
guest
```

Permission nên tách:

```text
community.read
community.manage
member.read
member.manage
course.read
course.manage
post.create
post.moderate
billing.manage
integration.manage
api.manage
automation.manage
```

Không hard-code logic kiểu:

```text
if role == admin
```

mà nên map role → permissions.

---

# 11. Web App

Một web app duy nhất có thể phục vụ nhiều vai trò.

Sau login:

- Member thấy community.
- Owner thấy dashboard.
- Admin thấy quản trị.
- Developer thấy API/integration.

Không cần chia thành nhiều sản phẩm frontend ngay từ đầu.

Có thể chia route:

```text
/app
/admin
/developer
/super-admin
```

---

# 12. Super Admin

Super Admin dành cho đội vận hành platform.

Chức năng:

- Xem tổng user.
- Xem tổng workspace.
- Xem community.
- Xem subscription.
- Khóa/mở tài khoản.
- Kiểm tra abuse.
- Xem logs.
- Xem payment.
- Xem email health.
- Xem integration status.
- Quản lý feature flags.
- Quản lý plans.
- Quản lý quotas.
- Quản lý payment providers.
- Quản lý SePay / VNPAY / MoMo / PayPal.
- Theo dõi transactions, refunds và failed payments.
- Đối soát thanh toán.
- Kiểm tra payment webhook logs.
- Báo cáo doanh thu theo workspace/provider.

---

# 13. Developer / Integration Area

Mỗi workspace có khu developer.

Chứa:

- API keys.
- Webhooks.
- MCP.
- OAuth connections.
- Email integrations.
- Docs.
- Logs.

Ví dụ menu:

```text
Developer
├── API Keys
├── Webhooks
├── MCP
├── Integrations
└── Logs
```

---

# 14. API architecture

API không truy cập business logic riêng biệt.

Tất cả gọi chung service layer.

```text
Web App
API
MCP
Mobile App
   ↓
Service Layer
   ↓
PostgreSQL
```

Ví dụ service:

```text
createCommunity()
addMember()
createPost()
createCourse()
completeLesson()
createApiKey()
triggerAutomation()
```

---

# 15. API Key

Mỗi workspace có thể tạo nhiều API key.

Ví dụ:

```text
API Key 1: Zapier
API Key 2: Internal Agent
API Key 3: CRM
```

Mỗi key có:

```text
id
workspace_id
name
key_hash
scopes
status
expires_at
created_at
last_used_at
```

Nguyên tắc:

- Chỉ hiển thị raw key một lần.
- Database chỉ lưu hash.
- Có revoke.
- Có expiration.
- Có scopes.
- Có rate limit.
- Có logs.

---

# 16. MCP architecture

MCP là lớp dành cho AI.

MCP không truy cập database trực tiếp.

```text
AI Agent
   ↓
MCP Server
   ↓
Service Layer
   ↓
Platform
```

Ví dụ MCP tools:

```text
list_communities
create_post
add_member
create_course
get_member_progress
send_announcement
create_segment
trigger_automation
```

API và MCP dùng chung 80–90% business logic.

Khác biệt chủ yếu ở lớp giao tiếp.

---

# 17. Webhooks

Nên hỗ trợ webhook ngay từ đầu.

Ví dụ event:

```text
member.created
member.joined
member.left
course.enrolled
lesson.completed
course.completed
post.created
comment.created
payment.succeeded
payment.failed
subscription.created
subscription.cancelled
```

Webhook hỗ trợ tích hợp:

- Make.
- Zapier.
- n8n.
- CRM.
- Email.
- AI Agent.
- Systeme.
- Custom apps.

---

# 18. Event-driven architecture

Không cần Kafka hay hệ thống quá phức tạp ngay từ đầu.

Có thể dùng event queue đơn giản.

Ví dụ:

```text
member.joined
   ↓
Event Bus
   ├── Send notification
   ├── Sync email contact
   ├── Trigger webhook
   └── Analytics
```

Sau này có thể nâng cấp queue.

---

# 19. Cloudflare architecture

Đề xuất dùng Cloudflare làm lớp edge/app.

## Cloudflare Pages / Workers

Dùng cho:

- Frontend.
- API.
- Authentication routing.
- Edge logic.
- Cache.
- Rate limiting.
- Lightweight background tasks.

Cloudflare Workers scale theo request.

Không phụ thuộc số user đăng ký.

100.000 hoặc 1.000.000 user vẫn khả thi nếu:

- Query tốt.
- Database tốt.
- Có cache.
- Có rate limit.
- Có connection management.

---

# 20. VPS

VPS hiện có vẫn hữu ích.

Nhưng không cần dùng làm web server chính ở V1.

Có thể giữ VPS cho:

- Long-running jobs.
- MCP server.
- Background worker.
- Cron jobs.
- Video processing sau này.
- Custom integrations.
- Self-hosted n8n.
- Analytics pipeline.
- Internal tools.

---

# 21. Cloudflare R2

R2 dùng cho:

- Ảnh.
- File.
- Ebook.
- PDF.
- Attachments.
- Downloads.
- Course resources.

Không lưu file trực tiếp vào PostgreSQL.

Database chỉ lưu:

```text
file_id
object_key
url
mime_type
size
workspace_id
owner_user_id
created_at
```

---

# 22. Media abstraction

Nên tạo MediaProvider abstraction.

Ví dụ:

```text
MediaProvider
├── upload()
├── delete()
├── getUrl()
├── getSignedUrl()
└── getMetadata()
```

Provider hiện tại:

```text
R2
```

Sau này có thể đổi:

```text
S3
Backblaze
Wasabi
Bunny Storage
```

---

# 23. Video MVP

Không tự host video ngay.

Cho phép nhúng video từ:

- YouTube.
- TikTok.
- Facebook.
- Instagram.
- X.
- Loom.
- Bunny Stream.
- Vimeo.

User chỉ cần paste URL.

Hệ thống tự:

```text
Detect provider
↓
Extract ID
↓
Render embed
```

Database lưu:

```text
video_provider
video_external_id
video_url
```

---

# 24. Facebook video

Facebook có thể embed nếu:

- Nội dung public.
- Cho phép embed.
- Link hợp lệ.

Không cố tải file video về.

Nếu embed không được:

- Hiển thị link fallback.
- Mở Facebook trực tiếp.

---

# 25. Video hosting tương lai

Khi cần native upload:

Có 3 bước phát triển.

## Giai đoạn 1

External embed.

Chi phí gần như bằng 0.

## Giai đoạn 2

Managed video.

Ví dụ:

- Bunny Stream.
- Cloudflare Stream.
- Mux.

Managed video lo:

- Upload.
- Encoding.
- HLS.
- Adaptive bitrate.
- CDN.
- Player.
- Playback.
- Security.

## Giai đoạn 3

Tự xây pipeline video.

Ví dụ:

```text
Upload
↓
R2
↓
Queue
↓
FFmpeg transcoding
↓
HLS
↓
R2
↓
CDN
```

Chỉ nên làm khi volume đủ lớn để managed video trở nên quá đắt.

---

# 26. Email architecture

Email chia làm 2 lớp.

## Transactional Email

Platform gửi.

Ví dụ:

- Verify email.
- Reset password.
- Billing.
- System notification.
- Login/security alert.

Provider:

```text
Resend
```

Chi phí này thuộc hạ tầng platform.

## Marketing Email

Platform KHÔNG đứng ra làm provider.

Mỗi workspace tự kết nối email provider riêng.

Ví dụ:

- Mailchimp.
- Kit / ConvertKit.
- Systeme.
- Resend.
- Brevo.
- ActiveCampaign.
- GetResponse.

---

# 27. Vì sao không tự resell email marketing

Nếu mỗi tenant có hàng nghìn contact thì chi phí tăng quá nhanh.

Ví dụ:

```text
10.000 contacts
×
100 tenants
=
1.000.000 contacts
```

Ngoài ra platform phải gánh:

- Spam.
- Complaint.
- Bounce.
- Domain reputation.
- IP reputation.
- Blacklist.
- Deliverability.
- Abuse.
- Support.

Do đó không nên biến email marketing thành hạ tầng core.

---

# 28. Email Integration Layer

Platform chỉ đóng vai trò integration/automation layer.

```text
Platform
   ↓
Email Integration
   ↓
Customer Provider
```

Interface chung:

```text
EmailProvider
├── connect()
├── disconnect()
├── testConnection()
├── createContact()
├── updateContact()
├── addTag()
├── removeTag()
├── subscribe()
├── unsubscribe()
├── triggerAutomation()
└── sendEvent()
```

Adapters:

```text
MailchimpAdapter
KitAdapter
SystemeAdapter
ResendAdapter
BrevoAdapter
ActiveCampaignAdapter
```

---

# 29. Contact architecture

Platform database vẫn là source of truth.

```text
contacts
```

không phải provider bên ngoài.

Lưu mapping:

```text
contact_provider_mappings

id
contact_id
integration_id
external_contact_id
sync_status
last_synced_at
```

Như vậy đổi provider không mất data.

---

# 30. Automation

V1 không cần làm một Mailchimp thứ hai.

Có thể chỉ làm:

```text
Trigger
↓
Condition
↓
Action
```

Ví dụ:

```text
Member Joined
↓
Add tag "new-member"
↓
Sync sang Kit
↓
Kit chạy sequence
```

Sau này có thể xây visual builder.

---

# 31. Newsletter

V1:

- User tạo newsletter bên provider.
- Platform sync contacts/events.

V2:

- Cho user tạo newsletter trong platform.
- Platform gọi API provider để gửi.

Nhưng vẫn không tự host mail infrastructure.

---

# 32. Sequence

V1:

- Sequence chạy bên provider.

Platform chỉ:

- Add contact.
- Remove contact.
- Add tag.
- Trigger automation.

V2:

- Platform có automation engine riêng.
- Provider chỉ là sending layer.

---

# 33. Notification system

Ngoài email nên có in-app notification.

Ví dụ:

```text
notifications

id
user_id
workspace_id
type
title
content
read_at
created_at
```

Sau này có thể thêm:

- Push notification.
- Mobile push.
- Zalo.
- SMS.
- Telegram.

---

# 34. Billing và subscription

Workspace gắn với plan.

Ví dụ:

```text
plans
subscriptions
subscription_usage
invoices
payments
```

Plan có quota:

```text
max_communities
max_members
max_admins
max_courses
storage_limit
api_access
mcp_access
automation_limit
integration_limit
```

# 34A. Payment Infrastructure

Thanh toán phải được thiết kế như một **Payment Integration Layer**, không hard-code trực tiếp SePay, VNPAY, MoMo hay PayPal vào business logic.

Kiến trúc:

```text
Checkout / Invoice
        ↓
Payment Service
        ↓
Payment Provider Router
        ↓
┌─────────┬─────────┬─────────┬─────────┐
│ SePay   │ VNPAY   │ MoMo    │ PayPal  │
└─────────┴─────────┴─────────┴─────────┘
        ↓
Webhook / Callback
        ↓
Payment Event Processor
        ↓
Subscription / Order / Access
```

Mục tiêu:

- Có thể bật/tắt từng cổng thanh toán.
- Có thể thêm provider mới mà không sửa lõi billing.
- Một workspace có thể dùng cổng thanh toán của platform hoặc cổng riêng của họ sau này.
- Hỗ trợ thanh toán Việt Nam và quốc tế.
- Tất cả provider đi qua một interface chung.

## Payment Provider Interface

```text
PaymentProvider
├── createPayment()
├── createCheckout()
├── verifyPayment()
├── handleWebhook()
├── refundPayment()
├── getPaymentStatus()
├── cancelPayment()
└── getTransaction()
```

Adapters:

```text
SePayAdapter
VNPAYAdapter
MoMoAdapter
PayPalAdapter
```

Có thể thêm sau:

```text
StripeAdapter
PayOSAdapter
ZaloPayAdapter
BankTransferAdapter
```

---

# 34B. Vai trò của từng cổng thanh toán

## SePay

Phù hợp cho:

- Chuyển khoản ngân hàng tại Việt Nam.
- QR thanh toán.
- Đối soát giao dịch ngân hàng.
- Nhận webhook khi tiền về.
- Tự động kích hoạt đơn hàng/subscription sau khi xác nhận giao dịch.

Luồng:

```text
User chọn chuyển khoản
↓
Platform tạo payment reference
↓
Hiển thị QR / thông tin chuyển khoản
↓
Khách thanh toán
↓
SePay webhook
↓
Platform đối chiếu nội dung / số tiền
↓
payment.succeeded
↓
Kích hoạt quyền truy cập
```

## VNPAY

Phù hợp cho:

- Thanh toán nội địa.
- QR / ngân hàng / thẻ theo khả năng provider.
- Checkout redirect.
- Người dùng Việt Nam.

Luồng:

```text
Create payment
↓
Redirect VNPAY
↓
User thanh toán
↓
Return URL
+
Webhook/IPN
↓
Verify signature
↓
Update payment
```

## MoMo

Phù hợp cho:

- Ví điện tử.
- Thanh toán mobile.
- Người dùng Việt Nam.

Luồng tương tự:

```text
Create payment
↓
MoMo checkout
↓
Callback / webhook
↓
Verify
↓
Update payment status
```

## PayPal

Phù hợp cho:

- Khách quốc tế.
- Thanh toán bằng PayPal.
- Một số mô hình recurring/subscription quốc tế.

Luồng:

```text
Create PayPal order/subscription
↓
User approve
↓
Webhook
↓
Verify event
↓
Activate subscription/order
```

---

# 34C. Payment Admin

Super Admin phải có khu riêng:

```text
Admin
└── Payments
    ├── Providers
    ├── Transactions
    ├── Orders
    ├── Subscriptions
    ├── Refunds
    ├── Webhook Logs
    ├── Failed Payments
    ├── Reconciliation
    ├── Revenue Reports
    └── Payment Settings
```

## Providers

Cho phép admin:

- Bật/tắt SePay.
- Bật/tắt VNPAY.
- Bật/tắt MoMo.
- Bật/tắt PayPal.
- Cấu hình sandbox/production.
- Quản lý merchant credentials.
- Test connection.
- Chọn provider mặc định.
- Chọn provider theo quốc gia/currency.

Không hiển thị secret đầy đủ sau khi lưu.

Credentials phải encrypted.

Ví dụ:

```text
payment_provider_accounts

id
provider
scope_type
workspace_id
mode
status
credentials_encrypted
webhook_secret_encrypted
configuration
created_at
updated_at
```

`scope_type` có thể là:

```text
platform
workspace
```

Nhờ vậy sau này có thể hỗ trợ:

- Platform-owned payment account.
- BYO payment account cho từng workspace.

---

# 34D. Payments Database

Đề xuất:

```text
orders
payments
payment_attempts
payment_events
refunds
subscriptions
invoices
provider_accounts
webhook_events
```

## payments

```text
id
workspace_id
order_id
provider
provider_payment_id
amount
currency
status
payment_method
customer_user_id
paid_at
created_at
updated_at
```

Status chuẩn hóa nội bộ:

```text
pending
processing
succeeded
failed
cancelled
refunded
partially_refunded
expired
```

Không sử dụng trực tiếp status riêng của từng provider trong business logic.

Lưu raw provider status riêng nếu cần.

---

# 34E. Payment Event Architecture

Mọi cổng thanh toán phải chuyển về event chuẩn của platform.

Ví dụ:

```text
payment.created
payment.pending
payment.succeeded
payment.failed
payment.refunded
subscription.started
subscription.renewed
subscription.past_due
subscription.cancelled
```

Sau đó các module khác chỉ nghe event:

```text
payment.succeeded
    ↓
├── Activate subscription
├── Add community access
├── Create invoice
├── Send transactional email
├── Trigger webhook
├── Update analytics
└── Trigger automation
```

Như vậy module Community không cần biết khách đã trả bằng MoMo hay PayPal.

---

# 34F. Webhook Security

Payment webhook là phần bắt buộc phải làm kỹ.

Các nguyên tắc:

- Verify signature.
- Không tin dữ liệu từ return URL phía browser.
- Chỉ xác nhận thanh toán sau khi server verify.
- Idempotency.
- Chống webhook chạy trùng.
- Lưu raw event để debug.
- Retry nếu xử lý thất bại.
- Audit log đầy đủ.

Ví dụ:

```text
webhook_events

id
provider
provider_event_id
event_type
payload
signature_verified
processing_status
processed_at
created_at
```

`provider_event_id` cần unique để chống xử lý trùng.

---

# 34G. Reconciliation / Đối soát

Admin cần màn hình đối soát vì đây là SaaS thu tiền thật.

Hiển thị:

- Giao dịch provider.
- Giao dịch platform.
- Trạng thái khớp/chưa khớp.
- Số tiền.
- Phí.
- Thời gian.
- Workspace.
- Customer.
- Order.

Đặc biệt hữu ích cho SePay / chuyển khoản ngân hàng.

Có thể có trạng thái:

```text
matched
unmatched
amount_mismatch
duplicate
manual_review
```

---

# 34H. Payment Routing

Sau này Payment Service có thể tự chọn cổng.

Ví dụ:

```text
VND + Việt Nam
→ SePay / VNPAY / MoMo

USD + quốc tế
→ PayPal
```

Hoặc cho user tự chọn ở checkout:

```text
Chuyển khoản ngân hàng
MoMo
VNPAY
PayPal
```

Business logic phía trên không thay đổi.

---

# 34I. Subscription Billing

Subscription không nên gắn cứng vào payment provider.

Platform giữ subscription state riêng:

```text
subscriptions

id
workspace_id
plan_id
status
billing_cycle
current_period_start
current_period_end
cancel_at_period_end
provider
provider_subscription_id
created_at
updated_at
```

Điều này giúp:

- Đổi payment provider sau này.
- Có gói manual payment.
- Có lifetime plan.
- Có trial.
- Có coupon.
- Có invoice/manual renewal.
- Có subscription quốc tế hoặc nội địa.

---

# 34J. Checkout

Checkout nên là một module riêng.

```text
Checkout
├── Product / Plan
├── Coupon
├── Customer
├── Billing info
├── Payment method
└── Payment provider
```

Checkout gọi PaymentService thay vì gọi trực tiếp MoMo/VNPAY/PayPal.

---

# 34K. Payment MVP đề xuất

V1 nên ưu tiên:

```text
SePay
+
VNPAY hoặc MoMo
+
PayPal
```

Lý do:

- SePay: chuyển khoản/QR Việt Nam.
- VNPAY hoặc MoMo: checkout nội địa thuận tiện.
- PayPal: thanh toán quốc tế.

Không nhất thiết tích hợp tất cả cùng ngày đầu.

Nhưng kiến trúc phải hỗ trợ cả 4 ngay từ đầu thông qua adapter.

---

---

# 35. Gợi ý mô hình gói

## Free / Trial

- 1 community.
- Member giới hạn.
- Course cơ bản.
- Community feed.
- Transactional email.
- Basic integrations.

## Pro

- Nhiều community.
- Nhiều member.
- Email integrations.
- Automation.
- API.
- Custom branding.
- Advanced analytics.

## Business

- Team.
- Advanced permissions.
- MCP.
- API nâng cao.
- Webhooks.
- Multiple integrations.
- Priority support.
- Higher limits.

## Enterprise

- Dedicated support.
- SSO.
- Custom limits.
- Custom integrations.
- SLA.
- Dedicated infrastructure nếu cần.

---

# 36. Search

Khi dữ liệu còn nhỏ:

- PostgreSQL Full Text Search.

Khi scale lớn:

- Meilisearch.
- Typesense.
- OpenSearch.

Không cần search engine riêng ngay từ đầu.

---

# 37. Analytics

Tách analytics khỏi transactional DB khi cần.

V1:

- PostgreSQL.

V2:

- Event logs.
- Aggregation tables.

V3:

- ClickHouse.
- BigQuery.
- Dedicated analytics pipeline.

---

# 38. Logging

Phải có:

```text
audit_logs
integration_logs
api_logs
automation_logs
email_logs
admin_logs
```

Ví dụ:

```text
audit_logs

id
workspace_id
user_id
action
resource_type
resource_id
metadata
created_at
```

---

# 39. Rate limiting

Bắt buộc cho:

- Login.
- Register.
- API.
- MCP.
- Email sync.
- Webhooks.
- Post/comment creation.

Cloudflare có thể xử lý phần lớn rate limit ở edge.

---

# 40. Security

Các nguyên tắc:

- Password không tự lưu nếu dùng Supabase Auth.
- API key lưu hash.
- Integration credential mã hóa.
- Signed URL cho file private.
- RLS trên database.
- Tenant isolation.
- CSRF/XSS protection.
- Rate limiting.
- Audit log.
- Session expiry.
- Optional MFA.

---

# 41. Scale roadmap

## Stage 1 — MVP

```text
0 → 10.000 users
```

- Cloudflare Workers.
- Supabase.
- R2.
- External video embed.
- Resend transactional.
- Basic integrations.

## Stage 2

```text
10.000 → 100.000 users
```

Thêm:

- Redis/cache nếu cần.
- Background worker.
- Queue.
- Better indexing.
- CDN tuning.
- More monitoring.

## Stage 3

```text
100.000 → 1.000.000 users
```

Thêm:

- Read replica.
- Partitioning.
- Dedicated DB resources.
- Separate analytics.
- More aggressive caching.
- Job processing cluster.

## Stage 4

```text
1.000.000+ users
```

Có thể cần:

- DB sharding.
- Multiple regions.
- Service separation.
- Dedicated queues.
- Dedicated search.
- Separate analytics stack.

Nhưng không cần làm những thứ này từ V1.

---

# 42. Những bảng dễ phình nhanh

Cần để ý:

- posts.
- comments.
- reactions.
- notifications.
- activity_logs.
- analytics_events.
- email_logs.
- webhook_logs.
- automation_runs.

Các bảng này về sau có thể partition.

---

# 43. Caching

Có thể cache:

- Public community page.
- Course metadata.
- Member counts.
- Popular posts.
- Static settings.

Không cache dữ liệu permission-sensitive một cách tùy tiện.

---

# 44. Mobile app tương lai

Mobile app không cần backend riêng.

```text
Mobile App
↓
API
↓
Service Layer
```

Dùng cùng backend với web.

---

# 45. AI integration

AI có thể dùng platform qua MCP/API.

Ví dụ:

```text
"Đăng bài thông báo cho community A."
"Thêm toàn bộ học viên chưa hoàn thành module 2 vào segment."
"Tạo khóa học mới."
"Xuất danh sách member inactive 30 ngày."
```

AI không chạm database trực tiếp.

---

# 46. Integration marketplace tương lai

Sau này có thể mở marketplace:

- Email.
- CRM.
- Payment.
- Automation.
- Webinar.
- AI.
- Analytics.
- Social.
- LMS.

Mỗi integration là adapter/module.

---

# 47. Kiến trúc code đề xuất

```text
/apps
   /web
   /admin
   /mcp

/packages
   /auth
   /database
   /community
   /membership
   /courses
   /content
   /billing
   /notifications
   /automation
   /integrations
   /api
   /permissions
   /media
   /email
```

Có thể dùng monorepo.

---

# 48. Service Layer

Ví dụ:

```text
CommunityService
MemberService
CourseService
PostService
BillingService
MediaService
EmailService
AutomationService
IntegrationService
ApiKeyService
WebhookService
```

Frontend không gọi database trực tiếp nếu muốn giữ kiến trúc sạch.

---

# 49. Infrastructure V1 đề xuất

```text
Source Code
→ GitHub

Frontend / API
→ Cloudflare Workers / Pages

Database
→ Supabase PostgreSQL

Authentication
→ Supabase Auth

Images / Files
→ Cloudflare R2

Video
→ Embed external providers

Transactional Email
→ Resend

Marketing Email
→ Customer-owned provider

Payments
→ SePay / VNPAY / MoMo / PayPal

Background Jobs
→ Cloudflare / VPS

MCP
→ VPS hoặc Worker tùy workload
```

---

# 50. Những thứ KHÔNG nên build ngay

Không nên build sớm:

- Video streaming riêng.
- Email marketing provider riêng.
- SMTP infrastructure riêng.
- Microservices.
- Kafka.
- Kubernetes.
- Elasticsearch.
- Sharding.
- Multi-region database.
- Dedicated mobile backend.

Chỉ thêm khi data chứng minh là cần.

---

# 51. Các quyết định đã chốt

## Database

PostgreSQL.

## Managed DB

Supabase.

## App hosting

Cloudflare Workers / Pages.

## Source code

GitHub.

## Files

Cloudflare R2.

## Video MVP

Embed bên ngoài.

## Native video sau này

Bunny Stream / Cloudflare Stream / managed video trước.

## Email hệ thống

Resend.

## Email marketing

BYO provider.

## API

Có ngay từ kiến trúc lõi.

## MCP

Dùng chung service layer với API.

## Webhook

Có từ sớm.

## Payments

Payment Integration Layer với adapter cho SePay, VNPAY, MoMo và PayPal.

Không hard-code payment provider vào billing/business logic.

## Architecture

Modular Monolith + Multi-tenant.

---

# 52. Nguyên tắc quan trọng nhất

> Không xây từng feature như các hệ thống rời rạc.

Mọi thứ phải đi qua cùng business core.

```text
Web App
Admin
API
MCP
Mobile
Integrations
      ↓
Service Layer
      ↓
Domain Logic
      ↓
PostgreSQL
```

Nhờ đó:

- Không duplicate logic.
- Dễ mở rộng.
- Dễ bảo trì.
- Dễ thêm AI.
- Dễ thêm app mới.
- Dễ thay provider.
- Không bị khóa vào vendor.

---

# 53. Product vision dài hạn

Nền tảng không chỉ là một bản clone Skool.

Hướng dài hạn có thể trở thành:

```text
Community Platform
+
Course Platform
+
Membership System
+
Automation Layer
+
Integration Hub
+
API Platform
+
MCP / AI Operating Layer
```

Đây mới là lợi thế cạnh tranh lớn về sau.

---

# 54. Roadmap kỹ thuật đề xuất

## Phase 1 — Foundation

- Auth.
- Users.
- Workspace.
- Community.
- Membership.
- Permissions.
- Database schema.
- R2.
- Basic admin.

## Phase 2 — Community Core

- Feed.
- Posts.
- Comments.
- Reactions.
- Notifications.
- Search.
- Member directory.

## Phase 3 — Learning

- Courses.
- Modules.
- Lessons.
- Progress.
- External video embed.

## Phase 4 — Monetization

- Subscription.
- Plans.
- Payments.
- Billing.
- Usage limits.

## Phase 5 — Integrations

- API keys.
- Webhooks.
- Email integrations.
- Systeme.
- Kit.
- Mailchimp.
- Resend.
- n8n / Make / Zapier.

## Phase 6 — Automation

- Event system.
- Trigger.
- Condition.
- Action.
- Automation logs.

## Phase 7 — AI

- MCP.
- AI tools.
- AI community assistant.
- AI automation builder.
- AI content assistant.

## Phase 8 — Scale

- Cache.
- Queue.
- Read replicas.
- Analytics pipeline.
- Search engine.
- Partitioning.

---

# 55. Kết luận

Kiến trúc đề xuất cho V1:

```text
GitHub
   ↓
Cloudflare Workers / Pages
   ↓
Service Layer
   ↓
Supabase PostgreSQL
   ↓
Domain Modules
```

Kèm:

```text
R2 → Images / Files
External Embed → Video
Resend → Transactional Email
Customer Provider → Marketing Email
API → External Apps
MCP → AI Agents
Webhooks → Automations / Integrations
VPS → Background jobs / MCP / heavy tasks
```

Mục tiêu là:

- Chi phí thấp khi bắt đầu.
- Không over-engineering.
- Có thể scale lớn.
- Không khóa vendor.
- Dễ tích hợp.
- Dễ thêm AI.
- Dễ mở rộng thành hệ sinh thái.

Đây là foundation nên dùng để tiếp tục viết:
- Database ERD.
- API spec.
- Permission matrix.
- Module architecture.
- Infrastructure deployment spec.
- MVP development roadmap.


---

# 56. GAP REVIEW — Những phần còn thiếu cần bổ sung

Sau khi rà lại toàn bộ kiến trúc V1.1, phần lõi đã khá đầy đủ nhưng vẫn còn một số khoảng hổng quan trọng nếu mục tiêu là:

- Deploy thật nhanh.
- Dùng ngay cho chính mình.
- Có thể bán ra thị trường.
- Không phải sửa kiến trúc lớn sau vài tháng.

Các phần dưới đây nên được bổ sung ngay ở mức foundation.

---

# 57. Custom Domain / Subdomain Architecture

Đây là phần quan trọng cho mô hình community SaaS.

Mặc định mỗi community nên có:

```text
community-slug.platform.com
```

Sau này owner có thể đấu domain riêng:

```text
community.customer.com
members.customer.com
academy.customer.com
```

Database:

```text
domains

id
workspace_id
community_id
domain
type
status
verification_token
ssl_status
created_at
verified_at
```

Type:

```text
platform_subdomain
custom_domain
```

Luồng:

```text
User tạo community
↓
System tạo slug
↓
community-slug.platform.com
↓
Dùng được ngay
```

Custom domain:

```text
Owner nhập domain
↓
System sinh DNS record
↓
User cấu hình DNS
↓
System verify
↓
Cloudflare route + SSL
↓
Domain active
```

MVP không cần custom domain ngay ngày đầu.

Nhưng schema và routing phải chuẩn bị trước.

---

# 58. Onboarding Architecture

Muốn deploy nhanh và bán được sớm thì onboarding phải được coi là core feature.

Flow đề xuất:

```text
Register
↓
Create Workspace
↓
Create First Community
↓
Choose Template
↓
Set Name + Slug
↓
Invite Members
↓
Create First Post / Course
↓
Connect Payment / Email
↓
Go Live
```

Nên có onboarding checklist:

```text
[ ] Tạo community
[ ] Thêm logo
[ ] Tạo bài viết đầu tiên
[ ] Tạo khóa học đầu tiên
[ ] Mời 5 thành viên
[ ] Kết nối thanh toán
[ ] Kết nối email
```

Database:

```text
onboarding_progress

workspace_id
step_key
completed_at
```

---

# 59. Invite / Join / Enrollment Architecture

Đây là phần còn thiếu quan trọng.

Một community cần nhiều cách join:

```text
public
private
invite_only
paid
approval_required
```

Database:

```text
community_access_rules
community_invites
join_requests
enrollments
```

Invite:

```text
id
community_id
email
token
role
expires_at
accepted_at
created_at
```

Join request:

```text
id
community_id
user_id
status
requested_at
reviewed_at
reviewed_by
```

Paid access:

```text
payment.succeeded
↓
grantCommunityAccess()
```

---

# 60. Community Moderation

Nếu bán ra thị trường, moderation phải có ngay.

Cần:

```text
report_content
mute_member
ban_member
remove_post
remove_comment
approve_member
suspend_member
```

Database:

```text
moderation_reports
moderation_actions
banned_members
```

Mỗi action cần audit log.

---

# 61. Content Visibility

Post/course/lesson không phải lúc nào cũng public cho toàn community.

Cần visibility:

```text
public
members_only
admins_only
paid_tier
specific_segment
specific_role
```

Ví dụ lesson:

```text
lesson_access_rules
```

Điều này rất quan trọng nếu sau này có:

- Nhiều gói thành viên.
- Upsell.
- Khóa học premium.
- Nội dung VIP.

---

# 62. Product / Offer Architecture

Payment có rồi nhưng thiếu lớp Product/Offer.

Nên tách:

```text
Product
Offer
Price
Checkout
Order
Payment
Access
```

Ví dụ:

```text
Product: Cộng đồng Marketing
Offer A: 299k/tháng
Offer B: 2.990k/năm
Offer C: Lifetime 9.990k
```

Database:

```text
products
offers
prices
coupons
orders
order_items
entitlements
```

Entitlement:

```text
user_id
resource_type
resource_id
source_type
source_id
starts_at
expires_at
```

Đây là lớp quyết định user có quyền truy cập gì.

Không nên dùng payment trực tiếp để kiểm tra quyền truy cập.

---

# 63. Entitlement Engine

Đây là phần cực kỳ nên có ngay từ foundation.

Ví dụ:

```text
Payment succeeded
↓
Create entitlement
↓
User được access Community A
↓
User được access Course B
```

Nếu refund/cancel:

```text
subscription.cancelled
↓
Update entitlement
↓
Revoke access khi hết kỳ
```

Nhờ vậy:

- Thanh toán và quyền truy cập tách rời.
- Dễ hỗ trợ coupon.
- Dễ lifetime.
- Dễ manual grant.
- Dễ affiliate promotion.
- Dễ bundle.

---

# 64. Calendar / Event Module

Mô hình kiểu Skool thường cần calendar/event.

V1 nên có basic:

```text
events

id
community_id
title
description
starts_at
ends_at
timezone
meeting_url
location
created_by
```

Có thể hỗ trợ:

- Zoom.
- Google Meet.
- Webinar.
- Offline event.
- Livestream link.

MVP chỉ cần tạo event + hiển thị lịch + reminder.

---

# 65. Gamification / Leaderboard

Không bắt buộc cho launch đầu tiên, nhưng nếu muốn gần kiểu Skool thì nên chuẩn bị schema.

```text
points
levels
leaderboards
badges
```

Event tạo điểm:

```text
post.created
comment.created
lesson.completed
event.attended
```

MVP có thể để feature flag OFF.

---

# 66. Direct Message / Chat

Không nên build realtime chat ngay nếu muốn deploy nhanh.

Đây là feature dễ kéo dự án chậm.

Khuyến nghị:

```text
V1: Không có DM
V1.5: Basic messaging
V2: Realtime chat
```

Nếu cần giao tiếp riêng trong V1:

- Email.
- Comment.
- External Zalo/Telegram link.

---

# 67. Notification Preference

Không chỉ có notification table.

Cần cho user chọn:

```text
in_app
email
push
```

Theo loại event:

```text
new_post
new_comment
mention
course_update
event_reminder
billing
security
```

Database:

```text
notification_preferences
```

---

# 68. Background Job Architecture

Workers chỉ phù hợp cho request ngắn.

Các task cần queue/background:

```text
bulk member import
email sync
webhook retry
analytics aggregation
large export
thumbnail generation
scheduled automation
subscription renewal jobs
```

Cần abstraction:

```text
JobQueue
├── enqueue()
├── retry()
├── fail()
└── complete()
```

Giai đoạn đầu có thể dùng:

- Cloudflare Queues.
- Hoặc VPS worker.

Không nên chạy job dài trực tiếp trong HTTP request.

---

# 69. Scheduler / Cron

Cần ngay cho:

```text
scheduled posts
event reminders
subscription checks
automation wait steps
sync jobs
daily summaries
cleanup jobs
```

Có thể dùng:

- Cloudflare Cron Triggers.
- VPS cron.

---

# 70. Idempotency

Bắt buộc ở các action có thể chạy trùng:

```text
payments
webhooks
member imports
automation
API write operations
email sync
```

Ví dụ:

```text
idempotency_keys

key
workspace_id
operation
status
response
expires_at
```

Điều này tránh:

- Trừ tiền 2 lần.
- Add member 2 lần.
- Gửi automation 2 lần.

---

# 71. Import / Export

Nếu muốn bán cho thị trường sớm, đây là feature rất thực tế.

Cần:

```text
Import CSV members
Export members
Export transactions
Export course progress
Export contacts
```

Import nên chạy background job.

MVP cực kỳ nên có CSV import.

---

# 72. Data Migration / Database Migrations

Không thay schema trực tiếp trên production.

Cần migration workflow:

```text
schema change
↓
migration file
↓
staging
↓
backup
↓
production deploy
```

Có thể dùng migration tooling của framework/Supabase.

---

# 73. Environments

Tối thiểu cần:

```text
development
staging
production
```

Không dùng chung database production để test.

Biến môi trường:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_KEY
RESEND_API_KEY
R2 credentials
payment credentials
```

Secrets không commit GitHub.

---

# 74. CI/CD

Muốn deploy nhanh thì CI/CD cần tối giản.

Flow:

```text
git push
↓
tests
↓
build
↓
deploy staging
↓
manual approve
↓
deploy production
```

Cloudflare + GitHub Actions là đủ cho V1.

---

# 75. Feature Flags

Rất nên có để deploy nhanh.

Ví dụ:

```text
video_upload
mcp
automation_builder
custom_domain
gamification
paypal
momo
```

Có thể bật:

- Toàn platform.
- Theo workspace.
- Theo plan.
- Theo beta user.

Nhờ vậy không phải chờ tất cả feature hoàn thiện mới launch.

---

# 76. Observability / Monitoring

Đây là phần V1.1 còn thiếu.

Cần theo dõi:

```text
errors
latency
failed jobs
failed webhooks
database load
payment failures
email failures
worker errors
```

Tối thiểu:

- Error tracking.
- Structured logs.
- Health check.
- Alert khi critical service fail.

Admin dashboard nên có:

```text
System Health
├── API
├── Database
├── Queue
├── Email
├── Payment
└── Webhooks
```

---

# 77. Backup / Disaster Recovery

Phải có trước khi bán thật.

Cần:

```text
Database backup
R2 object protection
Migration rollback
Restore procedure
Secret recovery
```

Ít nhất phải xác định:

```text
RPO
RTO
```

V1 không cần enterprise-grade, nhưng phải có cách restore rõ ràng.

---

# 78. Data Retention / Delete Account

Cần chuẩn bị cho dữ liệu người dùng.

Flow:

```text
User requests deletion
↓
soft delete
↓
grace period
↓
hard delete/anonymize
```

Workspace owner cũng cần:

```text
export workspace
delete workspace
```

---

# 79. Consent / Email Compliance

Vì có email integration nên cần:

```text
marketing_consent
unsubscribe_status
source
consent_at
```

Platform phải giữ trạng thái unsubscribe nội bộ nếu có automation.

Không được sync lại người đã unsubscribe một cách mù quáng.

---

# 80. File Security

R2 không nên để tất cả file public.

Cần:

```text
public files
private files
signed URLs
```

Course tài liệu trả phí phải dùng signed URL hoặc access-controlled route.

Ngoài ra cần:

- File type validation.
- Size limits.
- Malware scanning về sau nếu upload rộng.

---

# 81. Rate / Usage Metering

Billing có quota nhưng thiếu usage engine.

Cần:

```text
usage_counters

workspace_id
metric
period
value
```

Metrics:

```text
members
communities
storage_bytes
api_requests
automation_runs
admins
courses
```

Subscription service đọc usage để:

- Cảnh báo.
- Chặn vượt quota.
- Upsell.

---

# 82. Audit Trail cho Admin

Super Admin thao tác rất nhạy cảm.

Mọi hành động như:

```text
suspend workspace
refund payment
change plan
impersonate user
reset integration
```

phải được log.

Không nên cho Super Admin thao tác “im lặng”.

---

# 83. Admin Impersonation

Rất hữu ích cho support.

Super Admin có thể:

```text
Login as workspace owner
```

Nhưng phải:

- Có banner cảnh báo.
- Có audit log.
- Không được xem secret thô.
- Có thời gian hết hạn.
- Có quyền hạn rõ ràng.

---

# 84. Search & Pagination Standards

Tất cả list lớn phải:

- Cursor pagination.
- Filter.
- Search.
- Sort.

Không dùng OFFSET pagination cho bảng cực lớn nếu có thể tránh.

Ví dụ:

```text
members
posts
payments
logs
```

---

# 85. Soft Delete

Các resource quan trọng nên hỗ trợ soft delete:

```text
deleted_at
deleted_by
```

Áp dụng cho:

- Community.
- Course.
- Post.
- Member.
- Product.

Tránh xóa cứng ngay.

---

# 86. Slug / Username Uniqueness

Phải chuẩn hóa từ đầu:

```text
platform.com/c/community-slug
platform.com/u/username
```

Slug cần:

- Unique.
- Reserved words.
- Rename policy.
- Redirect cũ nếu đổi slug.

---

# 87. Localization / Timezone / Currency

Vì đánh thị trường Việt Nam nhưng có thể mở quốc tế, nên ngay từ đầu hỗ trợ:

```text
locale
timezone
currency
```

Mặc định:

```text
vi-VN
Asia/Ho_Chi_Minh
VND
```

Nhưng không hard-code.

---

# 88. Template System

Đây là feature giúp deploy và onboarding cực nhanh.

Khi tạo community cho chọn:

```text
Community Template
Course Community
Coaching Community
Membership Community
Internal Team Community
```

Template có thể tạo sẵn:

- Category.
- Welcome post.
- Course structure.
- Permissions.
- Onboarding checklist.

---

# 89. Seed Data / Demo Workspace

Nên có demo workspace cho user mới.

Giúp user hiểu sản phẩm ngay.

Ví dụ:

```text
Sample Community
Sample Course
Sample Post
Sample Event
```

Có thể xóa demo sau.

---

# 90. Category / Space Architecture

Community feed nên có category/space.

Ví dụ:

```text
Announcements
General
Q&A
Wins
Resources
```

Database:

```text
spaces
post_space_id
```

Nếu không làm từ đầu, sau này migrate post khá phiền.

---

# 91. Pinned / Featured Content

Cần basic:

```text
pin post
feature post
announcement
```

MVP nên có vì rất hữu ích cho community owner.

---

# 92. Mention / Notification Trigger

Post/comment cần hỗ trợ mention:

```text
@username
```

Tạo event:

```text
user.mentioned
```

Sau này notification/email dùng event này.

---

# 93. Basic Member Profile

Member profile nên có:

```text
display_name
avatar
bio
links
joined_at
role
course_progress
```

Không cần social profile phức tạp ở V1.

---

# 94. Fast Deployment Architecture — Bản rút gọn nên deploy

Nếu mục tiêu là ra thị trường nhanh nhất, không nên build toàn bộ spec cùng lúc.

Bản V1 thật sự nên chỉ gồm:

## Core

- Register/Login.
- Workspace.
- Community.
- Member.
- Role/Permission.
- Subdomain.
- Invite/link join.
- Feed.
- Post.
- Comment.
- Category/Space.
- Basic notification.

## Learning

- Course.
- Module.
- Lesson.
- Progress.
- External video embed.
- R2 file upload.

## Monetization

- Product.
- Offer.
- Checkout.
- SePay trước.
- Manual access grant.
- Subscription/entitlement foundation.

## Admin

- User management.
- Workspace management.
- Payment view.
- Basic logs.
- Suspend/activate.
- Plan/usage limits.

## Integration foundation

- Webhook.
- API key schema.
- Email provider abstraction.
- Payment provider abstraction.

Chưa cần UI hoàn chỉnh cho tất cả integrations.

---

# 95. Những thứ nên trì hoãn để deploy nhanh

Không build trong launch đầu:

- Realtime chat.
- Native video hosting.
- Visual automation builder.
- Full newsletter builder.
- Gamification hoàn chỉnh.
- MCP UI hoàn chỉnh.
- Mobile app.
- Integration marketplace.
- Advanced analytics.
- Multi-region.
- Microservices.
- Dedicated search engine.
- Affiliate system phức tạp.

Chỉ để schema/abstraction sẵn.

---

# 96. Thứ tự triển khai thực tế đề xuất

## Sprint A — Foundation

```text
Auth
Database schema
Workspace
Community
Membership
Permissions
Subdomain
Admin basics
```

## Sprint B — Community

```text
Spaces
Posts
Comments
Invites
Notifications
Moderation basic
```

## Sprint C — Learning

```text
Courses
Modules
Lessons
Progress
Video embed
R2 files
```

## Sprint D — Monetization

```text
Products
Offers
Entitlements
Checkout
SePay
Orders
Payments
```

## Sprint E — Production Hardening

```text
Backups
Logs
Monitoring
Rate limits
Webhook idempotency
Usage limits
Email transactional
```

## Sprint F — Integrations

```text
API keys
Webhook UI
Email providers
VNPAY
MoMo
PayPal
MCP foundation
```

---

# 97. Kiến trúc ưu tiên cho mục tiêu "deploy nhanh nhưng không phải làm lại"

Chốt nguyên tắc:

```text
Build simple UI
+
Strong database schema
+
Clean service layer
+
Provider adapters
+
Event-driven foundation
+
Feature flags
```

Không cố build nhiều feature.

Phần cần làm chuẩn ngay:

- Tenant model.
- Membership.
- Permissions.
- Entitlements.
- Payments abstraction.
- Integration abstraction.
- Events.
- IDs.
- Audit logs.
- Migrations.

Phần có thể làm đơn giản:

- UI.
- Analytics.
- Search.
- Notifications.
- Automation.
- Gamification.
- Video.

---

# 98. Bản kiến trúc MVP cuối cùng

```text
GitHub
   ↓
Cloudflare Pages / Workers
   ↓
Application Service Layer
   ↓
Supabase PostgreSQL
   ↓
Domain Modules
```

Core modules:

```text
Auth
Workspace
Community
Membership
Spaces
Posts
Comments
Courses
Progress
Products
Offers
Entitlements
Payments
Notifications
Integrations
Admin
```

Infrastructure:

```text
R2 → files/images
External Embed → video
Resend → transactional email
Customer Provider → marketing email
SePay/VNPAY/MoMo/PayPal → payment adapters
Cloudflare Queue/VPS → background jobs
Cron → scheduled tasks
```

Access surfaces:

```text
Web App
Admin
Super Admin
API
MCP
```

---

# 99. Kết luận sau khi rà soát

V1.1 đã đúng về hướng hạ tầng nhưng thiếu một số "xương sống sản phẩm".

Các bổ sung quan trọng nhất là:

1. Custom domain/subdomain.
2. Invite/join/access rules.
3. Product/Offer.
4. Entitlement engine.
5. Moderation.
6. Event/calendar.
7. Background jobs.
8. Scheduler.
9. Idempotency.
10. CI/CD + environments.
11. Monitoring + backup.
12. Usage metering.
13. Import/export.
14. Feature flags.
15. Spaces/categories.
16. Data retention + consent.
17. File access security.
18. Fast-deploy scope.

Nếu làm đúng các foundation này, sản phẩm có thể bắt đầu rất gọn nhưng vẫn có đường mở rộng mà không cần đập lại lõi.


---

# 100. Affiliate Architecture — Hai tầng Affiliate

Nền tảng nên hỗ trợ **hai hệ affiliate độc lập nhưng dùng chung một Affiliate Engine**:

```text
Affiliate Engine
├── Platform Affiliate
└── Community Affiliate
```

Một user/member có thể đồng thời:

- Affiliate cho chính nền tảng.
- Affiliate cho Community A.
- Affiliate cho Community B.
- Không cần tạo tài khoản affiliate riêng nếu đã có account trên platform.

Mục tiêu:

- Không duplicate logic.
- Tách rõ ai trả commission.
- Tách attribution theo từng context.
- Có thể mở affiliate cho từng community bằng feature flag.
- Scale được về sau sang nhiều commission model.

---

# 101. Platform Affiliate

Đây là affiliate dành cho chính SaaS platform.

Ví dụ:

```text
Affiliate giới thiệu Owner mới
↓
Owner đăng ký gói Pro
↓
Platform ghi nhận conversion
↓
Affiliate nhận commission
```

Có thể áp dụng cho:

- First payment.
- Recurring subscription.
- Annual plan.
- Upgrade.
- Add-on.

Ví dụ commission:

```text
20% recurring 12 tháng
30% first payment
500.000đ / paid customer
```

Platform là bên chịu chi phí commission.

---

# 102. Community Affiliate

Mỗi workspace/community owner có thể bật affiliate riêng cho cộng đồng hoặc offer của họ.

Ví dụ:

```text
Member A tham gia Community X
↓
Bật Affiliate
↓
Member A có link giới thiệu riêng
↓
Người mới mua Offer của Community X
↓
Member A nhận commission
```

Community owner là bên chịu commission.

Platform chỉ cung cấp:

- Tracking.
- Attribution.
- Commission engine.
- Reporting.
- Payout workflow.
- Fraud controls.

---

# 103. Affiliate Scope

Affiliate program cần có scope rõ ràng.

```text
scope_type

platform
workspace
community
offer
```

Ví dụ:

```text
Platform Affiliate
scope_type = platform

Affiliate cho toàn Workspace
scope_type = workspace

Affiliate chỉ cho Community A
scope_type = community

Affiliate riêng Offer 299k
scope_type = offer
```

Điều này giúp tránh hard-code.

---

# 104. Affiliate Program

Database:

```text
affiliate_programs

id
scope_type
scope_id
name
status
commission_type
commission_value
commission_duration
cookie_days
minimum_payout
currency
allow_self_referral
approval_required
created_at
updated_at
```

Commission type:

```text
percentage
fixed_amount
```

Commission duration:

```text
one_time
recurring
recurring_n_months
lifetime
```

---

# 105. Affiliate Accounts

Không nên tạo một user system khác.

Affiliate account chỉ là một capability của user hiện tại.

```text
affiliate_accounts

id
user_id
program_id
status
affiliate_code
approved_at
created_at
```

Một user có thể có nhiều affiliate account:

```text
User A
├── Platform Affiliate
├── Community A Affiliate
└── Community B Affiliate
```

---

# 106. Affiliate Links

Affiliate link:

```text
https://platform.com/r/ABC123
```

Hoặc context-specific:

```text
https://platform.com/c/community-a?ref=ABC123
```

Custom domain:

```text
https://community.customer.com?ref=ABC123
```

Database:

```text
affiliate_links

id
affiliate_account_id
target_type
target_id
slug
destination_url
status
created_at
```

Target có thể là:

```text
platform_signup
community
product
offer
checkout
landing_page
```

---

# 107. Attribution Engine

Flow:

```text
Affiliate click
↓
Create click record
↓
Set attribution cookie / signed token
↓
Visitor registers or buys
↓
Resolve attribution
↓
Create conversion
↓
Create commission
```

Nên lưu:

```text
affiliate_clicks

id
affiliate_account_id
visitor_id
session_id
ip_hash
user_agent_hash
landing_url
referrer
clicked_at
```

Attribution:

```text
affiliate_attributions

id
affiliate_account_id
visitor_id
user_id
source_click_id
scope_type
scope_id
attributed_at
expires_at
```

---

# 108. Attribution Rules

V1 nên chọn rule đơn giản:

```text
last affiliate click wins
```

Có cookie window:

```text
30 days
60 days
90 days
```

Program owner tự chọn.

Sau này có thể hỗ trợ:

```text
first click
last click
coupon attribution
manual attribution
```

Không nên build multi-touch attribution ở V1.

---

# 109. Cross-Program Attribution

Một người có thể click:

```text
Platform affiliate link
↓
đăng ký platform
↓
sau đó click Community affiliate link
↓
mua Community
```

Hai conversion phải tách nhau.

Ví dụ:

```text
Platform Subscription
→ commission cho Platform Affiliate

Community Purchase
→ commission cho Community Affiliate
```

Attribution luôn phải gắn với scope.

---

# 110. Affiliate Conversion

Database:

```text
affiliate_conversions

id
affiliate_account_id
program_id
customer_user_id
order_id
subscription_id
conversion_type
gross_amount
net_amount
currency
status
converted_at
```

Conversion type:

```text
platform_subscription
community_purchase
offer_purchase
subscription_renewal
upgrade
```

---

# 111. Commission Engine

Commission không nên được tính trực tiếp trong payment adapter.

Flow:

```text
payment.succeeded
↓
Affiliate Attribution Resolver
↓
Commission Engine
↓
Create commission
```

Database:

```text
affiliate_commissions

id
conversion_id
affiliate_account_id
program_id
amount
currency
status
available_at
approved_at
paid_at
created_at
```

Status:

```text
pending
approved
available
rejected
cancelled
paid
```

---

# 112. Hold Period

Không trả commission ngay khi payment thành công.

Nên có hold period:

```text
7 days
14 days
30 days
```

Flow:

```text
payment.succeeded
↓
commission.pending
↓
hold period
↓
commission.available
↓
eligible for payout
```

Nếu refund:

```text
payment.refunded
↓
commission.cancelled
```

Nếu đã trả commission thì tạo negative adjustment/debt.

---

# 113. Recurring Commission

Nếu platform/community có subscription:

```text
subscription.renewed
↓
check affiliate program
↓
check commission duration
↓
create recurring commission
```

Ví dụ:

```text
20% trong 12 tháng
```

Database cần lưu:

```text
commission_start_at
commission_end_at
commission_cycles_paid
```

Không tính recurring bằng cron mù; nên dựa vào payment/subscription events.

---

# 114. Affiliate Coupon Code

Ngoài link, có thể hỗ trợ coupon:

```text
QUY20
```

Coupon có thể:

- Giảm giá cho buyer.
- Gắn attribution cho affiliate.
- Hoặc cả hai.

Database mapping:

```text
affiliate_coupon_codes

id
affiliate_account_id
coupon_id
program_id
status
```

V1 có thể để sau link tracking.

---

# 115. Affiliate Dashboard cho Member

Member bật affiliate sẽ có dashboard:

```text
Affiliate
├── My Links
├── Clicks
├── Leads
├── Customers
├── Conversions
├── Commissions
├── Available Balance
├── Payouts
└── Program Terms
```

Nếu user tham gia nhiều chương trình:

```text
Affiliate Dashboard
├── Platform
├── Community A
└── Community B
```

---

# 116. Affiliate Admin — Platform

Super Admin cần:

```text
Admin
└── Platform Affiliate
    ├── Programs
    ├── Affiliates
    ├── Applications
    ├── Clicks
    ├── Conversions
    ├── Commissions
    ├── Payouts
    ├── Fraud Review
    └── Settings
```

---

# 117. Affiliate Admin — Community Owner

Workspace/community owner có:

```text
Community Admin
└── Affiliate
    ├── Program
    ├── Members
    ├── Links
    ├── Conversions
    ├── Commissions
    ├── Payouts
    └── Settings
```

Owner có thể:

- Enable/disable affiliate.
- Chọn offer nào được affiliate.
- Set commission.
- Approve affiliate members.
- Set cookie days.
- Set hold period.
- Set minimum payout.
- View conversions.
- Mark payout as paid.

---

# 118. Payout Architecture

V1 nên dùng manual payout để deploy nhanh:

```text
commission.available
↓
Affiliate requests payout
↓
Admin reviews
↓
Admin pays externally
↓
Mark payout paid
```

Database:

```text
affiliate_payouts

id
program_id
affiliate_account_id
amount
currency
status
payment_method
payment_reference
requested_at
approved_at
paid_at
```

Payment method:

```text
bank_transfer
paypal
manual
```

---

# 119. Payout Account

Affiliate có thể lưu payout profile:

```text
affiliate_payout_profiles

id
user_id
method
account_name
account_identifier_encrypted
metadata_encrypted
status
created_at
```

Thông tin nhạy cảm phải encrypted.

---

# 120. Affiliate Fraud Protection

Cần chặn:

```text
self referral
same payment account
duplicate account
fake signup
cookie stuffing
bot clicks
mass referral abuse
refund abuse
```

Signals:

```text
same IP hash
same device/session
same payment identifier
same email domain patterns
high click-to-buy anomaly
high refund rate
```

V1 chỉ cần:

- Rules.
- Flags.
- Manual review.

---

# 121. Self-Referral

Mặc định:

```text
allow_self_referral = false
```

Nếu affiliate mua bằng chính account của họ:

```text
no commission
```

---

# 122. Affiliate Abuse Status

Affiliate account có status:

```text
pending
active
paused
suspended
banned
```

Fraud cases:

```text
affiliate_fraud_flags

id
affiliate_account_id
conversion_id
rule
severity
status
metadata
created_at
```

---

# 123. Refund / Chargeback Logic

Nếu order refund:

```text
payment.refunded
↓
affiliate_conversion.reversed
↓
commission.cancelled
```

Nếu payout đã thực hiện:

```text
create commission adjustment = negative
```

Không xóa lịch sử commission.

---

# 124. Affiliate Event Architecture

Events:

```text
affiliate.clicked
affiliate.attributed
affiliate.converted
commission.created
commission.available
commission.cancelled
payout.requested
payout.paid
affiliate.suspended
```

---

# 125. Affiliate API

Có thể expose qua API:

```text
GET /affiliate/programs
GET /affiliate/stats
GET /affiliate/commissions
POST /affiliate/links
POST /affiliate/payouts/request
```

Community owner:

```text
POST /affiliate/programs
PATCH /affiliate/programs/:id
GET /affiliate/conversions
```

---

# 126. Affiliate MCP

AI có thể thao tác affiliate qua MCP.

Ví dụ:

```text
"Cho tôi top 10 affiliate tháng này."
"Tăng commission Community A lên 30%."
"Liệt kê affiliate có refund rate trên 20%."
"Tạo affiliate link cho Offer B."
```

MCP tools:

```text
list_affiliate_programs
get_affiliate_stats
create_affiliate_link
list_affiliate_conversions
list_pending_payouts
```

Không cho MCP thanh toán payout trực tiếp trong V1 nếu không có approval flow.

---

# 127. Affiliate + Entitlement

Affiliate chỉ tạo commission.

Entitlement quyết định quyền truy cập.

```text
Affiliate link
↓
Checkout
↓
Payment
↓
Entitlement Granted
+
Affiliate Conversion
```

Hai flow chạy song song.

---

# 128. Affiliate + Product/Offer

Affiliate nên gắn chủ yếu với Offer.

Ví dụ:

```text
Community A
├── Offer Monthly
├── Offer Annual
└── Offer Lifetime
```

Owner có thể set:

```text
Monthly → 30%
Annual → 40%
Lifetime → 20%
```

---

# 129. Affiliate + Custom Domain

Tracking phải chạy được trên custom domain.

Ví dụ:

```text
community.customer.com?ref=ABC123
```

Cần:

- Signed ref token.
- Cookie scope đúng domain.
- Attribution sync về platform backend.

---

# 130. Affiliate + Payment Providers

Affiliate Engine không cần biết buyer trả bằng:

- SePay.
- VNPAY.
- MoMo.
- PayPal.

Nó chỉ nghe event chuẩn:

```text
payment.succeeded
payment.refunded
subscription.renewed
```

---

# 131. Affiliate Usage & Plan Limits

Affiliate có thể là tính năng upsell.

Ví dụ:

```text
Free
→ Không affiliate

Pro
→ 1 affiliate program/community

Business
→ Unlimited programs
→ Recurring commission
→ Custom cookie
→ Export payouts
→ Advanced analytics
```

Quota có thể là:

```text
max_affiliate_programs
max_active_affiliates
affiliate_api_access
affiliate_recurring_commission
```

---

# 132. Affiliate MVP — Nên build gì trước

## Build ngay

- Platform affiliate program.
- Community affiliate program.
- Affiliate link.
- Last-click attribution.
- Cookie window.
- Conversion tracking.
- Commission calculation.
- Hold period.
- Manual payout.
- Basic affiliate dashboard.
- Basic admin dashboard.
- Refund reversal.
- Self-referral blocking.

## Để sau

- Coupon attribution.
- Multi-touch attribution.
- Automated payout.
- Tiered commission.
- Sub-affiliate.
- Multi-level affiliate.
- Advanced fraud detection.
- Affiliate marketplace.
- AI optimization.

---

# 133. Affiliate Database Core

Tối thiểu cần:

```text
affiliate_programs
affiliate_accounts
affiliate_links
affiliate_clicks
affiliate_attributions
affiliate_conversions
affiliate_commissions
affiliate_payouts
affiliate_payout_profiles
affiliate_fraud_flags
```

Liên kết với:

```text
users
workspaces
communities
products
offers
orders
payments
subscriptions
```

---

# 134. Affiliate Flow hoàn chỉnh

```text
Member / Affiliate
↓
Generate Affiliate Link
↓
Visitor Click
↓
Attribution Stored
↓
Visitor Registers / Purchases
↓
Payment Succeeded
↓
Entitlement Granted
↓
Affiliate Conversion Created
↓
Commission Pending
↓
Hold Period
↓
Commission Available
↓
Payout Request
↓
Admin Pays
↓
Commission Paid
```

---

# 135. Kiến trúc Affiliate nên chốt

```text
Platform Affiliate
            \
             \
              → Affiliate Engine
             /
Community Affiliate
```

Affiliate Engine dùng chung:

```text
Tracking
Attribution
Conversion
Commission
Payout
Fraud
Reporting
API
MCP
```

Mỗi program luôn có:

```text
scope
owner
commission rules
payout owner
currency
```

---

# 136. Fast Deploy Update — Affiliate

Thứ tự MVP nên cập nhật:

```text
Foundation
↓
Community Core
↓
Courses
↓
Products / Offers
↓
Payments
↓
Entitlements
↓
Affiliate Core
↓
Production Hardening
↓
Integrations / API / MCP
```

Affiliate nên triển khai **sau Payment + Entitlement**.

---

# 137. Kết luận Affiliate

Nền tảng hỗ trợ hai tầng affiliate:

1. **Platform Affiliate**
   - Giới thiệu chủ community mới.
   - Platform trả commission.

2. **Community Affiliate**
   - Member giới thiệu người mua/join community.
   - Community owner trả commission.

Một user có thể tham gia nhiều affiliate program cùng lúc.

Không build hai hệ affiliate riêng biệt.

Chỉ build một Affiliate Engine dùng chung và phân tách bằng:

```text
program_id
scope_type
scope_id
```

Đây là cách vừa deploy nhanh, vừa không phải viết lại khi marketplace và số lượng community tăng lớn.

---

# 138. Course Commerce Architecture — Bán khóa học độc lập hoặc kèm Community

Khóa học không nên bị ràng buộc bắt buộc với Community.

Nền tảng cần hỗ trợ hai chế độ:

```text
Course Access Mode
├── Community-Bundled
└── Standalone Course
```

Mục tiêu:

- Chủ workspace có thể bán một khóa học riêng mà buyer không cần vào community.
- Có thể bán gói community mở toàn bộ khóa học.
- Có thể bán từng khóa riêng.
- Có thể bundle nhiều khóa.
- Có thể cấp quyền thủ công.
- Có thể bán lifetime / subscription / one-time.
- Có thể chạy affiliate riêng cho từng khóa hoặc offer.

# 139. Tách Course khỏi Community về mặt dữ liệu

Không nên thiết kế:

```text
course.community_id = bắt buộc
```

Nên thiết kế:

```text
courses
id
workspace_id
title
slug
description
status
visibility
created_at
updated_at
```

Community mapping dùng bảng riêng:

```text
community_courses
id
community_id
course_id
access_mode
sort_order
created_at
```

Nhờ vậy một course có thể:
- Không thuộc community nào.
- Hiển thị trong Community A.
- Đồng thời được bán standalone.
- Được bundle trong nhiều offer khác nhau.

# 140. Course Access Model

Quyền truy cập khóa học phải đi qua Entitlement Engine.

Standalone:

```text
User buys standalone course
↓
payment.succeeded
↓
Create entitlement
↓
resource_type = course
resource_id = course_id
↓
User học được khóa
↓
Không có community access
```

Community bundle:

```text
User buys Community Pro
↓
payment.succeeded
↓
Create entitlement
↓
resource_type = community
resource_id = community_id
↓
Community access rule
↓
Unlock included courses
```

# 141. Standalone Course

Mỗi course có thể có landing/checkout riêng, ví dụ:

```text
https://hoc.minhquy.vn/course/ai-digital-master
```

Flow:

```text
Visitor
↓
Course Sales Page
↓
Checkout
↓
Payment
↓
Course Entitlement
↓
Student Dashboard
↓
Course Player
```

Không cần join community.

# 142. Community Bundle Access

Community có thể mở toàn bộ hoặc một phần course:

```text
Community Pro
├── Course A
├── Course B
└── Course C
```

Cấu hình:

```text
community_course_access
community_id
course_id
access_type
```

`access_type`:

```text
included
optional_purchase
hidden
```

# 143. Product / Offer Mapping cho Course

Product/Offer có thể bán:

```text
resource_type
community
course
course_bundle
membership
digital_product
```

Ví dụ:

```text
Product: AI DIGITAL MASTER
Offer Monthly → Course access 30 days
Offer Lifetime → Course lifetime access
Offer Bundle → Course A + Course B + Community VIP
```

# 144. Entitlement Granularity

```text
entitlements
id
user_id
workspace_id
resource_type
resource_id
source_type
source_id
starts_at
expires_at
status
created_at
```

Resource type:

```text
community
course
course_bundle
space
lesson
digital_file
```

Source type:

```text
purchase
subscription
community_bundle
manual_grant
coupon
admin
affiliate_promotion
```

# 145. Access Resolver

Khi user mở course, hệ thống phải gọi:

```text
canAccessCourse(user_id, course_id)
```

Resolver kiểm tra:

```text
Direct course entitlement
OR
Bundle entitlement
OR
Community entitlement includes course
OR
Manual grant
OR
Admin access
```

# 146. Student Dashboard độc lập

Buyer chỉ mua course vẫn có dashboard riêng:

```text
hoc.minhquy.vn/app
```

Menu:

```text
My Learning
├── My Courses
├── Progress
├── Certificates
├── Downloads
└── Account
```

Nếu user có community access thì thêm khu Communities.

# 147. Course Sales Page

V1 có thể dùng template đơn giản:

```text
Title
Subtitle
Cover
Description
Curriculum
Instructor
Price
CTA
FAQ
```

Không cần page builder phức tạp ngay.

# 148. Course Checkout

Course checkout dùng chung Payment Service:

```text
Course Sales Page
↓
Offer
↓
Checkout
↓
SePay / VNPAY / MoMo / PayPal
↓
payment.succeeded
↓
Course entitlement
```

# 149. Course Affiliate

Standalone course có thể affiliate riêng:

```text
Affiliate Program
scope_type = offer
scope_id = standalone_course_offer
```

Flow:

```text
Affiliate Link
↓
Standalone Course Checkout
↓
Payment
↓
Course Entitlement
+
Affiliate Commission
```

# 150. Course Bundle

Có thể bán nhiều khóa cùng lúc:

```text
course_bundles
id
workspace_id
name
slug
status
created_at
```

Mapping:

```text
course_bundle_items
bundle_id
course_id
sort_order
```

# 151. Community + Course Bundle

Một offer có thể cấp nhiều entitlement:

```text
Offer: Master Business
- Access Community VIP
- Access Course A
- Access Course B
- Access Course C
```

Nên có:

```text
offer_entitlements
offer_id
resource_type
resource_id
duration_type
duration_value
```

# 152. Full Community Unlock

Community owner có thể chọn:

```text
all_courses
selected_courses
none
```

Nếu `all_courses`, course mới thêm sau này có thể tự unlock cho member.

# 153. Course-Only User

Một user có thể chỉ là:

```text
Platform User
+
Course Student
```

Không nhất thiết là Community Member.

Phù hợp với mô hình hoc.minhquy.vn:
- Người A chỉ mua AI Digital Master.
- Người B chỉ mua The First Funnel.
- Người C tham gia Community VIP và được mở toàn bộ khóa.
- Người D mua bundle 3 khóa nhưng không vào community.

# 154. Suggested URL Structure cho hoc.minhquy.vn

```text
hoc.minhquy.vn/
hoc.minhquy.vn/course/ai-digital-master
hoc.minhquy.vn/course/the-first-funnel
hoc.minhquy.vn/bundle/marketing-master
hoc.minhquy.vn/community/vip
hoc.minhquy.vn/app
hoc.minhquy.vn/app/courses
hoc.minhquy.vn/app/community
hoc.minhquy.vn/checkout/{offer-slug}
```

# 155. Course Visibility vs Access

Tách hai khái niệm:

Visibility:

```text
public
unlisted
private
```

Access:

```text
free
paid
community_included
bundle_only
manual
```

# 156. Course Enrollment

Không dùng `community_members` để đại diện học viên.

```text
course_enrollments
id
course_id
user_id
entitlement_id
status
enrolled_at
expires_at
completed_at
```

Status:

```text
active
expired
completed
revoked
```

# 157. Course Progress độc lập

Progress không phụ thuộc community:

```text
lesson_progress
user_id
lesson_id
completed
completed_at
```

Nếu user mất community access nhưng vẫn sở hữu course standalone thì progress không mất.

# 158. Purchase Upgrade Logic

Có thể hỗ trợ:

```text
User đã mua Course A
↓
Upgrade Community VIP
↓
Apply discount / credit
↓
Community + all courses
```

Hoặc:

```text
User có Community Basic
↓
Mua Course Premium riêng
```

# 159. Refund Logic cho Course

Nếu refund standalone course:

```text
payment.refunded
↓
revoke direct course entitlement
↓
course_enrollment.status = revoked
```

Nhưng nếu user vẫn có community entitlement bao gồm course đó thì Access Resolver vẫn cho phép truy cập.

# 160. Fast Deploy — Course Commerce

V1 nên build:
- Course standalone.
- Course sales page template.
- Offer.
- Checkout.
- Direct course entitlement.
- Community included course.
- Student dashboard.
- Course enrollment.
- Progress.
- Affiliate cho course offer.
- Manual grant.
- Lifetime access.
- One-time payment.

V1.5:
- Course bundle.
- Annual/monthly course subscription.
- Upgrade pricing.
- Coupon.
- Drip content.
- Certificate.

V2:
- Page builder.
- Advanced bundles.
- Dynamic pricing.
- Order bump.
- Upsell/downsell.
- Learning paths.
- Advanced certificates.
- Corporate seats.

# 161. Kiến trúc Course cuối cùng

Không thiết kế cứng:

```text
Community
↓
Course
```

Nên thiết kế:

```text
Workspace
├── Communities
├── Courses
├── Products
└── Offers
```

Sau đó mapping:

```text
Community ↔ Course
Offer → Entitlements
Entitlement → Access
```

Đây là cấu trúc phù hợp cho cả:
- Skool-like community.
- LMS standalone.
- Digital product platform.
- hoc.minhquy.vn.
- Creator economy platform.

---

# 162. Product Page Strategy — Không xây Landing Page Builder

Nền tảng **không xây một landing page builder**.

Mục tiêu là giữ UX cực đơn giản, giống cách sàn thương mại điện tử vận hành:

```text
Mọi sản phẩm
→ dùng cùng một cấu trúc trang bán chuẩn
→ owner chỉ điền các trường
→ hệ thống tự render
```

Nguyên tắc:

- Không kéo thả.
- Không block builder.
- Không bắt user học page builder.
- Không để quá nhiều tùy chọn thiết kế.
- Ưu tiên nhập dữ liệu nhanh, publish nhanh, bán ngay.
- Advanced user vẫn có đường thoát ra landing page riêng.

# 163. Standard Product Page

Mỗi product/course/community offer có một trang chuẩn.

Ví dụ:

```text
hoc.minhquy.vn/course/ai-digital-master
```

Owner chỉ điền các field cố định:

```text
Tên sản phẩm
Subheadline
Ảnh cover
Video giới thiệu (optional)
Mô tả ngắn
Lợi ích chính
Nội dung / curriculum
Giảng viên
Giá
Giá gốc
Offer
FAQ
CTA
Guarantee / note
```

Hệ thống tự render theo một template thống nhất.

Không cho chỉnh layout tự do ở V1.

# 164. Product Page UX Principle

Trang bán phải theo tư duy:

```text
Create Product
↓
Fill Fields
↓
Preview
↓
Publish
```

Owner không cần học:

- Funnel builder.
- CSS.
- Section layout.
- Responsive design.
- Tracking setup cơ bản.
- Checkout integration cơ bản.

Mọi thứ được platform chuẩn hóa.

# 165. Product Page Data Model

Có thể lưu:

```text
product_pages

id
workspace_id
product_id
headline
subheadline
short_description
cover_image_url
intro_video_url
benefits_json
faq_json
instructor_json
cta_text
sales_mode
external_landing_url
external_checkout_mode
status
created_at
updated_at
```

`sales_mode`:

```text
native
external_landing
```

# 166. Native Sales Mode

Mặc định:

```text
sales_mode = native
```

Flow:

```text
Visitor
↓
Standard Product Page
↓
Buy Now
↓
Native Checkout
↓
Payment
↓
Entitlement
```

CTA:

```text
Mua ngay
Đăng ký ngay
Tham gia ngay
```

Đây là flow dành cho phần lớn user.

# 167. External Landing Mode

Advanced user có thể chọn:

```text
sales_mode = external_landing
```

Sau đó nhập:

```text
External Landing URL
```

Ví dụ:

```text
https://offer.customer.com/ai-master
```

Khi bật chế độ này, CTA native thay đổi.

Ví dụ:

```text
Mua ngay
→
Xem chi tiết
```

Flow:

```text
Platform Product Page / Listing
↓
Xem chi tiết
↓
External Landing Page
↓
External Checkout / Funnel
↓
Webhook / API
↓
Platform Entitlement
```

# 168. External Landing Configuration

Trong cài đặt nâng cao:

```text
Sales Settings
├── Sales Mode
│   ├── Native
│   └── External Landing
├── External Landing URL
├── External Checkout Provider
├── Webhook Secret
├── API Integration
└── Return URL
```

UI nên ẩn phần này dưới:

```text
Advanced Settings
```

Mặc định user mới không cần thấy.

# 169. External Purchase Activation

Advanced user có thể bán ở hệ thống ngoài rồi kích hoạt quyền trong platform.

Có 2 cách chính:

## Webhook

Hệ thống ngoài gửi event:

```text
order.paid
```

về platform.

Payload tối thiểu:

```text
email
offer_id
external_order_id
amount
currency
event
signature
```

Platform xử lý:

```text
Webhook received
↓
Verify signature
↓
Find/Create user
↓
Resolve offer
↓
Create entitlement
↓
Create enrollment/community access
```

## API Key

External funnel gọi trực tiếp API:

```text
POST /api/v1/entitlements/grant
```

Hoặc:

```text
POST /api/v1/orders/external
```

Platform xác thực bằng API key + scope.

# 170. External Order Model

Nên lưu cả đơn ngoài để audit.

```text
external_orders

id
workspace_id
provider
external_order_id
customer_email
offer_id
amount
currency
status
payload_hash
received_at
processed_at
```

Điều này giúp:

- Chống gửi trùng.
- Audit.
- Debug.
- Refund sync.
- Affiliate attribution.
- Reporting.

# 171. External Refund / Cancel

Nếu hệ thống ngoài refund:

```text
external.refunded
↓
Webhook
↓
Find entitlement
↓
Revoke / schedule revoke
↓
Reverse affiliate commission
```

Nên chuẩn hóa event:

```text
external.payment.succeeded
external.payment.refunded
external.subscription.cancelled
external.subscription.renewed
```

# 172. CTA Behavior

CTA phải thay đổi theo sales mode.

## Native

```text
Mua ngay
```

→ platform checkout.

## External Landing

```text
Xem chi tiết
```

→ external landing.

Có thể cho owner tùy chỉnh CTA text nhưng chỉ trong whitelist đơn giản:

```text
Mua ngay
Đăng ký
Tham gia
Xem chi tiết
Tìm hiểu thêm
```

Không cần cho nhập HTML tự do.

# 173. Listing / Marketplace Behavior

Trên trang danh sách course/product:

```text
Product Card
├── Cover
├── Title
├── Short Description
├── Price
└── CTA
```

CTA:

```text
Native → Mua ngay
External → Xem chi tiết
```

Người dùng không cần biết backend khác nhau.

# 174. Progressive Disclosure UX

Toàn bộ settings nên theo nguyên tắc:

```text
Basic first
Advanced later
```

Ví dụ:

```text
Sales Settings

Basic
- Price
- Offer
- CTA

Advanced
- External Landing URL
- Webhook
- API
- Tracking
```

Không hiển thị 20 field kỹ thuật ngay từ đầu.

# 175. Default-First UX

Nền tảng nên có default tốt.

Ví dụ:

```text
Sales mode = Native
Checkout = Platform
Affiliate = Off
Custom domain = Off
External landing = Off
Advanced API = Off
```

Owner có thể publish mà gần như không cần cấu hình.

# 176. One-Screen Setup

Mục tiêu: một creator bình thường có thể tạo sản phẩm qua một flow ngắn:

```text
1. Tên
2. Ảnh
3. Nội dung
4. Giá
5. Quyền truy cập
6. Publish
```

Các phần khác ở tab nâng cao.

# 177. Advanced User Path

Advanced user có thể mở:

```text
Advanced
├── External Landing
├── Webhook
├── API
├── Custom Domain
├── Affiliate
├── Tracking
└── Custom Redirect
```

Điều này giúp nền tảng phục vụ hai tệp:

```text
Simple user
→ vào là dùng

Advanced marketer
→ tối ưu funnel/sales page bên ngoài
```

# 178. External Funnel Integration

Không build funnel builder trong platform.

Chỉ build integration points:

```text
External Landing
↓
External Checkout
↓
Webhook/API
↓
Platform Access
```

Có thể tương thích với:

- Systeme.
- WordPress.
- WooCommerce.
- Shopify.
- Custom sales page.
- Funnel builder khác.
- Custom app.

Không cần tích hợp sâu với mọi hệ thống ngay từ đầu.

Webhook + API là lớp universal.

# 179. Tracking and Attribution

Nếu external landing được dùng, affiliate attribution vẫn cần được giữ.

Flow:

```text
Affiliate Link
↓
Platform tracking
↓
External Landing
↓
Checkout ngoài
↓
Webhook / API
↓
external_order_id
↓
Affiliate attribution resolver
↓
Commission
```

Nên truyền tracking token sang external landing:

```text
?ref=...
&attribution_token=...
```

Hoặc signed token.

# 180. External Landing Security

Không tự động tin webhook bên ngoài.

Bắt buộc:

- HMAC signature hoặc API key.
- Timestamp.
- Replay protection.
- Idempotency.
- External order ID unique.
- Rate limit.
- Audit log.

# 181. UX Rule cho toàn nền tảng

Nguyên tắc sản phẩm:

> Người dùng phổ thông không cần học cách dùng platform.

Mục tiêu:

- Ít field.
- Default tốt.
- Template thống nhất.
- Không có quá nhiều toggle.
- Không jargon kỹ thuật.
- Không ép user hiểu API/webhook.
- Advanced settings bị ẩn mặc định.

# 182. Suggested Settings Structure

Mỗi module nên chia:

```text
General
Access
Sales
Integrations
Advanced
```

Ví dụ Course:

```text
General
- Name
- Cover
- Description

Access
- Free / Paid
- Community included
- Standalone

Sales
- Price
- Offer
- Native / External Landing

Integrations
- Email
- Payment

Advanced
- API
- Webhook
- Custom redirect
```

# 183. Native Product Page vs External Landing

```text
Native Product Page
- Fixed structure
- Fast
- Easy
- No learning curve
- Native checkout
- Best for most users
```

```text
External Landing
- Advanced
- Flexible
- Custom design
- Custom optimization
- External funnel
- Webhook/API activation
```

Cả hai cùng tồn tại.

# 184. Fast Deploy Update

## Build ngay

- Fixed product page template.
- Fixed course page template.
- Basic product fields.
- Native checkout.
- `sales_mode`.
- `external_landing_url`.
- CTA switch.
- Webhook endpoint.
- API entitlement grant.
- External order idempotency.

## Để sau

- Page builder.
- Custom blocks.
- Custom CSS.
- Funnel builder.
- Split testing.
- Heatmap.
- Native advanced sales analytics.

# 185. Kiến trúc Sales Page chốt

Không xây:

```text
Landing Page Builder
```

Mà xây:

```text
Standard Product Page
+
Native Checkout
+
External Landing Escape Hatch
+
Webhook/API Activation
```

Đây là kiến trúc phù hợp nhất với mục tiêu:

- Deploy nhanh.
- UX đơn giản.
- User vào là dùng.
- Không cần học platform.
- Advanced marketer vẫn tối ưu sales page riêng được.

---

# 186. UX Benchmark — Skool, Connecty, MakeViral

Phần này bổ sung sau khi rà soát UI thực tế của ba nền tảng:

```text
Skool        → chuẩn UX community + classroom + membership admin
Connecty.vn  → tab Cửa hàng bán sản phẩm số ngay trong community
MakeViral    → sidebar không gian nội dung có khóa, link ngoài, mobile-first
```

Bài học rút ra:

- Community chỉ cần 6–7 tab cố định, không cho tùy biến sâu ở V1.
- Mọi thao tác thương mại của owner gói trong 1 modal per-member.
- Pricing là "chế độ" chọn 1 lần, không phải danh sách offer rời.
- Plugin/tiện ích bật tắt theo community, không cần code.
- Bán sản phẩm số phải nằm ngay trong community, không tách sang site khác.
- Người mới join phải được chào và dẫn đi trong 60 giây đầu.

Các mục 187–198 chuyển từng điểm thành thiết kế cụ thể, gắn với các mục đã có.

---

# 187. Community Pricing Mode

Community có đúng **một** `pricing_mode`:

```text
free          Vào miễn phí, không có gói trả phí
subscription  Trả theo tháng/năm mới vào được
freemium      Vào miễn phí, có 1–2 gói nâng cấp
tiers         2–3 gói trả phí, không có free
one_time      Trả một lần, truy cập trọn đời
```

Database:

```text
communities
  pricing_mode
  doors_open              (true/false — "Đóng cổng" ngừng nhận thành viên mới)

community_tiers
  id
  community_id
  key                     (standard | premium | vip)
  name
  description
  benefits_json
  is_default              (tier gán khi join không trả phí)
  is_active
  sort_order

tier_prices → dùng lại offers/prices ở mục 62
  tier_id
  offer_id                (monthly / yearly / one_time)
```

Quy tắc:

- `free` = 1 tier mặc định, không price.
- `freemium` = 1 tier mặc định + 1–2 tier có price.
- `subscription` / `tiers` = không tier mặc định; join phải qua checkout.
- `one_time` = 1 tier, 1 price kiểu one_time.
- `community_members.tier_id` là nguồn sự thật cho quyền lợi; entitlement (mục 63) sinh từ tier.

Đổi mode:

```text
Owner đổi mode
↓
Hệ thống hỏi: "N thành viên trả phí cũ sẽ xếp vào tier nào?"
↓
Migration job gán tier_id
↓
Entitlement được tính lại
```

Không cho đổi mode nếu còn subscription đang xử lý thanh toán.

Mặc định V1 cho creator Việt Nam:

```text
pricing_mode = freemium
tier mặc định = Tiêu chuẩn (free)
tier nâng cấp = Premium (tháng / năm)
```

**Build ngay:** `free`, `freemium`, `one_time`, đóng cổng.
**Để sau:** `tiers` nhiều bậc, trial, coupon theo tier.

---

# 188. Member Admin — Hồ sơ thương mại của một thành viên

Owner cần một modal duy nhất cho mỗi thành viên, gồm 4 tab:

```text
Thành viên   Email · Vai trò (đổi) · Tier (đổi) · Ngày tham gia
             Giá đang trả · Gia hạn sau N ngày · Giá trị trọn đời (LTV)
             Giới thiệu bởi (affiliate) · Xóa / Chặn / Hủy đăng ký
Khóa học     Tiến độ từng khóa, mở khóa thủ công
Thanh toán   Lịch sử giao dịch: ngày · số tiền · trạng thái · phương thức
Câu hỏi      Câu trả lời khi tham gia (mục 189)
```

Dữ liệu cần có sẵn để render modal không phải join 6 bảng lúc mở:

```text
community_members
  tier_id
  subscription_id
  referred_by_affiliate_id
  lifetime_value_cents      (denormalized, cập nhật khi payment.succeeded / refunded)
  last_payment_at
  next_renewal_at
```

Hành động và event:

```text
Đổi tier          → member.tier_changed → tính lại entitlement
Đổi vai trò       → member.role_changed
Xóa khỏi nhóm     → member.removed  (giữ lịch sử thanh toán)
Chặn              → member.banned   (không cho join lại)
Hủy đăng ký       → subscription.cancel_at_period_end
Mở khóa khóa học  → entitlement.granted (source = manual)
```

Mọi hành động ghi vào `audit_logs` (mục 38).

---

# 189. Membership Lifecycle và Bộ lọc thành viên

`community_members.status` chuẩn hóa:

```text
active       đang là thành viên
cancelling   đã hủy, còn quyền đến hết kỳ
churned      đã rời hoặc hết hạn
banned       bị chặn
pending      chờ duyệt (approval_required)
```

Chuyển trạng thái chỉ qua service layer:

```text
payment.succeeded        → active
subscription.cancelled   → cancelling
period_end (cron)        → churned
member.banned            → banned
join_request.approved    → active
```

Màn hình Thành viên:

```text
Tab đếm số:  Đang hoạt động · Đang hủy · Đã rời · Bị chặn · Chờ duyệt
Tìm kiếm:    tên, email, @handle
Lọc:         tier, vai trò, ngày tham gia, hoạt động gần nhất, nguồn (invite/affiliate/discovery)
Xuất CSV:    theo bộ lọc hiện tại (mục 71)
Mời:         email hoặc link (mục 59)
```

Cần thêm `community_members.last_active_at` cập nhật theo batch (không update mỗi request).

Bổ sung **Câu hỏi khi tham gia**:

```text
community_join_questions
  id · community_id · question · required · sort_order

member_join_answers
  member_id · question_id · answer
```

Tối đa 3 câu hỏi. Trả lời hiện trong tab Câu hỏi của modal và có thể sync sang email provider dưới dạng custom field.

---

# 190. Plugins — Tiện ích bật tắt theo community

Feature flags (mục 75) là của platform. Plugins là của owner, bật tắt trong Cài đặt, không cần code.

```text
community_plugins
  id
  community_id
  plugin_key
  enabled
  config_json
  updated_at
```

Danh sách plugin V1:

```text
welcome_dm         Nhắn tin chào tự động khi join (mục 194)
instant_approval   Tự duyệt yêu cầu tham gia
links              Khối liên kết trong info box (Fanpage, YouTube, Zalo…)
webhook            Mời/thêm thành viên qua webhook (mục 17)
meta_pixel         Pixel Facebook trên trang giới thiệu và checkout
```

Để sau:

```text
onboarding_video   Video chào ở lần đầu vào
cancellation_video Video giữ chân ở trang hủy
zapier             Kết nối Zapier/Make/n8n
google_ads         Google Ads tracking
```

Nguyên tắc:

- Mỗi plugin có một adapter/handler nghe event, không rải if/else trong core.
- `config_json` được validate theo schema của từng plugin.
- Plugin nào thuộc gói cao hơn thì hiện nhãn "Pro" và khóa toggle, không giấu.

---

# 191. Cấu trúc Cài đặt Community

Cây menu cố định, không cho thêm bớt:

```text
Cài đặt community
├── Tổng quan          số liệu 7/30 ngày: thành viên mới, doanh thu, bài đăng
├── Khám phá           hiện/ẩn trên marketplace, danh mục, ảnh bìa, mô tả ngắn
├── Mời thành viên     link mời, email mời, webhook
├── Chung              tên, slug, logo, mô tả, quy tắc, custom domain (mục 57)
├── Giá và gói         pricing_mode + tiers (mục 187)
├── Cộng sự            % hoa hồng, bật/tắt affiliate (mục 102, 198)
├── Tiện ích           plugins (mục 190)
├── Bảng tin           tab hiện/ẩn, chuyên mục + quyền đăng, quy tắc
├── Thông báo          email digest, thông báo owner
└── Thanh toán         payout account (mục 119), phương thức nhận tiền
```

Mỗi màn hình theo nguyên tắc Basic first / Advanced later (mục 174). Nút Lưu ở góc trên phải, có trạng thái "Đã lưu".

Tab cộng đồng mà member thấy cũng cố định, chỉ hiện/ẩn:

```text
Bảng tin · Khóa học · Sự kiện · Thành viên · Xếp hạng cộng sự · Cửa hàng · Giới thiệu
```

---

# 192. Cài đặt tài khoản (cấp user)

Tách hẳn khỏi cài đặt community:

```text
Tài khoản
├── Cộng đồng của tôi    sắp xếp, ghim sidebar, ẩn
├── Hồ sơ                tên, ảnh, bio, liên kết
├── Cộng sự               affiliate cấp platform (mục 101)
├── Rút tiền              payout account
├── Tài khoản             email, mật khẩu, MFA, xóa tài khoản (mục 78)
├── Thông báo             theo từng community (mục 67)
├── Tin nhắn              ai được nhắn cho tôi
├── Phương thức thanh toán
├── Lịch sử thanh toán    mọi community đã trả
└── Giao diện             sáng / tối / theo hệ thống
```

Database:

```text
user_community_prefs
  user_id · community_id · sort_order · pinned · hidden · notification_level
```

---

# 193. Điều hướng toàn cục — Switcher, Sidebar, Badge

Một user ở nhiều community (mục 4) nên app phải có lớp điều hướng **trên** community:

```text
Sidebar trái (264px)
├── Khối community hiện tại + switcher (dropdown các community đã tham gia)
├── Nhóm: Cộng đồng   Bảng tin · Thành viên · Sự kiện · Xếp hạng cộng sự (mục 200)
├── Nhóm: Học tập     Khóa học (kèm % tiến độ) · Tài nguyên (khóa nếu chưa có quyền)
├── Nhóm: Mua sắm     Cửa hàng
├── Nhóm: Quản trị    Cài đặt · Doanh thu   (chỉ owner/admin)
└── Nút: Mời thành viên
```

Thanh trên: tìm kiếm trong community hiện tại, tin nhắn, thông báo, avatar.

Badge tin nhắn và thông báo đếm **xuyên community**. Cần một endpoint tổng hợp nhẹ:

```text
GET /me/badges → { unread_messages, unread_notifications, per_community: {...} }
```

Cache 30 giây ở edge, invalidate khi có notification mới cho user đó.

Mobile: 5 tab dưới cùng, cố định:

```text
Bảng tin · Khóa học · Cửa hàng · Tin nhắn · Tôi
```

Không cho owner đổi tab bar ở V1.

---

# 194. Welcome DM — Tin nhắn chào tự động

Automation nhỏ nhất nhưng giá trị nhất: nhắn riêng cho người vừa join.

```text
member.joined
↓
plugin welcome_dm enabled?
↓
Render template với {{first_name}}, {{community_name}}, {{start_link}}
↓
Tạo conversation owner ↔ member
↓
Gửi message (sender = owner, flag automated = true)
↓
Đẩy notification + email nếu member chưa online
```

Config:

```text
config_json
  sender_user_id     (owner hoặc admin được chọn)
  template           (text, tối đa 1.000 ký tự)
  delay_minutes      (0 hoặc trễ vài phút cho tự nhiên)
  include_start_link (link tới "Bắt đầu tại đây")
```

Yêu cầu DM cơ bản (mục 66) được kéo lên V1.5 dưới dạng messaging không realtime: bảng `conversations`, `messages`, polling 15 giây, chưa cần WebSocket.

---

# 195. Post Composer — Chuyên mục, Bình chọn, Gửi email

Composer cố định, một dòng công cụ:

```text
[Ảnh] [Liên kết] [Video] [Bình chọn]   [Chuyên mục ▾]   [Đăng bài]
Toggle: Gửi email cho tất cả thành viên (chỉ owner/admin)
```

Quy tắc:

- Chuyên mục bắt buộc; mỗi chuyên mục có quyền đăng (`everyone | admins_only`).
- Video = paste URL, dùng embed (mục 23).
- Bình chọn:

```text
polls
  id · post_id · question · multiple_choice · closes_at
poll_options
  id · poll_id · label · sort_order
poll_votes
  poll_id · option_id · user_id   (unique poll_id + user_id nếu single choice)
```

- "Gửi email cho tất cả thành viên":

```text
post.created (broadcast = true)
↓
Job: gửi qua Resend theo batch 500, tôn trọng notification preference
↓
email_logs
```

Giới hạn broadcast theo plan (ví dụ 4 lần/tháng ở Free) trong `subscription_usage` (mục 81).

Go Live: **để sau**, chỉ đặt nút dẫn tới link Zoom/YouTube Live trong Sự kiện.

---

# 196. Tiến độ khóa học và trạng thái Draft

Bổ sung cho mục 157: cần tiến độ **cấp khóa học** để hiện % trên thẻ và sidebar mà không đếm lại từng bài mỗi lần.

```text
course_progress
  user_id
  course_id
  completed_lessons
  total_lessons
  percent                 (cache)
  last_lesson_id
  last_accessed_at
  completed_at
```

Cập nhật khi `lesson.completed`, khi thêm/xóa bài thì job tính lại `total_lessons` cho mọi user của khóa.

Trạng thái khóa học:

```text
draft       chỉ owner/admin thấy, có nhãn "Nháp"
published   hiện theo visibility (mục 155)
archived    ẩn khỏi danh sách, người đã học vẫn vào được
```

Thẻ khóa học hiện: ảnh bìa, tên, mô tả 2 dòng, thanh % tiến độ hoặc nhãn "Nháp" / khóa nếu thuộc tier cao hơn.

Trang bài học: curriculum bên trái (module gập/mở, bài đã học có dấu, bài hiện tại đánh dấu, bài thuộc tier cao hơn hiện ổ khóa + tên tier), video nhúng bên phải, nút "Đánh dấu hoàn thành" và "Bài tiếp theo", tài liệu đính kèm (R2, mục 21), thảo luận theo bài (comment với `target_type = lesson`).

---

# 197. Cửa hàng trong Community

Học từ Connecty: tab **Cửa hàng** nằm trong community, bán sản phẩm số bằng đúng Product/Offer (mục 62) và Standard Product Page (mục 163).

Loại sản phẩm V1:

```text
course       khóa học (mục 141)
bundle       combo nhiều khóa
digital      file tải về (PDF, template, prompt pack) — lưu R2, phát bằng signed URL
```

Thẻ sản phẩm cố định:

```text
Ảnh bìa · Nhãn loại + số bài + thời lượng · Tên · Mô tả 1–2 dòng
Giá · Giá gốc gạch · Badge -N% (tự tính) · Nút Mua
Đã sở hữu → nút "Vào học" / "Tải về"
```

Combo:

```text
bundle_items
  bundle_product_id · item_product_id
```

Mua combo tạo entitlement cho từng item (mục 150). Nếu đã sở hữu một phần, checkout hiện "đã có 2/9, giảm giá phần còn lại" — **để sau**, V1 chỉ chặn mua trùng.

Bộ lọc tab: Tất cả · Khóa học · Combo · Tài liệu. Sắp xếp: mới nhất, bán chạy, giá.

---

# 198. Discovery, Marketplace và Affiliate UI

## Discovery

Trang công khai `/kham-pha`:

```text
Hero: tiêu đề + thanh tìm kiếm
Chip danh mục: Kinh doanh · Công nghệ và AI · Sáng tạo nội dung · Sức khỏe · Phát triển bản thân · Học tập · Ngoại ngữ
Lưới thẻ community: ảnh bìa · logo · tên · mô tả ngắn · số thành viên · giá (Miễn phí / từ Xđ/tháng)
```

Chỉ community bật "Hiện trên Khám phá" và có ≥ 1 bài đăng công khai mới được liệt kê. Xếp hạng V1: hoạt động 7 ngày gần nhất, không cần thuật toán phức tạp.

```text
communities
  discoverable
  category_key
  short_description
  cover_image_url
```

Dữ liệu Discovery cache 5 phút ở edge (mục 43).

## Affiliate UI (gắn với mục 100–137)

Cài đặt community → Cộng sự:

```text
Hoa hồng: Tắt · 10% · 20% · 30% · 40% (khuyên dùng) · 50%
Hold: 14 ngày (mặc định, mục 112)
```

Tài khoản → Cộng sự:

```text
3 ô số: 30 ngày qua · Trọn đời · Số dư có thể rút  +  nút Rút tiền
Chip chọn link: Nền tảng Hội Mình · từng community đang tham gia
Ô link + nút Sao chép
Bảng: người giới thiệu · ngày · trạng thái (đang giữ / đã duyệt / đã trả)
```

Trong modal thành viên (mục 188) hiện "Giới thiệu bởi …" đọc từ `affiliate_conversions`.

**Build ngay:** Discovery cơ bản, chọn % hoa hồng, dashboard 3 ô số + link.
**Để sau:** xếp hạng theo doanh thu, affiliate coupon (mục 114), bảng xếp hạng cộng sự.

---

# 199. Fast Deploy Update — V1.5 UX

## Build ngay

- `pricing_mode` với free / freemium / one_time, đóng cổng, migration tier.
- Modal thành viên 4 tab, `lifetime_value_cents`, `referred_by_affiliate_id`.
- Trạng thái thành viên 5 giá trị + bộ lọc + xuất CSV.
- 5 plugin: welcome_dm, instant_approval, links, webhook, meta_pixel.
- Cây Cài đặt community 10 mục và Cài đặt tài khoản 10 mục, cố định.
- Sidebar + switcher + badge xuyên community, mobile 5 tab.
- Messaging không realtime để chạy Welcome DM.
- Composer: chuyên mục bắt buộc, bình chọn, gửi email cho tất cả.
- `course_progress` cache, trạng thái draft/published/archived.
- Tab Cửa hàng với course / bundle / digital.
- Discovery cơ bản, affiliate % và dashboard 3 ô số.

## Để sau

- `tiers` nhiều bậc, trial, coupon theo tier.
- Realtime chat, Go Live.
- Onboarding video, cancellation video, Zapier, Google Ads plugin.
- Giảm giá combo theo phần đã sở hữu.
- Xếp hạng Discovery theo doanh thu, bảng xếp hạng cộng sự.

---

# 200. Xếp hạng cộng sự thay cho Bảng xếp hạng hoạt động

Quyết định: **không build bảng xếp hạng hoạt động** kiểu điểm/level (mục 65). Thay bằng **Xếp hạng cộng sự** của từng community, vì đây là thứ trực tiếp tạo doanh thu cho owner và động lực thật cho thành viên.

Mục 65 giữ nguyên schema nhưng chuyển sang trạng thái "để sau, feature flag OFF". Tab và mục sidebar "Bảng xếp hạng" đổi thành "Xếp hạng cộng sự".

## Dữ liệu

Không tạo bảng mới. Xếp hạng tính từ `affiliate_conversions` và `affiliate_commissions` (mục 110–111), gom theo kỳ:

```text
affiliate_leaderboard_snapshots     (cache, tính lại mỗi 10 phút bằng cron)
  community_id
  period_type            month | quarter | all_time
  period_key             2026-09 | 2026-Q3 | all
  affiliate_account_id
  rank
  referrals_count        số người đăng ký qua link
  paid_count             số người đã trả phí
  revenue_cents          doanh thu mang về
  commission_cents       hoa hồng đã duyệt (sau hold)
  rank_delta             so với kỳ trước
  computed_at
```

Chỉ tính commission ở trạng thái `approved`/`paid`; `pending` (đang hold) và `reversed` (refund) không vào bảng.

## Màn hình

```text
Tiêu đề + chip kỳ: Tháng này · Quý · Từ đầu
Top 3 dạng thẻ: hạng, avatar, tên, số giới thiệu · số trả phí, hoa hồng kỳ này
Bảng hạng 4 trở đi: Hạng · Cộng sự · Giới thiệu · Trả phí · Doanh thu · Hoa hồng · So kỳ trước
Dòng "bạn" luôn được tô nền, kể cả khi ngoài top
Cột phải: link cộng sự của tôi + 3 ô số (lượt bấm · đăng ký · trả phí), cách tính, tổng cộng sự kỳ này
```

## Quyền xem

Owner chọn trong Cài đặt → Cộng sự:

```text
leaderboard_visibility
  members          mọi thành viên thấy (mặc định)
  affiliates_only  chỉ người đã lấy link
  hidden           tắt tab

leaderboard_show_money
  true             hiện doanh thu và hoa hồng
  false            chỉ hiện số giới thiệu và số trả phí
```

Mặc định `members` + `true` vì con số tiền là thứ tạo động lực; owner ngại lộ doanh thu thì tắt cột tiền.

## Sự kiện liên quan

```text
affiliate.rank_changed   → notification cho cộng sự khi lên/xuống hạng top 10
affiliate.period_closed  → snapshot cuối kỳ được đóng băng, dùng cho thưởng theo hạng (để sau)
```

**Build ngay:** snapshot theo tháng và từ đầu, top 3 + bảng, dòng "bạn", link + 3 ô số, 2 tùy chọn quyền xem.
**Để sau:** kỳ quý, thưởng theo hạng, xếp hạng liên community ở cấp platform.

---

# 201. Affiliate chi trả thủ công — theo mô hình Tiền Nhà Mình

Quyết định: **Hội Mình không tự chuyển tiền hoa hồng**. Người chi trả chuyển khoản ngoài hệ thống rồi ghi mã tham chiếu; hệ thống chỉ giữ sổ cái. Áp dụng cho cả hai tầng (mục 100):

```text
Community Affiliate   → chủ hội chuyển khoản cho cộng sự trong hội
Platform Affiliate    → Hội Mình chuyển khoản cho người giới thiệu chủ hội mới
```

Hệ quả với mục 118–119 (Payout Architecture): bỏ luồng payout tự động qua API ngân hàng ở V1. Hoa hồng cộng sự trong hội **không bị trừ** khỏi số dư rút của chủ hội (mục 34, 197); chủ hội nhận đủ rồi tự trả, màn Doanh thu hiện cột "Nợ cộng sự".

## Sổ cái ví cộng sự (lấy nguyên từ Tiền Nhà Mình)

```text
affiliate_wallet_entries
  id · affiliate_account_id · commission_id · withdrawal_id
  entry_type        credit | hold | release | debit | adjustment
  amount_minor · currency_code
  idempotency_key   UNIQUE
  note · created_at

Số dư khả dụng = SUM(credit + release + adjustment) − SUM(hold + debit)
```

- Không có cột `balance`; số dư luôn suy ra từ bút toán. Admin không sửa tay.
- `hold` ghi ngay khi tạo yêu cầu rút, nên hai yêu cầu gửi liên tiếp không tiêu cùng một khoản. Điều kiện đủ số dư nằm **trong** câu INSERT, không kiểm tra tách rời.
- `idempotency_key` (`withdrawal-hold:<id>`, `withdrawal-release:<id>`) chặn ghi trùng khi gọi lại.

## Vòng đời hoa hồng

```text
payment.succeeded (webhook đã verify)
↓ createCommissionForPayment — UNIQUE(payment_id, rule_version) chống trùng
pending      giữ hold_days (community: 14, platform: 30)
↓ cron hằng ngày
available    ghi bút toán credit vào ví
reversed     nếu refund/chargeback trong thời gian giữ → không vào ví
paid         khi yêu cầu rút được đánh dấu đã trả
```

Tỷ lệ hoa hồng: mức chung của chương trình, có thể ghi đè riêng từng cộng sự (`commission_rate_bps` NULL = dùng mức chung). Làm tròn xuống.

## Thông tin nhận tiền

```text
affiliate_payout_profiles
  affiliate_account_id · encrypted_payload · key_version · masked_account · updated_at
```

- Mã hóa khi lưu, chỉ trả về `masked_account` ("Vietcombank ••••4521"), kể cả cho chính chủ.
- Mỗi yêu cầu rút lưu `payout_snapshot_encrypted` tại thời điểm gửi: cộng sự đổi tài khoản sau đó thì người chi trả vẫn chuyển đúng nơi đã xác nhận.
- Mở xem số tài khoản đầy đủ là một quyền riêng (`affiliates:manage`) và ghi audit log.

## Yêu cầu rút

```text
affiliate_withdrawal_requests
  id · affiliate_account_id · program_id · amount_minor · currency_code
  payout_snapshot_encrypted
  status     requested → reviewing → paid | rejected ; requested → cancelled
  version    (optimistic lock, tránh hai admin cùng xử lý)
  transfer_reference · rejection_reason
  requested_at · reviewed_at · paid_at
```

Luồng:

```text
Cộng sự nhập tài khoản nhận tiền
↓ gửi yêu cầu ≥ min_withdrawal (mặc định 500.000đ), hệ thống ghi hold
↓ người chi trả thấy hàng đợi, bấm Xem xét → mở số tài khoản (audit)
↓ chuyển khoản bằng app ngân hàng (màn hình sinh sẵn QR có số tiền + nội dung)
↓ nhập mã tham chiếu → paid, ghi debit
   hoặc từ chối kèm lý do → rejected, ghi release trả về ví
Cộng sự chỉ hủy được khi còn requested
```

Cấu hình mỗi chương trình (community hoặc platform): `commission_rate_bps`, `hold_days`, `min_withdrawal_minor`; đổi được trong Cài đặt, không cần deploy.

## Màn hình

```text
Thành viên   Tài khoản → Cộng sự: link + 3 số, 4 ô ví (đang giữ · có thể rút · chờ duyệt · đã nhận),
             tài khoản nhận tiền, ô rút tiền, lịch sử rút, hoa hồng gần đây
Chủ hội      Cài đặt → Cộng sự → Yêu cầu rút: hàng đợi, panel xem xét (số TK, QR, mã tham chiếu,
             từ chối), lịch sử; Doanh thu hiện "Nợ cộng sự"
Hệ thống     Cộng sự nền tảng: cùng hàng đợi, cấu hình chung, đối tác có hoa hồng riêng
```

**Build ngay:** sổ cái, hold/release, yêu cầu rút với snapshot, hàng đợi và đánh dấu đã trả, mã hóa thông tin ngân hàng, audit.
**Để sau:** chuyển khoản tự động qua API ngân hàng, xuất chứng từ thuế, lịch chi trả cố định.

---

# 202. Gói nền tảng V1 — một gói, tháng hoặc năm, không phí giao dịch

Điều chỉnh mục 34 và 35:

- **Không thu phí giao dịch** trên tiền thành viên trả cho chủ hội. Doanh thu của Hội Mình chỉ đến từ gói nền tảng. Bỏ mọi cột "phí" trong Doanh thu và Nhận tiền của chủ hội; `payments.platform_fee_cents` giữ trong schema nhưng luôn bằng 0 ở V1.
- **Một gói duy nhất**, đầy đủ tính năng, hai chu kỳ:

```text
plans
  key: hoiminh          (gói duy nhất)
  billing_cycle: monthly | yearly    (năm = 10 tháng, tức 2 tháng miễn phí)
  trial_days: 14        (không cần thẻ; hết hạn thì khóa tạo nội dung, không xóa dữ liệu)
  quotas: không giới hạn hội, thành viên, khóa học, video, sự kiện
  features: cộng sự, cửa hàng, tên miền riêng, tiện ích, API/webhook/MCP
```

- Bảng `plans` và `subscription_usage` (mục 34, 81) vẫn giữ để sau này thêm gói thấp hơn mà không đổi lõi.

Luồng đăng ký chủ hội (kiểu Skool):

```text
/tao-hoi          trang giới thiệu: tiêu đề, băng chuyền hội tiêu biểu, nút "Tạo hội của bạn"
↓
/tao-hoi/goi      chọn Theo tháng / Theo năm (nhãn "2 tháng miễn phí"), một thẻ gói, nút "Dùng thử 14 ngày miễn phí"
↓
Tạo tài khoản (email + mật khẩu hoặc Google)
↓
Tạo hội của bạn (mục 176: một màn 6 bước)
↓
Vào hội, checklist hoàn thiện (mục 58)
```

Thanh toán gói nền tảng đi qua đúng Payment Integration Layer (mục 34A): chuyển khoản QR, MoMo, VNPAY; PayPal cho chủ hội ở nước ngoài. Nhắc gia hạn trước 7, 3, 1 ngày và ngày hết hạn.
