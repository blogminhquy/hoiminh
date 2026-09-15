// 10 MCP tool theo yêu cầu: list_communities, create_post, add_member, change_member_tier, create_course, create_event,
// get_member_progress, send_announcement, list_withdrawals, mark_withdrawal_paid. Tất cả đi qua REST API + service layer.
import { z } from 'zod';
import type { Client } from './client';

const communityId = z.string().uuid().describe('Id hội (lấy từ list_communities)');

const defs = {
  list_communities: { description: 'Liệt kê các hội mà API key được quản lý, kèm số thành viên và kiểu thu phí.', schema: z.object({}) },
  create_post: { description: 'Đăng bài Markdown lên Bảng tin của hội. Chuyên mục bắt buộc (mặc định "Thông báo").', schema: z.object({ communityId, title: z.string().default(''), contentMd: z.string(), spaceSlug: z.string().default('thong-bao'), broadcastEmail: z.boolean().default(false) }) },
  add_member: { description: 'Thêm thành viên vào hội theo email (gửi lời mời qua email).', schema: z.object({ communityId, email: z.string().email() }) },
  change_member_tier: { description: 'Đổi gói của thành viên (standard | premium | vip).', schema: z.object({ communityId, memberId: z.string().uuid(), tierKey: z.enum(['standard', 'premium', 'vip']) }) },
  create_course: { description: 'Tạo khóa học nháp trong hội.', schema: z.object({ communityId, title: z.string(), shortDescription: z.string().default(''), accessMode: z.enum(['all_members', 'premium', 'store_only', 'premium_and_store']).default('premium'), priceMinor: z.number().int().optional() }) },
  create_event: { description: 'Tạo sự kiện (ISO 8601 cho startsAt/endsAt).', schema: z.object({ communityId, title: z.string(), startsAt: z.string(), endsAt: z.string(), meetingUrl: z.string().url().optional(), recurrence: z.enum(['none', 'weekly', 'monthly']).default('none'), occurrences: z.number().int().default(4), access: z.enum(['all_members', 'premium', 'public']).default('all_members') }) },
  get_member_progress: { description: 'Tiến độ học và thanh toán của một thành viên.', schema: z.object({ communityId, memberId: z.string().uuid() }) },
  send_announcement: { description: 'Đăng thông báo lên Bảng tin và gửi email cho toàn bộ thành viên.', schema: z.object({ communityId, title: z.string(), contentMd: z.string() }) },
  list_withdrawals: { description: 'Hàng đợi yêu cầu rút tiền của cộng sự trong hội.', schema: z.object({ communityId }) },
  mark_withdrawal_paid: { description: 'Đánh dấu yêu cầu rút đã chuyển khoản với mã tham chiếu (cần scope affiliates:manage).', schema: z.object({ withdrawalId: z.string().uuid(), transferReference: z.string(), version: z.number().int() }) },
} as const;

type ToolName = keyof typeof defs;

/** Danh sách tool với JSON schema cho MCP. */
export const TOOLS = (Object.keys(defs) as ToolName[]).map((name) => ({ name, description: defs[name].description, inputSchema: jsonSchema(defs[name].schema) }));

function jsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [k, v] of Object.entries(schema.shape)) {
    const def = v as z.ZodTypeAny;
    const inner = def instanceof z.ZodDefault ? (def._def.innerType as z.ZodTypeAny) : def instanceof z.ZodOptional ? (def._def.innerType as z.ZodTypeAny) : def;
    const type = inner instanceof z.ZodNumber ? 'number' : inner instanceof z.ZodBoolean ? 'boolean' : 'string';
    props[k] = { type, description: def.description ?? inner.description, ...(inner instanceof z.ZodEnum ? { enum: inner.options } : {}) };
    if (!(def instanceof z.ZodDefault) && !(def instanceof z.ZodOptional)) required.push(k);
  }
  return { type: 'object', properties: props, required };
}

async function findCommunitySlug(client: Client, id: string): Promise<{ slug: string; workspaceId: string }> {
  const list = await client.get<Array<{ id: string; slug: string; workspaceId: string }>>('/v1/me/communities');
  const c = list.find((x) => x.id === id);
  if (!c) throw new Error('Hội không thuộc workspace của API key này');
  return c;
}

/** Chạy một tool. */
export async function runTool(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!(name in defs)) throw new Error(`Không có tool ${name}`);
  const key = name as ToolName;
  const input = defs[key].schema.parse(args) as Record<string, string>;
  switch (key) {
    case 'list_communities':
      return client.get('/v1/me/communities');
    case 'create_post': {
      const feed = await client.get<{ spaces: Array<{ id: string; slug: string }> }>(`/v1/communities/${input.communityId}/feed?limit=1`);
      const space = feed.spaces.find((s) => s.slug === input.spaceSlug) ?? feed.spaces[0];
      if (!space) throw new Error('Hội chưa có chuyên mục');
      return client.post(`/v1/communities/${input.communityId}/posts`, { spaceId: space.id, title: input.title, contentMd: input.contentMd, broadcastEmail: input.broadcastEmail, imageFileIds: [] });
    }
    case 'add_member':
      return client.post(`/v1/communities/${input.communityId}/invites`, { emails: [input.email] });
    case 'change_member_tier':
      return client.patch(`/v1/communities/${input.communityId}/members/${input.memberId}`, { tierKey: input.tierKey });
    case 'create_course':
      return client.post(`/v1/communities/${input.communityId}/courses`, { title: input.title, shortDescription: input.shortDescription, descriptionMd: '', accessMode: input.accessMode, priceMinor: input.priceMinor ?? null, previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    case 'create_event':
      return client.post(`/v1/communities/${input.communityId}/events`, { title: input.title, descriptionMd: '', startsAt: input.startsAt, endsAt: input.endsAt, timezone: 'Asia/Ho_Chi_Minh', recurrence: input.recurrence, occurrences: input.occurrences, kind: 'online', meetingUrl: input.meetingUrl ?? null, hostUserIds: [], access: input.access, allowQuestions: true, autoPublishRecording: true, reminders: ['1d', '1h', 'start'], announceOnFeed: true, broadcastEmail: false });
    case 'get_member_progress':
      return client.get(`/v1/communities/${input.communityId}/members/${input.memberId}`);
    case 'send_announcement': {
      const feed = await client.get<{ spaces: Array<{ id: string; slug: string }> }>(`/v1/communities/${input.communityId}/feed?limit=1`);
      const space = feed.spaces.find((s) => s.slug === 'thong-bao') ?? feed.spaces[0];
      if (!space) throw new Error('Hội chưa có chuyên mục');
      return client.post(`/v1/communities/${input.communityId}/posts`, { spaceId: space.id, title: input.title, contentMd: input.contentMd, broadcastEmail: true, imageFileIds: [] });
    }
    case 'list_withdrawals': {
      await findCommunitySlug(client, input.communityId ?? '');
      return client.get(`/v1/communities/${input.communityId}/affiliate/payouts`);
    }
    case 'mark_withdrawal_paid':
      return client.post(`/v1/withdrawals/${input.withdrawalId}/paid`, { transferReference: input.transferReference, version: input.version });
  }
}
