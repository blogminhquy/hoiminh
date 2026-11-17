// Bộ lệnh MCP của Hội Mình: mỗi lệnh là một lượt gọi REST `/v1` bằng chính API key của người gọi.
// Không lệnh nào chạm database trực tiếp, nên quyền, hạn mức gói, nhật ký và giới hạn số lần gọi đều giống hệt gọi REST.
// Dữ liệu đầu vào lấy thẳng từ schema của `@hoiminh/contracts`, sửa hợp đồng API là lệnh MCP đổi theo.
import {
  affiliateSettingsSchema, automationRuleSchema, contactCreateSchema, contactFilterSchema, createCommentSchema, createCommunitySchema, createCourseSchema,
  createEventSchema, createPostSchema, createProductSchema, createWebhookSchema, eventRecordingSchema, eventsQuerySchema, feedQuerySchema, feedSettingsSchema,
  inboundSourceSchema, inboundSourceUpdateSchema, inviteSchema, joinQuestionSchema, leaderboardQuerySchema, lessonInputSchema, markPaidSchema, memberFilterSchema,
  moduleInputSchema, rejectWithdrawalSchema, reorderSchema, storeQuerySchema, tagNameSchema, updateCommunityGeneralSchema, updateCourseSchema,
  updateEventSchema, updateLessonSchema, updateMemberSchema, updatePluginSchema, pluginKeySchema, updatePricingSchema, updateProductSchema, type ApiScope,
} from '@hoiminh/contracts';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Gọi REST của Hội Mình bằng API key của phiên MCP. Ném `ApiError` khi API trả lỗi. */
export type Api = (method: HttpMethod, path: string, body?: unknown) => Promise<unknown>;

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

/** `read`: chỉ đọc. `write`: tạo hoặc sửa. `delete`: xóa hoặc việc khó hoàn lại (trợ lý nên hỏi lại người dùng trước khi gọi). */
type Effect = 'read' | 'write' | 'delete';

export interface Tool {
  name: string;
  title: string;
  description: string;
  /** Key cần có một trong các phạm vi này; mảng rỗng là key nào cũng gọi được. */
  scopes: readonly ApiScope[];
  effect: Effect;
  input: z.AnyZodObject;
  run(api: Api, args: Record<string, unknown>): Promise<unknown>;
}

const id = (what: string) => z.string().uuid().describe(what);
const communityId = id('Id hội, lấy từ list_communities');
const days = z.coerce.number().int().min(1).max(365).optional().describe('Số ngày gần nhất, mặc định 30');

interface RestDef {
  name: string;
  title: string;
  description: string;
  scopes: readonly ApiScope[];
  effect?: Effect;
  method: HttpMethod;
  /** Đường dẫn REST, `{tên}` lấy từ tham số cùng tên. */
  path: string;
  /** Tham số trên đường dẫn và trên query. */
  params?: z.ZodRawShape;
  /** Thân request (POST, PUT, PATCH) hoặc bộ lọc (GET), lấy từ hợp đồng API. */
  data?: z.AnyZodObject;
}

/** Lệnh là một lượt gọi REST: tham số có tên trên đường dẫn thì điền vào đường dẫn, phần còn lại thành query (GET, DELETE) hoặc thân JSON. */
function rest(def: RestDef): Tool {
  const input = z.object(def.params ?? {}).merge(def.data ?? z.object({}));
  const effect = def.effect ?? (def.method === 'GET' ? 'read' : def.method === 'DELETE' ? 'delete' : 'write');
  return {
    name: def.name, title: def.title, description: def.description, scopes: def.scopes, effect, input,
    run: (api, args) => {
      const onPath = new Set<string>();
      const path = def.path.replace(/\{(\w+)\}/g, (_, key: string) => {
        onPath.add(key);
        return encodeURIComponent(String(args[key]));
      });
      const others = Object.entries(args).filter(([k, v]) => !onPath.has(k) && v !== undefined);
      if (def.method === 'GET' || def.method === 'DELETE') {
        const qs = new URLSearchParams(others.filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)])).toString();
        return api(def.method, qs ? `${path}?${qs}` : path);
      }
      return api(def.method, path, Object.fromEntries(others));
    },
  };
}

/** Key có quyền ghi nội dung nào thì tải tệp cho nội dung đó được. */
const UPLOAD_SCOPES = ['posts:write', 'courses:write', 'store:write', 'communities:write'] as const;
const C = '/v1/communities/{communityId}';
const A = `${C}/automation`;

/** Tìm chuyên mục để đăng bài: theo id, theo tên hoặc slug, không nói gì thì lấy "Thông báo" hoặc chuyên mục đầu tiên. */
async function resolveSpace(api: Api, community: string, wanted: { spaceId?: string; space?: string }, fallbackSlug = 'thong-bao'): Promise<string> {
  if (wanted.spaceId) return wanted.spaceId;
  const feed = (await api('GET', `/v1/communities/${community}/feed?limit=1`)) as { spaces?: Array<{ id: string; slug: string; name: string }> };
  const spaces = feed.spaces ?? [];
  const key = wanted.space?.trim().toLowerCase();
  const hit = key ? spaces.find((s) => s.slug === key || s.name.toLowerCase() === key) : (spaces.find((s) => s.slug === fallbackSlug) ?? spaces[0]);
  if (!hit) throw new ApiError('validation_error', key ? `Không có chuyên mục "${wanted.space}". Các chuyên mục đang có: ${spaces.map((s) => s.name).join(', ') || '(chưa có)'}` : 'Hội chưa có chuyên mục nào, tạo chuyên mục bằng update_feed_settings trước', 422);
  return hit.id;
}

