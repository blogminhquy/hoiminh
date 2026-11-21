// API key được gọi đường dẫn nào, cần phạm vi gì. Mặc định là CHẶN: đường dẫn không có trong bảng thì key nào cũng không vào được.
//
// Vì sao cần bảng này ngoài quyền ở service layer: API key chạy dưới tên chủ workspace (`actor.userId` là chủ hội), nên mọi
// service chỉ hỏi "ai đang gọi" (`requireUser`) đều coi key là chính chủ hội, bất kể key có phạm vi gì. Trước 1.35.0 một key
// chỉ có `communities:read` vẫn gọi được `/v1/me/*` (tin nhắn, hồ sơ, 2FA, rút tiền) và tự tạo được key toàn quyền.
//
// Những việc cố ý KHÔNG mở cho key nào (chỉ làm trên web): quản lý API key, mật khẩu và 2FA, tài khoản nhận tiền và khóa cổng
// thanh toán, lưu trữ hội, quản trị hệ thống `/v1/admin`. Trợ lý AI đọc bài và tin nhắn do thành viên viết, nên các việc
// chuyển hướng dòng tiền hay cấp thêm quyền phải có người bấm.
import { API_SCOPE_LABELS, type ApiScope } from '@hoiminh/contracts';

type Need = readonly ApiScope[] | 'any';

const C = '/v1/communities/:id';
const WRITE_SCOPES = ['posts:write', 'courses:write', 'store:write', 'communities:write', 'messages:write'] as const;

/** `PHƯƠNG THỨC đường-dẫn` → phạm vi cần (có một trong các phạm vi là đủ). `:tên` khớp một đoạn, `*` khớp phần còn lại. */
const RULES: ReadonlyArray<readonly [string, Need]> = [
  // Danh tính, cấu hình, dữ liệu công khai
  ['GET /v1/me/integration', 'any'],
  ['GET /v1/me/communities', 'any'],
  ['GET /v1/me/id', 'any'],
  ['GET /v1/me/workspace', ['communities:read']],
  ['GET /v1/plans', 'any'],
  ['GET /v1/users/:handle', 'any'],
  ['GET /v1/communities/discover', 'any'],
  ['POST /v1/communities/slug-available', 'any'],

  // Hội
  ['POST /v1/communities', ['communities:write']],
  ['GET /v1/communities/by-slug/:slug', ['communities:read']],
  ['GET /v1/communities/by-slug/:slug/shell', ['communities:read']],
  [`PATCH ${C}/general`, ['communities:write']],
  [`PUT ${C}/about-media`, ['communities:write']],
  [`GET ${C}/plugins`, ['communities:write']],
  [`PUT ${C}/plugins/:key`, ['communities:write']],
  [`GET ${C}/feed-settings`, ['communities:write']],
  [`PUT ${C}/feed-settings`, ['communities:write']],
  [`PUT ${C}/join-questions`, ['communities:write']],
  [`GET ${C}/overview`, ['communities:write']],
  [`GET ${C}/plan`, ['communities:write']],
  [`GET ${C}/leaderboard`, ['communities:read']],

  // Tiền: xem doanh thu, giá gói, đơn chờ xác nhận, hoàn tiền. Tài khoản nhận tiền và cổng thanh toán không có ở đây.
  [`GET ${C}/revenue`, ['revenue:read', 'affiliates:read']],
  [`GET ${C}/pricing`, ['communities:write']],
  [`PUT ${C}/pricing`, ['billing:manage']],
  [`GET ${C}/orders/pending`, ['billing:manage']],
  [`GET ${C}/orders/:orderId`, ['revenue:read', 'billing:manage']],
  [`POST ${C}/orders/:orderId/confirm-received`, ['billing:manage']],
  ['POST /v1/orders/:id/admin-refund', ['billing:manage']],

  // Affiliate
  [`GET ${C}/affiliate`, ['affiliates:manage']],
  [`PUT ${C}/affiliate`, ['affiliates:manage']],
  [`GET ${C}/affiliate/payouts`, ['affiliates:manage']],
  [`GET ${C}/affiliate/payouts/export.csv`, ['affiliates:manage']],
  ['POST /v1/withdrawals/:id/review', ['affiliates:manage']],
  ['POST /v1/withdrawals/:id/paid', ['affiliates:manage']],
  ['POST /v1/withdrawals/:id/reject', ['affiliates:manage']],

  // Thành viên
  [`GET ${C}/members`, ['members:read']],
  [`GET ${C}/members/directory`, ['members:read']],
  [`GET ${C}/members/export.csv`, ['members:read']],
  [`GET ${C}/members/:memberId`, ['members:read']],
  [`PATCH ${C}/members/:memberId`, ['members:write', 'entitlements:write']],
  [`POST ${C}/members/:memberId/actions`, ['members:write']],
  [`POST ${C}/members/:memberId/grant-course`, ['members:write', 'entitlements:write']],
  [`POST ${C}/invites`, ['members:write']],

  // Bảng tin
  // `posts:write` cũng đọc được bảng tin: đăng bài phải tra chuyên mục, và chuyên mục nằm trong phản hồi của bảng tin.
  [`GET ${C}/feed`, ['communities:read', 'posts:write']],
  ['GET /v1/posts/:id', ['communities:read']],
  ['GET /v1/comments', ['communities:read']],
  [`POST ${C}/posts`, ['posts:write']],
  ['POST /v1/comments', ['posts:write']],
  ['PATCH /v1/posts/:id', ['posts:moderate']],
  ['DELETE /v1/posts/:id', ['posts:moderate']],
  ['POST /v1/posts/:id/moderate', ['posts:moderate']],
  ['POST /v1/comments/:id/pin', ['posts:moderate']],
  ['DELETE /v1/comments/:id', ['posts:moderate']],

  // Khóa học
  [`GET ${C}/courses`, ['courses:read', 'courses:write']],
  ['GET /v1/courses/:id', ['courses:read', 'courses:write']],
  ['GET /v1/courses/:id/certificate/:userId', 'any'],
  ['GET /v1/lessons/:id', ['courses:read', 'courses:write']],
  [`POST ${C}/courses`, ['courses:write']],
  ['PATCH /v1/courses/:id', ['courses:write']],
  ['DELETE /v1/courses/:id', ['courses:write']],
  ['POST /v1/courses/:id/modules', ['courses:write']],
  ['PATCH /v1/courses/:id/modules/:moduleId', ['courses:write']],
  ['DELETE /v1/modules/:id', ['courses:write']],
  ['POST /v1/courses/:id/lessons', ['courses:write']],
  ['PATCH /v1/courses/:id/lessons/:lessonId', ['courses:write']],
  ['DELETE /v1/lessons/:id', ['courses:write']],
  ['PUT /v1/courses/:id/reorder', ['courses:write']],
  ['POST /v1/video/parse', ['courses:write']],
  ['POST /v1/video/meta', ['courses:write']],

  // Sự kiện
  [`GET ${C}/events`, ['communities:read']],
  [`GET ${C}/recordings`, ['communities:read']],
  ['GET /v1/events/:id', ['communities:read']],
  [`POST ${C}/events`, ['events:write']],
  ['PATCH /v1/events/:id', ['events:write']],
  ['POST /v1/events/:id/recordings', ['events:write']],
  ['GET /v1/events/:id/attendees', ['events:write']],

  // Cửa hàng
  [`GET ${C}/products`, ['communities:read', 'store:write']],
  ['GET /v1/products/:id', ['communities:read', 'store:write']],
  [`POST ${C}/products`, ['store:write']],
  ['PATCH /v1/products/:id', ['store:write']],
  ['DELETE /v1/products/:id', ['store:write']],

  // Thẻ và quy tắc tự động (`communities:write` giữ lại cho key tạo trước 1.35.0)
  [`GET ${C}/automation/*`, ['automation:manage', 'communities:write']],
  [`POST ${C}/automation/*`, ['automation:manage', 'communities:write']],
  [`PATCH ${C}/automation/*`, ['automation:manage', 'communities:write']],
  [`DELETE ${C}/automation/*`, ['automation:manage', 'communities:write']],

  // Tin nhắn và thông báo của chủ hội
  ['GET /v1/me/conversations', ['messages:read', 'messages:write']],
  ['GET /v1/me/conversations/:id/messages', ['messages:read', 'messages:write']],
  ['GET /v1/me/notifications', ['messages:read', 'messages:write']],
  ['POST /v1/me/messages', ['messages:write']],

  // Webhook gửi đi
  ['GET /v1/workspaces/:id/webhooks', ['webhooks:manage']],
  ['POST /v1/workspaces/:id/webhooks', ['webhooks:manage']],
  ['DELETE /v1/workspaces/:id/webhooks/:webhookId', ['webhooks:manage']],

  // Tải tệp lên (ảnh bài viết, bìa khóa học, tệp sản phẩm số): key nào có quyền ghi nội dung thì tải được
  ['POST /v1/files/upload-url', WRITE_SCOPES],
  ['POST /v1/files/:id/complete', WRITE_SCOPES],
  ['DELETE /v1/files/:id', WRITE_SCOPES],
];