const postInput = createPostSchema.omit({ spaceId: true }).extend({
  communityId,
  spaceId: id('Id chuyên mục (xem ở list_posts, trường spaces)').optional(),
  space: z.string().max(60).optional().describe('Tên hoặc slug chuyên mục, dùng thay cho spaceId. Bỏ trống thì đăng vào "Thông báo"'),
});

async function workspaceId(api: Api): Promise<string> {
  const info = (await api('GET', '/v1/me/integration')) as { workspaceId: string | null };
  if (!info.workspaceId) throw new ApiError('forbidden', 'Lệnh này cần API key của một workspace', 403);
  return info.workspaceId;
}

export const TOOLS: Tool[] = [
  // ===== Kết nối =====
  rest({ name: 'get_connection_info', title: 'Thông tin kết nối', scopes: [], method: 'GET', path: '/v1/me/integration', description: 'Key đang dùng thuộc workspace nào, có những phạm vi gì, MCP có đang bật không. Gọi đầu tiên khi cần biết mình làm được gì.' }),
  rest({ name: 'list_communities', title: 'Danh sách hội', scopes: [], method: 'GET', path: '/v1/me/communities', description: 'Các hội mà API key quản lý, kèm id, slug, số thành viên. Hầu hết lệnh khác cần communityId lấy từ đây.' }),
  rest({ name: 'get_workspace', title: 'Hội của tôi', scopes: ['communities:read'], method: 'GET', path: '/v1/me/workspace', description: 'Màn "Hội của tôi": từng hội kèm doanh thu 30 ngày, gói đang dùng, ngày hết hạn và đội ngũ quản trị.' }),

  // ===== Hội =====
  rest({ name: 'get_community', title: 'Xem hội', scopes: ['communities:read'], method: 'GET', path: '/v1/communities/by-slug/{slug}/shell', params: { slug: z.string().describe('Slug của hội, lấy từ list_communities') }, description: 'Thông tin một hội: tên, mô tả, các tab đang bật, số thành viên, số người đang trực tuyến, sự kiện sắp tới, gói Premium đang bán.' }),
  rest({ name: 'get_community_overview', title: 'Tổng quan hội', scopes: ['communities:write'], method: 'GET', path: `${C}/overview`, params: { communityId, days }, description: 'Số liệu tổng quan của hội trong N ngày: thành viên mới, doanh thu, tỉ lệ chuyển đổi, hoạt động.' }),
  rest({ name: 'get_community_plan', title: 'Gói Hội Mình của hội', scopes: ['communities:write'], method: 'GET', path: `${C}/plan`, params: { communityId }, description: 'Gói nền tảng hội đang dùng, số thành viên so với trần của gói, bảng gói để nâng cấp.' }),
  rest({ name: 'create_community', title: 'Tạo hội', scopes: ['communities:write'], method: 'POST', path: '/v1/communities', data: createCommunitySchema, description: 'Tạo hội mới trong workspace. Giá tính bằng đồng (149000 là 149.000đ). slug chỉ gồm chữ thường, số và gạch ngang.' }),
  rest({ name: 'update_community', title: 'Sửa thông tin hội', scopes: ['communities:write'], method: 'PATCH', path: `${C}/general`, params: { communityId }, data: updateCommunityGeneralSchema, description: 'Sửa tên, slug, mô tả, danh mục, nội quy, video giới thiệu, liên kết, có hiện ở trang Khám phá hay không. Chỉ gửi trường cần đổi.' }),
  rest({ name: 'get_feed_settings', title: 'Xem cài đặt bảng tin', scopes: ['communities:write'], method: 'GET', path: `${C}/feed-settings`, params: { communityId }, description: 'Các tab đang bật, danh sách chuyên mục và ai được đăng trong từng chuyên mục, số ngày duyệt bài của thành viên mới.' }),
  rest({ name: 'update_feed_settings', title: 'Sửa cài đặt bảng tin', scopes: ['communities:write'], method: 'PUT', path: `${C}/feed-settings`, params: { communityId }, data: feedSettingsSchema, description: 'Bật tắt tab, thêm sửa chuyên mục, đặt số ngày duyệt bài của thành viên mới. Gửi `spaces` là gửi đủ cả danh sách chuyên mục muốn giữ.' }),
  rest({ name: 'list_plugins', title: 'Danh sách tiện ích', scopes: ['communities:write'], method: 'GET', path: `${C}/plugins`, params: { communityId }, description: 'Các tiện ích của hội (tin nhắn chào mừng, duyệt tự động, liên kết, webhook, Meta Pixel) và cấu hình hiện tại.' }),
  rest({ name: 'update_plugin', title: 'Bật tắt tiện ích', scopes: ['communities:write'], method: 'PUT', path: `${C}/plugins/{key}`, params: { communityId, key: pluginKeySchema.describe('Khóa tiện ích') }, data: updatePluginSchema, description: 'Bật, tắt và cấu hình một tiện ích của hội. Xem cấu hình hiện tại bằng list_plugins trước khi sửa.' }),
  rest({ name: 'set_join_questions', title: 'Đặt câu hỏi tham gia', scopes: ['communities:write'], method: 'PUT', path: `${C}/join-questions`, params: { communityId }, data: z.object({ questions: z.array(joinQuestionSchema).max(3).describe('Tối đa 3 câu. Gửi mảng rỗng để bỏ hết câu hỏi') }), description: 'Thay toàn bộ câu hỏi người mới phải trả lời khi xin vào hội.' }),

  // ===== Tiền =====
  rest({ name: 'get_revenue', title: 'Doanh thu', scopes: ['revenue:read', 'affiliates:read'], method: 'GET', path: `${C}/revenue`, params: { communityId, days }, description: 'Doanh thu của hội trong N ngày: tổng thu, theo nguồn (gói thành viên, khóa học, sản phẩm), các đơn gần đây. Tiền tính bằng đồng.' }),
  rest({ name: 'get_pricing', title: 'Xem giá và gói thành viên', scopes: ['communities:write'], method: 'GET', path: `${C}/pricing`, params: { communityId }, description: 'Kiểu thu phí của hội, các gói thành viên (standard, premium, vip), kỳ hạn, giá, khuyến mãi đang chạy.' }),
  rest({ name: 'update_pricing', title: 'Đổi giá và gói thành viên', scopes: ['billing:manage'], effect: 'delete', method: 'PUT', path: `${C}/pricing`, params: { communityId }, data: updatePricingSchema, description: 'Đổi kiểu thu phí, giá, kỳ hạn, khuyến mãi của các gói thành viên. Ảnh hưởng ngay tới giá người mua thấy: đọc get_pricing trước, gửi lại đủ các gói muốn giữ, và hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'list_pending_orders', title: 'Đơn chờ xác nhận', scopes: ['billing:manage'], method: 'GET', path: `${C}/orders/pending`, params: { communityId }, description: 'Các đơn chuyển khoản đang chờ chủ hội xác nhận đã nhận tiền. `buyerSaysPaid` là người mua đã bấm "Tôi đã chuyển khoản".' }),
  rest({ name: 'confirm_order_received', title: 'Xác nhận đã nhận tiền', scopes: ['billing:manage'], effect: 'delete', method: 'POST', path: `${C}/orders/{orderId}/confirm-received`, params: { communityId, orderId: id('Id đơn, lấy từ list_pending_orders') }, description: 'Xác nhận chủ hội đã nhận được tiền chuyển khoản của một đơn: đơn thành đã trả và người mua được mở quyền ngay. Chỉ gọi khi chủ hội đã tự kiểm tra tài khoản ngân hàng.' }),
  rest({ name: 'get_order', title: 'Xem đơn hàng', scopes: ['revenue:read', 'billing:manage'], method: 'GET', path: `${C}/orders/{orderId}`, params: { communityId, orderId: id('Id đơn hàng, lấy từ get_revenue hoặc list_pending_orders') }, description: 'Một đơn hàng của hội: người mua, số tiền, cách thanh toán, trạng thái (pending, paid, refunded, expired).' }),
  rest({ name: 'refund_order', title: 'Hoàn tiền đơn hàng', scopes: ['billing:manage'], effect: 'delete', method: 'POST', path: '/v1/orders/{orderId}/admin-refund', params: { orderId: id('Id đơn hàng') }, data: z.object({ reason: z.string().max(500).default('').describe('Lý do hoàn tiền') }), description: 'Hoàn tiền một đơn đã trả và thu hồi quyền của người mua. Không hoàn tác được: hỏi lại chủ hội trước khi gọi.' }),

  // ===== Thành viên =====
  rest({ name: 'list_members', title: 'Danh sách thành viên', scopes: ['members:read'], method: 'GET', path: `${C}/members`, params: { communityId }, data: memberFilterSchema, description: 'Thành viên của hội, lọc theo trạng thái (mặc định đang hoạt động; `pending` là đang chờ duyệt), gói, vai trò, nguồn, thẻ, hoặc tìm theo tên và email. Phân trang bằng cursor.' }),
  rest({ name: 'get_member', title: 'Hồ sơ thành viên', scopes: ['members:read'], method: 'GET', path: `${C}/members/{memberId}`, params: { communityId, memberId: id('Id thành viên, lấy từ list_members') }, description: 'Hồ sơ một thành viên: gói, vai trò, tiến độ học từng khóa, lịch sử thanh toán, câu trả lời khi tham gia.' }),
  rest({ name: 'update_member', title: 'Đổi vai trò hoặc gói', scopes: ['members:write', 'entitlements:write'], method: 'PATCH', path: `${C}/members/{memberId}`, params: { communityId, memberId: id('Id thành viên') }, data: updateMemberSchema, description: 'Đổi vai trò (admin, moderator, member) hoặc gói (standard, premium, vip) của một thành viên.' }),
  rest({ name: 'member_action', title: 'Duyệt, khóa, mời ra', scopes: ['members:write'], effect: 'delete', method: 'POST', path: `${C}/members/{memberId}/actions`, params: { communityId, memberId: id('Id thành viên') }, data: z.object({ action: z.enum(['approve', 'remove', 'ban', 'unban', 'cancel_subscription']).describe('approve: duyệt vào hội. remove: mời ra. ban: khóa. unban: mở khóa. cancel_subscription: hủy gia hạn gói') }), description: 'Duyệt người đang chờ, mời ra khỏi hội, khóa, mở khóa, hoặc hủy gia hạn gói của một thành viên. Trừ `approve` và `unban`, hãy hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'grant_course', title: 'Cấp khóa học', scopes: ['members:write', 'entitlements:write'], method: 'POST', path: `${C}/members/{memberId}/grant-course`, params: { communityId, memberId: id('Id thành viên') }, data: z.object({ courseId: id('Id khóa học, lấy từ list_courses') }), description: 'Cấp quyền học một khóa cho thành viên mà không cần mua.' }),
  rest({ name: 'invite_members', title: 'Mời thành viên', scopes: ['members:write'], method: 'POST', path: `${C}/invites`, params: { communityId }, data: inviteSchema, description: 'Gửi email mời vào hội cho tối đa 50 địa chỉ, với vai trò member hoặc admin.' }),

  // ===== Bảng tin =====
  rest({ name: 'list_posts', title: 'Bảng tin', scopes: ['communities:read'], method: 'GET', path: `${C}/feed`, params: { communityId }, data: feedQuerySchema, description: 'Bài viết trên bảng tin (mới nhất trước), kèm danh sách chuyên mục ở trường `spaces`. Lọc theo chuyên mục bằng spaceId, phân trang bằng cursor.' }),
  rest({ name: 'get_post', title: 'Xem bài viết', scopes: ['communities:read'], method: 'GET', path: '/v1/posts/{postId}', params: { postId: id('Id bài viết') }, description: 'Nội dung đầy đủ một bài viết, tác giả, lượt thích, bình chọn.' }),
  {
    name: 'create_post', title: 'Đăng bài', scopes: ['posts:write'], effect: 'write', input: postInput,
    description: 'Đăng bài Markdown lên bảng tin dưới tên chủ hội. Chọn chuyên mục bằng `space` (tên hoặc slug) hoặc `spaceId`; bỏ trống thì vào "Thông báo". `broadcastEmail: true` báo cho mọi thành viên. Có thể kèm video, liên kết, bình chọn.',
    run: async (api, args) => {
      const { communityId: cid, spaceId, space, ...body } = args as { communityId: string; spaceId?: string; space?: string };
      return api('POST', `/v1/communities/${cid}/posts`, { ...body, spaceId: await resolveSpace(api, cid, { spaceId, space }) });
    },
  },
  {
    name: 'send_announcement', title: 'Gửi thông báo', scopes: ['posts:write'], effect: 'write',
    input: z.object({ communityId, title: z.string().trim().max(160).describe('Tiêu đề thông báo'), contentMd: z.string().trim().min(1).max(50_000).describe('Nội dung Markdown') }),
    description: 'Đăng một thông báo vào chuyên mục "Thông báo" và báo cho toàn bộ thành viên của hội.',
    run: async (api, args) => {
      const { communityId: cid, ...body } = args as { communityId: string };
      return api('POST', `/v1/communities/${cid}/posts`, { ...body, spaceId: await resolveSpace(api, cid, {}), broadcastEmail: true, imageFileIds: [] });
    },
  },
  rest({ name: 'update_post', title: 'Sửa hoặc ghim bài', scopes: ['posts:moderate'], method: 'PATCH', path: '/v1/posts/{postId}', params: { postId: id('Id bài viết') }, data: z.object({ title: z.string().trim().max(160).optional(), contentMd: z.string().trim().min(1).max(50_000).optional(), spaceId: id('Chuyển bài sang chuyên mục này').optional(), pinned: z.boolean().optional().describe('true: ghim lên đầu bảng tin, false: bỏ ghim') }), description: 'Sửa tiêu đề, nội dung, chuyển chuyên mục hoặc ghim một bài viết.' }),
  rest({ name: 'delete_post', title: 'Xóa bài', scopes: ['posts:moderate'], method: 'DELETE', path: '/v1/posts/{postId}', params: { postId: id('Id bài viết') }, description: 'Xóa một bài viết khỏi bảng tin, ảnh của bài cũng bị gỡ. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'moderate_post', title: 'Duyệt bài', scopes: ['posts:moderate'], method: 'POST', path: '/v1/posts/{postId}/moderate', params: { postId: id('Id bài đang chờ duyệt') }, data: z.object({ action: z.enum(['approve', 'reject']), reason: z.string().max(300).optional().describe('Lý do từ chối, gửi cho tác giả') }), description: 'Duyệt hoặc từ chối một bài đang chờ duyệt của thành viên mới.' }),
  rest({ name: 'list_comments', title: 'Bình luận', scopes: ['communities:read'], method: 'GET', path: '/v1/comments', data: z.object({ targetType: z.enum(['post', 'lesson', 'event']), targetId: id('Id bài viết, bài học hoặc sự kiện'), sort: z.enum(['top', 'newest']).optional() }), description: 'Bình luận dưới một bài viết, bài học hoặc sự kiện.' }),
  rest({ name: 'create_comment', title: 'Bình luận', scopes: ['posts:write'], method: 'POST', path: '/v1/comments', data: z.object({ targetType: z.enum(['post', 'lesson', 'event']), targetId: id('Id bài viết, bài học hoặc sự kiện') }).merge(createCommentSchema.omit({ imageFileId: true })), description: 'Bình luận dưới tên chủ hội. Trả lời một bình luận khác bằng parentCommentId.' }),
  rest({ name: 'pin_comment', title: 'Ghim bình luận', scopes: ['posts:moderate'], method: 'POST', path: '/v1/comments/{commentId}/pin', params: { commentId: id('Id bình luận') }, data: z.object({ pinned: z.boolean() }), description: 'Ghim hoặc bỏ ghim một bình luận.' }),
  rest({ name: 'delete_comment', title: 'Xóa bình luận', scopes: ['posts:moderate'], method: 'DELETE', path: '/v1/comments/{commentId}', params: { commentId: id('Id bình luận') }, description: 'Xóa một bình luận. Hỏi lại chủ hội trước khi gọi.' }),

  // ===== Khóa học =====
  rest({ name: 'list_courses', title: 'Danh sách khóa học', scopes: ['courses:read', 'courses:write'], method: 'GET', path: `${C}/courses`, params: { communityId }, description: 'Các khóa học của hội, kể cả bản nháp, kèm số bài và ai được học.' }),
  rest({ name: 'get_course', title: 'Xem khóa học', scopes: ['courses:read', 'courses:write'], method: 'GET', path: '/v1/courses/{courseId}', params: { courseId: id('Id khóa học') }, description: 'Một khóa học kèm các chương và bài học theo thứ tự.' }),
  rest({ name: 'create_course', title: 'Tạo khóa học', scopes: ['courses:write'], method: 'POST', path: `${C}/courses`, params: { communityId }, data: createCourseSchema, description: 'Tạo khóa học nháp. `accessMode` quyết định ai được học: mọi thành viên, gói Premium, chỉ người mua lẻ, hoặc cả Premium lẫn người mua. Giá tính bằng đồng. Sau đó thêm chương bằng create_module, thêm bài bằng create_lesson, rồi update_course với status "published" để mở.' }),
  rest({ name: 'update_course', title: 'Sửa khóa học', scopes: ['courses:write'], method: 'PATCH', path: '/v1/courses/{courseId}', params: { courseId: id('Id khóa học') }, data: updateCourseSchema, description: 'Sửa thông tin khóa học, giá, ai được học, hoặc đổi trạng thái (draft, published, archived). Chỉ gửi trường cần đổi.' }),
  rest({ name: 'delete_course', title: 'Xóa khóa học', scopes: ['courses:write'], method: 'DELETE', path: '/v1/courses/{courseId}', params: { courseId: id('Id khóa học') }, description: 'Xóa một khóa học cùng các chương và bài học. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'create_module', title: 'Thêm chương', scopes: ['courses:write'], method: 'POST', path: '/v1/courses/{courseId}/modules', params: { courseId: id('Id khóa học') }, data: moduleInputSchema, description: 'Thêm một chương vào khóa học.' }),
  rest({ name: 'update_module', title: 'Sửa chương', scopes: ['courses:write'], method: 'PATCH', path: '/v1/courses/{courseId}/modules/{moduleId}', params: { courseId: id('Id khóa học'), moduleId: id('Id chương') }, data: moduleInputSchema, description: 'Đổi tên hoặc thứ tự một chương.' }),
  rest({ name: 'delete_module', title: 'Xóa chương', scopes: ['courses:write'], method: 'DELETE', path: '/v1/modules/{moduleId}', params: { moduleId: id('Id chương') }, description: 'Xóa một chương cùng các bài học trong chương. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'get_lesson', title: 'Xem bài học', scopes: ['courses:read', 'courses:write'], method: 'GET', path: '/v1/lessons/{lessonId}', params: { lessonId: id('Id bài học') }, description: 'Nội dung một bài học: video, bài viết, tài liệu đính kèm.' }),
  rest({ name: 'create_lesson', title: 'Thêm bài học', scopes: ['courses:write'], method: 'POST', path: '/v1/courses/{courseId}/lessons', params: { courseId: id('Id khóa học') }, data: lessonInputSchema, description: 'Thêm bài học vào một chương. Bài video dùng link YouTube, Vimeo, Bunny hoặc Wistia ở `videoUrl`; gọi get_video_info trước để lấy sẵn tên và thời lượng.' }),
  rest({ name: 'update_lesson', title: 'Sửa bài học', scopes: ['courses:write'], method: 'PATCH', path: '/v1/courses/{courseId}/lessons/{lessonId}', params: { courseId: id('Id khóa học'), lessonId: id('Id bài học') }, data: updateLessonSchema, description: 'Sửa một bài học. Chỉ gửi trường cần đổi.' }),
  rest({ name: 'delete_lesson', title: 'Xóa bài học', scopes: ['courses:write'], method: 'DELETE', path: '/v1/lessons/{lessonId}', params: { lessonId: id('Id bài học') }, description: 'Xóa một bài học. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'reorder_course', title: 'Sắp xếp chương và bài', scopes: ['courses:write'], method: 'PUT', path: '/v1/courses/{courseId}/reorder', params: { courseId: id('Id khóa học') }, data: reorderSchema, description: 'Đặt lại thứ tự các chương và thứ tự bài học trong từng chương. Gửi đủ mọi chương và mọi bài của khóa.' }),
  rest({ name: 'get_video_info', title: 'Đọc thông tin video', scopes: ['courses:write'], effect: 'read', method: 'POST', path: '/v1/video/meta', data: z.object({ url: z.string().max(2000).describe('Link video YouTube, Vimeo, Bunny hoặc Wistia') }), description: 'Nhận diện link video và lấy tên, mô tả, thời lượng để điền sẵn vào bài học.' }),

  // ===== Sự kiện =====
  rest({ name: 'list_events', title: 'Danh sách sự kiện', scopes: ['communities:read'], method: 'GET', path: `${C}/events`, params: { communityId, month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Lấy theo tháng, dạng 2026-11') }, data: eventsQuerySchema, description: 'Sự kiện của hội: sắp tới (mặc định) hoặc đã qua.' }),
  rest({ name: 'get_event', title: 'Xem sự kiện', scopes: ['communities:read'], method: 'GET', path: '/v1/events/{eventId}', params: { eventId: id('Id sự kiện') }, description: 'Chi tiết một sự kiện: giờ, link họp, số người đăng ký, câu hỏi gửi trước, bản ghi.' }),
  rest({ name: 'create_event', title: 'Tạo sự kiện', scopes: ['events:write'], method: 'POST', path: `${C}/events`, params: { communityId }, data: createEventSchema, description: 'Tạo sự kiện. Giờ viết theo ISO 8601 có múi giờ (ví dụ 2026-11-20T20:00:00+07:00). Lặp hằng tuần hoặc hằng tháng bằng `recurrence` và `occurrences`.' }),
  rest({ name: 'update_event', title: 'Sửa sự kiện', scopes: ['events:write'], method: 'PATCH', path: '/v1/events/{eventId}', params: { eventId: id('Id sự kiện') }, data: updateEventSchema, description: 'Sửa một sự kiện. Chỉ gửi trường cần đổi.' }),
  rest({ name: 'add_event_recording', title: 'Thêm bản ghi sự kiện', scopes: ['events:write'], method: 'POST', path: '/v1/events/{eventId}/recordings', params: { eventId: id('Id sự kiện') }, data: eventRecordingSchema, description: 'Gắn link video bản ghi vào một sự kiện đã diễn ra.' }),
  rest({ name: 'list_event_attendees', title: 'Người đăng ký sự kiện', scopes: ['events:write'], method: 'GET', path: '/v1/events/{eventId}/attendees', params: { eventId: id('Id sự kiện') }, description: 'Danh sách người đã đăng ký một sự kiện.' }),
  rest({ name: 'list_recordings', title: 'Bản ghi sự kiện', scopes: ['communities:read'], method: 'GET', path: `${C}/recordings`, params: { communityId }, description: 'Các bản ghi sự kiện đã đăng của hội.' }),

  // ===== Cửa hàng =====
  rest({ name: 'list_products', title: 'Sản phẩm cửa hàng', scopes: ['communities:read', 'store:write'], method: 'GET', path: `${C}/products`, params: { communityId }, data: storeQuerySchema, description: 'Sản phẩm trong cửa hàng của hội: khóa học bán lẻ, combo, sản phẩm số.' }),
  rest({ name: 'get_product', title: 'Xem sản phẩm', scopes: ['communities:read', 'store:write'], method: 'GET', path: '/v1/products/{productId}', params: { productId: id('Id sản phẩm') }, description: 'Chi tiết một sản phẩm kèm trang bán hàng.' }),
  rest({ name: 'create_product', title: 'Tạo sản phẩm', scopes: ['store:write'], method: 'POST', path: `${C}/products`, params: { communityId }, data: createProductSchema, description: 'Tạo sản phẩm trong cửa hàng. `kind` là course (bán một khóa học, cần courseId), bundle (combo nhiều sản phẩm) hoặc digital (sản phẩm số, cần ít nhất một tệp ở `digitalFileIds`, tải lên bằng create_upload_url). Giá tính bằng đồng. `page` là nội dung trang bán hàng.' }),
  rest({ name: 'update_product', title: 'Sửa sản phẩm', scopes: ['store:write'], method: 'PATCH', path: '/v1/products/{productId}', params: { productId: id('Id sản phẩm') }, data: updateProductSchema, description: 'Sửa sản phẩm: giá, mô tả, trang bán hàng, trạng thái. Chỉ gửi trường cần đổi.' }),
  rest({ name: 'delete_product', title: 'Xóa sản phẩm', scopes: ['store:write'], method: 'DELETE', path: '/v1/products/{productId}', params: { productId: id('Id sản phẩm') }, description: 'Gỡ một sản phẩm khỏi cửa hàng. Người đã mua vẫn giữ quyền. Hỏi lại chủ hội trước khi gọi.' }),

  // ===== Affiliate =====
  rest({ name: 'get_affiliate_program', title: 'Chương trình affiliate', scopes: ['affiliates:manage'], method: 'GET', path: `${C}/affiliate`, params: { communityId }, description: 'Cấu hình chương trình affiliate của hội (tỉ lệ hoa hồng, số ngày giữ, mức rút tối thiểu) và số liệu tổng.' }),
  rest({ name: 'update_affiliate_program', title: 'Cài chương trình affiliate', scopes: ['affiliates:manage'], method: 'PUT', path: `${C}/affiliate`, params: { communityId }, data: affiliateSettingsSchema, description: 'Bật tắt affiliate (`enabled`; ở get_affiliate_program là `program.status` active hoặc paused), đặt tỉ lệ hoa hồng (`commissionRateBps`: 3000 là 30%), số ngày giữ hoa hồng, mức rút tối thiểu, cách hiện bảng xếp hạng.' }),
  rest({ name: 'get_affiliate_leaderboard', title: 'Xếp hạng affiliate', scopes: ['communities:read'], method: 'GET', path: `${C}/leaderboard`, params: { communityId }, data: leaderboardQuerySchema, description: 'Bảng xếp hạng affiliate của hội theo tháng, quý hoặc toàn thời gian.' }),
  rest({ name: 'list_withdrawals', title: 'Yêu cầu rút hoa hồng', scopes: ['affiliates:manage'], method: 'GET', path: `${C}/affiliate/payouts`, params: { communityId }, description: 'Hàng đợi yêu cầu rút hoa hồng của affiliate: đang chờ, đang xem xét, đã trả, bị từ chối. Mỗi yêu cầu có `version` để dùng khi đánh dấu đã trả hoặc từ chối.' }),
  rest({ name: 'review_withdrawal', title: 'Nhận xem xét yêu cầu rút', scopes: ['affiliates:manage'], method: 'POST', path: '/v1/withdrawals/{withdrawalId}/review', params: { withdrawalId: id('Id yêu cầu rút') }, description: 'Chuyển một yêu cầu rút sang trạng thái đang xem xét và xem thông tin tài khoản nhận.' }),
  rest({ name: 'mark_withdrawal_paid', title: 'Đánh dấu đã trả hoa hồng', scopes: ['affiliates:manage'], effect: 'delete', method: 'POST', path: '/v1/withdrawals/{withdrawalId}/paid', params: { withdrawalId: id('Id yêu cầu rút') }, data: markPaidSchema, description: 'Đánh dấu một yêu cầu rút đã được chuyển khoản, kèm mã giao dịch ngân hàng. Chỉ gọi sau khi chủ hội đã chuyển tiền thật. `version` lấy từ list_withdrawals.' }),
  rest({ name: 'reject_withdrawal', title: 'Từ chối yêu cầu rút', scopes: ['affiliates:manage'], effect: 'delete', method: 'POST', path: '/v1/withdrawals/{withdrawalId}/reject', params: { withdrawalId: id('Id yêu cầu rút') }, data: rejectWithdrawalSchema, description: 'Từ chối một yêu cầu rút kèm lý do, tiền trả lại ví affiliate. `version` lấy từ list_withdrawals.' }),

  // ===== Thẻ và quy tắc tự động =====
  rest({ name: 'get_automation_options', title: 'Lựa chọn cho quy tắc', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/options`, params: { communityId }, description: 'Các hội, gói và khóa học có thể chọn làm việc cần làm trong quy tắc tự động.' }),
  rest({ name: 'list_inbound_sources', title: 'Nguồn đồng bộ', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/sources`, params: { communityId }, description: 'Các nguồn đồng bộ liên hệ từ landing page (Webcake, form) kèm địa chỉ nhận dữ liệu và cách đọc trường.' }),
  rest({ name: 'create_inbound_source', title: 'Thêm nguồn đồng bộ', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/sources`, params: { communityId }, data: inboundSourceSchema, description: 'Tạo một nguồn đồng bộ mới và nhận địa chỉ để dán vào landing page.' }),
  rest({ name: 'update_inbound_source', title: 'Sửa nguồn đồng bộ', scopes: ['automation:manage', 'communities:write'], method: 'PATCH', path: `${A}/sources/{sourceId}`, params: { communityId, sourceId: id('Id nguồn') }, data: inboundSourceUpdateSchema, description: 'Đổi tên, tạm dừng, hoặc chỉnh cách đọc email, tên, số điện thoại, thẻ từ dữ liệu gửi về.' }),
  rest({ name: 'delete_inbound_source', title: 'Xóa nguồn đồng bộ', scopes: ['automation:manage', 'communities:write'], method: 'DELETE', path: `${A}/sources/{sourceId}`, params: { communityId, sourceId: id('Id nguồn') }, description: 'Xóa một nguồn đồng bộ, địa chỉ nhận của nó ngừng hoạt động. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'list_inbound_events', title: 'Dữ liệu nguồn gửi về', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/sources/{sourceId}/events`, params: { communityId, sourceId: id('Id nguồn') }, description: 'Các lượt dữ liệu gần đây một nguồn đã gửi về và kết quả xử lý.' }),
  rest({ name: 'reprocess_inbound_event', title: 'Xử lý lại dữ liệu', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/events/{eventId}/reprocess`, params: { communityId, eventId: id('Id lượt dữ liệu, lấy từ list_inbound_events') }, description: 'Chạy lại một lượt dữ liệu đã nhận (ví dụ sau khi sửa cách đọc trường).' }),
  rest({ name: 'list_tags', title: 'Danh sách thẻ', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/tags`, params: { communityId }, description: 'Các thẻ đang dùng trong hội và số liên hệ mang từng thẻ.' }),
  rest({ name: 'list_contacts', title: 'Danh sách liên hệ', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/contacts`, params: { communityId }, data: contactFilterSchema, description: 'Liên hệ của hội (người để lại email ở landing, người được thêm tay), lọc theo thẻ hoặc tìm theo tên và email.' }),
  rest({ name: 'create_contact', title: 'Thêm liên hệ', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/contacts`, params: { communityId }, data: contactCreateSchema, description: 'Thêm một liên hệ kèm thẻ. Thẻ khớp với quy tắc tự động nào thì quy tắc đó chạy ngay (cấp quyền, gửi email).' }),
  rest({ name: 'delete_contact', title: 'Xóa liên hệ', scopes: ['automation:manage', 'communities:write'], method: 'DELETE', path: `${A}/contacts/{contactId}`, params: { communityId, contactId: id('Id liên hệ') }, description: 'Xóa một liên hệ. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'add_contact_tag', title: 'Gắn thẻ', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/contacts/{contactId}/tags`, params: { communityId, contactId: id('Id liên hệ') }, data: z.object({ tag: tagNameSchema }), description: 'Gắn một thẻ cho liên hệ. Quy tắc tự động gắn với thẻ đó sẽ chạy.' }),
  rest({ name: 'remove_contact_tag', title: 'Gỡ thẻ', scopes: ['automation:manage', 'communities:write'], method: 'DELETE', path: `${A}/contacts/{contactId}/tags/{tag}`, params: { communityId, contactId: id('Id liên hệ'), tag: tagNameSchema }, description: 'Gỡ một thẻ khỏi liên hệ. Quy tắc có bật "thu hồi khi gỡ thẻ" sẽ thu lại quyền đã cấp.' }),
  rest({ name: 'resend_activation', title: 'Gửi lại email kích hoạt', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/contacts/{contactId}/resend-activation`, params: { communityId, contactId: id('Id liên hệ') }, description: 'Gửi lại email kích hoạt quyền truy cập cho một liên hệ chưa kích hoạt.' }),
  rest({ name: 'list_automation_rules', title: 'Quy tắc tự động', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/rules`, params: { communityId }, description: 'Các quy tắc "khi gắn thẻ X thì làm Y" của hội.' }),
  rest({ name: 'create_automation_rule', title: 'Tạo quy tắc tự động', scopes: ['automation:manage', 'communities:write'], method: 'POST', path: `${A}/rules`, params: { communityId }, data: automationRuleSchema, description: 'Tạo quy tắc: khi một liên hệ được gắn thẻ thì cấp gói thành viên, cấp khóa học hoặc gửi email. Xem lựa chọn hợp lệ bằng get_automation_options.' }),
  rest({ name: 'update_automation_rule', title: 'Sửa quy tắc tự động', scopes: ['automation:manage', 'communities:write'], method: 'PATCH', path: `${A}/rules/{ruleId}`, params: { communityId, ruleId: id('Id quy tắc') }, data: automationRuleSchema.partial(), description: 'Sửa hoặc bật tắt một quy tắc. Chỉ gửi trường cần đổi.' }),
  rest({ name: 'delete_automation_rule', title: 'Xóa quy tắc tự động', scopes: ['automation:manage', 'communities:write'], method: 'DELETE', path: `${A}/rules/{ruleId}`, params: { communityId, ruleId: id('Id quy tắc') }, description: 'Xóa một quy tắc. Hỏi lại chủ hội trước khi gọi.' }),
  rest({ name: 'list_automation_runs', title: 'Nhật ký quy tắc', scopes: ['automation:manage', 'communities:write'], method: 'GET', path: `${A}/runs`, params: { communityId, ruleId: id('Chỉ xem của một quy tắc').optional() }, description: 'Nhật ký các lần quy tắc tự động đã chạy và kết quả.' }),

  // ===== Tin nhắn và thông báo =====
  rest({ name: 'list_conversations', title: 'Hội thoại', scopes: ['messages:read', 'messages:write'], method: 'GET', path: '/v1/me/conversations', data: z.object({ filter: z.enum(['all', 'unread', 'automated', 'archived']).optional(), q: z.string().max(80).optional().describe('Tìm theo tên người nhắn') }), description: 'Các cuộc trò chuyện riêng của chủ hội, kèm tin mới nhất và số tin chưa đọc.' }),
  rest({ name: 'list_messages', title: 'Tin nhắn', scopes: ['messages:read', 'messages:write'], method: 'GET', path: '/v1/me/conversations/{conversationId}/messages', params: { conversationId: id('Id cuộc trò chuyện'), limit: z.coerce.number().int().min(1).max(100).optional() }, description: 'Tin nhắn trong một cuộc trò chuyện.' }),
  rest({ name: 'send_message', title: 'Gửi tin nhắn', scopes: ['messages:write'], method: 'POST', path: '/v1/me/messages', data: z.object({ conversationId: id('Id cuộc trò chuyện đã có').optional(), recipientUserId: id('Id người nhận (userId)').optional(), communityId: id('Hội mà hai người cùng tham gia').optional(), body: z.string().trim().min(1).max(4000).describe('Nội dung tin nhắn'), replyToId: id('Trả lời tin nhắn này').nullable().optional() }), description: 'Gửi tin nhắn riêng dưới tên chủ hội: vào một cuộc trò chuyện đã có (conversationId) hoặc cho một người (recipientUserId, lấy từ list_members trường userId).' }),
  rest({ name: 'list_notifications', title: 'Thông báo', scopes: ['messages:read', 'messages:write'], method: 'GET', path: '/v1/me/notifications', data: z.object({ filter: z.enum(['all', 'unread', 'mention', 'affiliate', 'system']).optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).optional() }), description: 'Thông báo của chủ hội: thành viên mới, đơn hàng, bình luận, yêu cầu rút tiền.' }),

  // ===== Webhook gửi đi =====
  { name: 'list_webhooks', title: 'Webhook gửi đi', scopes: ['webhooks:manage'], effect: 'read', input: z.object({}), description: 'Các webhook Hội Mình đang gọi ra ngoài khi có sự kiện, kèm các lần gửi gần đây.', run: async (api) => api('GET', `/v1/workspaces/${await workspaceId(api)}/webhooks`) },
  { name: 'create_webhook', title: 'Thêm webhook', scopes: ['webhooks:manage'], effect: 'write', input: createWebhookSchema, description: 'Đăng ký một URL nhận sự kiện (thành viên mới, thanh toán, hoàn tiền, học xong bài...). Kết quả có `secret` để kiểm chữ ký, chỉ hiện một lần.', run: async (api, args) => api('POST', `/v1/workspaces/${await workspaceId(api)}/webhooks`, args) },
  { name: 'delete_webhook', title: 'Xóa webhook', scopes: ['webhooks:manage'], effect: 'delete', input: z.object({ webhookId: id('Id webhook, lấy từ list_webhooks') }), description: 'Xóa một webhook gửi đi. Hỏi lại chủ hội trước khi gọi.', run: async (api, args) => api('DELETE', `/v1/workspaces/${await workspaceId(api)}/webhooks/${encodeURIComponent(String(args.webhookId))}`) },

  // ===== Tải tệp lên =====
  rest({ name: 'create_upload_url', title: 'Xin địa chỉ tải tệp lên', scopes: UPLOAD_SCOPES, method: 'POST', path: '/v1/files/upload-url', data: z.object({ fileName: z.string().min(1).max(200), mimeType: z.string().describe('Ví dụ image/jpeg, image/png, image/webp, application/pdf, application/zip'), sizeBytes: z.number().int().positive().describe('Dung lượng tệp tính bằng byte'), purpose: z.enum(['post_image', 'cover', 'lesson_resource', 'digital_product']).describe('post_image: ảnh bài viết. cover: ảnh bìa hội, khóa học, sản phẩm. lesson_resource: tài liệu bài học. digital_product: tệp của sản phẩm số'), communityId: communityId.optional() }), description: 'Bước 1 để gắn ảnh hoặc tệp: nhận `fileId` và địa chỉ tải lên ở `upload` (url, method, headers). Gửi nội dung tệp tới địa chỉ đó bằng đúng method và headers, rồi gọi complete_upload. Sau đó dùng `fileId` ở imageFileIds, coverFileId, resourceFileIds hoặc digitalFileIds.' }),
  rest({ name: 'complete_upload', title: 'Xác nhận đã tải tệp', scopes: UPLOAD_SCOPES, method: 'POST', path: '/v1/files/{fileId}/complete', params: { fileId: id('fileId nhận từ create_upload_url') }, data: z.object({ width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional() }), description: 'Bước 2: báo tệp đã tải lên xong (kèm kích thước nếu là ảnh). Tệp chỉ dùng được sau bước này.' }),
];

/** Lệnh mà key có các phạm vi này gọi được. */
export function toolsFor(scopes: readonly string[]): Tool[] {
  return TOOLS.filter((t) => t.scopes.length === 0 || t.scopes.some((s) => scopes.includes(s)));
}

/** Khai báo lệnh theo chuẩn MCP: tên, mô tả, JSON Schema của dữ liệu vào, gợi ý chỉ đọc hay có phá hủy. */
export function describeTool(t: Tool) {
  const schema = zodToJsonSchema(t.input, { $refStrategy: 'none', target: 'jsonSchema7' }) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: { ...schema, type: 'object' },
    annotations: { title: t.title, readOnlyHint: t.effect === 'read', destructiveHint: t.effect === 'delete', openWorldHint: false },
  };
}