const COMPILED = RULES.map(([rule, need]) => {
  const [method, pattern] = rule.split(' ') as [string, string];
  const source = pattern.split('/').map((seg) => (seg === '*' ? '.+' : seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return { method, re: new RegExp(`^${source}$`), need };
});

export type ApiKeyAccess = { ok: true } | { ok: false; message: string };

/** Key có phạm vi `scopes` gọi `method path` được không. Chỉ áp cho `/v1`; ngoài `/v1` (webhook, /files, /mcp) có cách kiểm riêng. */
export function apiKeyAccess(method: string, path: string, scopes: readonly string[]): ApiKeyAccess {
  if (!path.startsWith('/v1/') && path !== '/v1') return { ok: true };
  const verb = method === 'HEAD' ? 'GET' : method;
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const rule = COMPILED.find((r) => r.method === verb && r.re.test(clean));
  if (!rule) return { ok: false, message: 'Thao tác này không mở cho API key, chỉ làm được trên web Hội Mình.' };
  if (rule.need === 'any' || rule.need.some((s) => scopes.includes(s))) return { ok: true };
  const wanted = rule.need.map((s) => `${s} (${API_SCOPE_LABELS[s]})`).join(' hoặc ');
  return { ok: false, message: `API key thiếu phạm vi ${wanted}. Tạo key mới có phạm vi này ở Hội của tôi, Nhà phát triển.` };
}

/** Bảng luật dạng đọc được, cho test đối chiếu với các route đang có. */
export const API_KEY_RULES = RULES;
