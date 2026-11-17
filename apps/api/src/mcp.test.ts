// API key và MCP từ xa: lớp chặn theo phạm vi (mặc định chặn), giao thức JSON-RPC ở POST /mcp, và chạy thật từng lệnh trên database mẫu.
import { loadEnv } from '@hoiminh/config';
import { API_SCOPES } from '@hoiminh/contracts';
import { createApp, featureFlags, type App } from '@hoiminh/core';
import { openSeededTestDb } from '@hoiminh/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHonoApp } from './app';
import { API_KEY_RULES, apiKeyAccess } from './middleware/api-key-access';
import { TOOLS, describeTool, toolsFor } from './mcp/tools';

let app: App;
let hono: ReturnType<typeof createHonoApp>;
let ownerToken = '';
let wsId = '';
let communityId = '';
let fullKey = '';
let readKey = '';

type Loose = ReturnType<JSON['parse']>;
const http = async (path: string, init: RequestInit & { auth?: string } = {}) => {
  const res = await hono.request(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.auth ? { Authorization: `Bearer ${init.auth}` } : {}), ...(init.headers ?? {}) } });
  const text = await res.text();
  let data: Loose = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* không phải JSON (CSV, rỗng) */
  }
  return { status: res.status, headers: res.headers, data };
};
let rpcId = 0;
const rpc = async (key: string, method: string, params?: unknown) => (await http('/mcp', { method: 'POST', auth: key, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) })).data;
/** Gọi một lệnh MCP, trả kết quả đã parse; lệnh báo lỗi thì ném ra chữ lỗi. */
const tool = async (name: string, args: Record<string, unknown> = {}, key = fullKey): Promise<Loose> => {
  const r = await rpc(key, 'tools/call', { name, arguments: args });
  const text: string = r.result.content[0].text;
  if (r.result.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
};
const createKey = async (name: string, scopes: readonly string[]) => (await http(`/v1/workspaces/${wsId}/api-keys`, { method: 'POST', auth: ownerToken, body: JSON.stringify({ name, scopes }) })).data.raw as string;

beforeAll(async () => {
  const env = loadEnv({ APP_ENV: 'test', DATABASE_URL: 'pglite://memory', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
  const { handle, seed } = await openSeededTestDb({ encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
  communityId = seed.communityId;
  app = await createApp({ env, db: handle.db });
  hono = createHonoApp(app);
  ownerToken = (await http('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) })).data.accessToken;
  wsId = (await http('/v1/me/workspace', { auth: ownerToken })).data.workspace.id;
  fullKey = await createKey('Javis', API_SCOPES);
  readKey = await createKey('Chỉ đọc', ['communities:read', 'members:read']);
}, 180_000);
afterAll(async () => app.close());

describe('API key: mặc định chặn, chỉ mở đúng đường dẫn đúng phạm vi', () => {
  it('bảng luật: mỗi dòng là một phương thức và đường dẫn /v1 hợp lệ, phạm vi đều có trong API_SCOPES', () => {
    for (const [rule, need] of API_KEY_RULES) {
      expect(rule).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/v1\//);
      if (need !== 'any') for (const s of need) expect(API_SCOPES).toContain(s);
    }
  });

  it('key chỉ đọc: đọc được hội và thành viên, không ghi được gì', async () => {
    expect((await http('/v1/me/communities', { auth: readKey })).data.map((c: Loose) => c.id)).toContain(communityId);
    expect((await http(`/v1/communities/${communityId}/members`, { auth: readKey })).status).toBe(200);
    expect((await http(`/v1/communities/${communityId}/feed`, { auth: readKey })).status).toBe(200);
    const denied = await http(`/v1/communities/${communityId}/posts`, { method: 'POST', auth: readKey, body: JSON.stringify({ spaceId: crypto.randomUUID(), contentMd: 'x' }) });
    expect(denied.status).toBe(403);
    expect(denied.data.message).toContain('posts:write');
  });

  it('không key nào (kể cả key đủ mọi phạm vi) chạm được tài khoản chủ hội, API key, tài khoản nhận tiền, quản trị hệ thống', async () => {
    const closed: Array<[string, string, unknown?]> = [
      ['GET', '/v1/me'], ['PATCH', '/v1/me', { name: 'Đổi tên' }], ['POST', '/v1/me/password', { currentPassword: 'hoiminh123', newPassword: 'hoiminh1234' }],
      ['GET', '/v1/me/2fa'], ['POST', '/v1/me/2fa/start'], ['GET', '/v1/me/billing'], ['GET', '/v1/me/affiliate/programs'],
      ['GET', `/v1/workspaces/${wsId}/api-keys`], ['POST', `/v1/workspaces/${wsId}/api-keys`, { name: 'Tự nhân bản', scopes: API_SCOPES }],
      ['GET', `/v1/communities/${communityId}/payout-account`], ['PUT', `/v1/communities/${communityId}/payout-account`, { bankCode: 'VCB', accountNumber: '0000000001', accountHolder: 'KE GIAN', confirmMode: 'manual' }],
      ['POST', `/v1/communities/${communityId}/payout-account/rotate-webhook`], ['DELETE', `/v1/communities/${communityId}/payment-gateways/momo`],
      ['POST', `/v1/communities/${communityId}/archive`], ['GET', '/v1/admin/overview'], ['POST', '/v1/checkout', {}], ['POST', '/v1/me/workspace/team', { workspaceId: wsId, email: 'la@example.com', role: 'admin' }],
    ];
    for (const [method, path, body] of closed) {
      const r = await http(path, { method, auth: fullKey, body: body ? JSON.stringify(body) : undefined });
      expect(`${method} ${path} → ${r.status}`).toBe(`${method} ${path} → 403`);
      expect(r.data.message).toContain('không mở cho API key');
    }
    // Hội vẫn còn nguyên và chủ hội vẫn đăng nhập được bằng mật khẩu cũ.
    expect((await http('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) })).status).toBe(200);
  });

  it('service cũng tự chặn key quản lý API key, không chỉ dựa vào bảng đường dẫn', () => {
    expect(apiKeyAccess('POST', `/v1/workspaces/${wsId}/api-keys`, API_SCOPES).ok).toBe(false);
    expect(apiKeyAccess('GET', '/v1/me/integration', []).ok).toBe(true);
    expect(apiKeyAccess('HEAD', `/v1/communities/${communityId}/feed/`, ['communities:read']).ok).toBe(true);
    expect(apiKeyAccess('POST', '/webhooks/sepay', []).ok).toBe(true);
  });

  it('lượt bị chặn vẫn ghi vào nhật ký dùng key', async () => {
    const before = await app.ctx.db.query.apiKeyLogs.findMany();
    await http('/v1/me/2fa', { auth: readKey });
    const after = await app.ctx.db.query.apiKeyLogs.findMany();
    expect(after.length).toBe(before.length + 1);
    expect(after.some((l) => l.path === '/v1/me/2fa' && l.status === 403)).toBe(true);
  });
});

describe('MCP từ xa: POST /mcp', () => {
  it('cần API key: không có, key sai, hoặc phiên đăng nhập web đều bị từ chối 401', async () => {
    expect((await http('/mcp', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await http('/mcp', { method: 'POST', auth: 'hm_test_sai_key', body: '{}' })).status).toBe(401);
    const session = await http('/mcp', { method: 'POST', auth: ownerToken, body: '{}' });
    expect(session.status).toBe(401);
    expect(session.headers.get('www-authenticate')).toContain('Bearer');
    expect((await http('/mcp', { auth: fullKey })).status).toBe(405);
  });

  it('initialize, ping, thông báo, lô, lỗi giao thức', async () => {
    const init = await rpc(fullKey, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'javis', version: '1' } });
    expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'hoiminh' } });
    expect(init.result.instructions).toContain('list_communities');
    expect((await rpc(fullKey, 'initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion).toBe('2025-06-18');
    expect((await rpc(fullKey, 'ping')).result).toEqual({});
    const notified = await http('/mcp', { method: 'POST', auth: fullKey, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    expect(notified.status).toBe(202);
    const batch = await http('/mcp', { method: 'POST', auth: fullKey, body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'khong/co' }]) });
    expect(batch.data).toHaveLength(2);
    expect(batch.data[1].error.code).toBe(-32601);
    const bad = await http('/mcp', { method: 'POST', auth: fullKey, body: '{khong phai json' });
    expect(bad.status).toBe(400);
    expect(bad.data.error.code).toBe(-32700);
  });

  it('tools/list: key đủ phạm vi thấy mọi lệnh, key chỉ đọc chỉ thấy lệnh nó gọi được; schema là object, không có $ref', async () => {
    const all = (await rpc(fullKey, 'tools/list')).result.tools as Array<Loose>;
    expect(all.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length);
    for (const t of all) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]{2,48}$/);
      expect(t.inputSchema.type).toBe('object');
      expect(JSON.stringify(t.inputSchema)).not.toContain('$ref');
      expect(t.description.length).toBeGreaterThan(20);
    }
    expect(all.find((t) => t.name === 'create_post').inputSchema.required).toEqual(expect.arrayContaining(['communityId', 'contentMd']));
    expect(all.find((t) => t.name === 'delete_post').annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    expect(all.find((t) => t.name === 'list_members').annotations).toMatchObject({ readOnlyHint: true });
    const few = (await rpc(readKey, 'tools/list')).result.tools.map((t: Loose) => t.name) as string[];
    expect(few).toEqual(toolsFor(['communities:read', 'members:read']).map((t) => t.name));
    expect(few).toContain('list_members');
    expect(few).not.toContain('create_post');
    expect(few).not.toContain('refund_order');
  });

  it('mỗi lệnh khớp một dòng trong bảng luật của API key với đúng phạm vi đã khai', async () => {
    // Lệnh nào khai phạm vi mà bảng luật không cho thì trợ lý thấy lệnh nhưng gọi luôn bị 403: bắt ở đây.
    const calls: Array<{ tool: string; method: string; path: string }> = [];
    const uuid = '00000000-0000-4000-8000-000000000000';
    const sample = (t: (typeof TOOLS)[number]) => Object.fromEntries(Object.keys(t.input.shape).map((k) => [k, k === 'slug' ? 'minhquy' : k === 'key' ? 'links' : k === 'tag' ? 'paid' : uuid]));
    for (const t of TOOLS) {
      await t.run(async (method, path) => {
        calls.push({ tool: t.name, method, path: path.split('?')[0]! });
        return { workspaceId: uuid, spaces: [{ id: uuid, slug: 'thong-bao', name: 'Thông báo' }] };
      }, sample(t));
    }
    for (const t of TOOLS) {
      const mine = calls.filter((c) => c.tool === t.name);
      expect(mine.length, t.name).toBeGreaterThan(0);
      const scopes = t.scopes.length ? t.scopes : (['communities:read'] as const);
      for (const s of scopes) for (const c of mine) expect(`${t.name} [${s}] ${c.method} ${c.path}: ${apiKeyAccess(c.method, c.path, [s]).ok}`).toBe(`${t.name} [${s}] ${c.method} ${c.path}: true`);
    }
  });

  it('lệnh thiếu phạm vi, sai dữ liệu, không tồn tại: trả lỗi đọc được, không ném lỗi giao thức', async () => {
    const noScope = await rpc(readKey, 'tools/call', { name: 'create_post', arguments: { communityId, contentMd: 'x' } });
    expect(noScope.result.isError).toBe(true);
    expect(noScope.result.content[0].text).toContain('posts:write');
    const invalid = await rpc(fullKey, 'tools/call', { name: 'create_post', arguments: { communityId: 'khong-phai-uuid', contentMd: '' } });
    expect(invalid.result.isError).toBe(true);
    expect(invalid.result.content[0].text).toContain('validation_error');
    expect((await rpc(fullKey, 'tools/call', { name: 'khong_co' })).result.isError).toBe(true);
    const foreign = await rpc(fullKey, 'tools/call', { name: 'list_members', arguments: { communityId: crypto.randomUUID() } });
    expect(foreign.result.isError).toBe(true);
  });

  it('tắt cờ mcp thì cả địa chỉ ngừng phục vụ', async () => {
    const admin = (await http('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hoiminh.vn', password: 'hoiminh123' }) })).data.accessToken as string;
    expect((await http('/v1/admin/flags/mcp', { method: 'PUT', auth: admin, body: JSON.stringify({ enabled: false }) })).status).toBe(200);
    const off = await http('/mcp', { method: 'POST', auth: fullKey, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    expect(off.status).toBe(403);
    expect(off.data.code).toBe('feature_disabled');
    await http('/v1/admin/flags/mcp', { method: 'PUT', auth: admin, body: JSON.stringify({ enabled: true }) });
    featureFlags.clearFlagCache();
    expect((await rpc(fullKey, 'ping')).result).toEqual({});
  });
});

describe('MCP: chạy thật các lệnh trên database mẫu', () => {
  it('kết nối và hội', async () => {
    const info = await tool('get_connection_info');
    expect(info).toMatchObject({ workspaceId: wsId, mcpEnabled: true });
    expect(info.scopes).toEqual(expect.arrayContaining([...API_SCOPES]));
    const list = await tool('list_communities');
    const mine = list.find((c: Loose) => c.id === communityId);
    expect(mine).toMatchObject({ slug: 'minhquy', role: 'owner' });
    expect((await tool('get_workspace')).workspace.id).toBe(wsId);
    expect((await tool('get_community', { slug: 'minhquy' })).community.id).toBe(communityId);
    expect(await tool('get_community_overview', { communityId, days: 30 })).toBeTruthy();
    expect(await tool('get_community_plan', { communityId })).toBeTruthy();
    await tool('update_community', { communityId, shortDescription: 'Cập nhật từ Javis qua MCP.' });
    expect((await tool('get_community', { slug: 'minhquy' })).community.shortDescription).toBe('Cập nhật từ Javis qua MCP.');
    expect(await tool('get_feed_settings', { communityId })).toBeTruthy();
    expect(await tool('list_plugins', { communityId })).toBeTruthy();
    await tool('set_join_questions', { communityId, questions: [{ question: 'Bạn biết hội qua đâu?', required: true }] });
  });

  it('bảng tin: đăng bài theo tên chuyên mục, thông báo, bình luận, ghim, xóa', async () => {
    const feed = await tool('list_posts', { communityId, limit: 5 });
    expect(feed.spaces.length).toBeGreaterThan(0);
    const post = await tool('create_post', { communityId, space: feed.spaces[0].name, title: 'Bài từ Javis', contentMd: 'Nội dung **đậm** đăng qua MCP.' });
    expect(post.id).toBeTruthy();
    expect((await tool('get_post', { postId: post.id })).title).toBe('Bài từ Javis');
    await expect(tool('create_post', { communityId, space: 'chuyên mục không có', contentMd: 'x' })).rejects.toThrow(/Không có chuyên mục/);
    const ann = await tool('send_announcement', { communityId, title: 'Lịch live tuần này', contentMd: 'Thứ Năm 20:00.' });
    expect(ann.broadcast).toBe(true);
    await tool('update_post', { postId: post.id, pinned: true, title: 'Bài từ Javis (đã sửa)' });
    const comment = await tool('create_comment', { targetType: 'post', targetId: post.id, contentMd: 'Bình luận của chủ hội.' });
    await tool('pin_comment', { commentId: comment.id, pinned: true });
    expect((await tool('list_comments', { targetType: 'post', targetId: post.id })).items.length).toBe(1);
    await tool('delete_comment', { commentId: comment.id });
    await tool('delete_post', { postId: ann.id });
    await expect(tool('get_post', { postId: ann.id })).rejects.toThrow(/not_found/);
  });

  it('thành viên: lọc, xem hồ sơ, đổi gói, mời, cấp khóa học', async () => {
    const members = await tool('list_members', { communityId, limit: 20 });
    expect(members.items.length).toBeGreaterThan(1);
    const m = members.items.find((x: Loose) => x.role === 'member') ?? members.items[0];
    expect((await tool('get_member', { communityId, memberId: m.id })).member.id).toBe(m.id);
    await tool('update_member', { communityId, memberId: m.id, tierKey: 'premium' });
    expect(await tool('invite_members', { communityId, emails: ['khach.moi@example.com'] })).toBeTruthy();
    const courses = await tool('list_courses', { communityId });
    await tool('grant_course', { communityId, memberId: m.id, courseId: courses.items[0].id });
  });

  it('khóa học: tạo khóa, chương, bài, sắp xếp, xuất bản, xóa', async () => {
    const course = await tool('create_course', { communityId, title: 'Khóa tạo từ Javis', accessMode: 'all_members' });
    const mod = await tool('create_module', { courseId: course.id, title: 'Chương 1' });
    const lesson = await tool('create_lesson', { courseId: course.id, moduleId: mod.id, title: 'Bài mở đầu', kind: 'text', contentMd: 'Xin chào.' });
    await tool('update_module', { courseId: course.id, moduleId: mod.id, title: 'Chương 1: Bắt đầu' });
    await tool('update_lesson', { courseId: course.id, lessonId: lesson.id, title: 'Bài mở đầu (sửa)' });
    await tool('reorder_course', { courseId: course.id, modules: [{ id: mod.id, sortOrder: 0, lessonIds: [lesson.id] }] });
    await tool('update_course', { courseId: course.id, status: 'published' });
    const got = await tool('get_course', { courseId: course.id });
    expect(got.status).toBe('published');
    expect(got.modules[0].lessons[0].id).toBe(lesson.id);
    expect((await tool('get_lesson', { lessonId: lesson.id })).lesson.title).toBe('Bài mở đầu (sửa)');
    expect((await tool('get_video_info', { url: 'https://vimeo.com/123456' })).embed).toBeTruthy();
    await tool('delete_lesson', { lessonId: lesson.id });
    await tool('delete_module', { moduleId: mod.id });
    await tool('delete_course', { courseId: course.id });
  });

  it('sự kiện và cửa hàng', async () => {
    const start = new Date(Date.now() + 3 * 86_400_000);
    const ev = await tool('create_event', { communityId, title: 'Live hỏi đáp cùng Javis', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), meetingUrl: 'https://meet.google.com/abc-defg-hij' });
    const eventId: string = ev.event.id;
    await tool('update_event', { eventId, title: 'Live hỏi đáp (đổi tên)' });
    expect((await tool('get_event', { eventId })).title).toBe('Live hỏi đáp (đổi tên)');
    expect(await tool('list_event_attendees', { eventId })).toBeTruthy();
    expect((await tool('list_events', { communityId })).items.length).toBeGreaterThan(0);
    await tool('add_event_recording', { eventId, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Bản ghi' });
    expect(await tool('list_recordings', { communityId })).toBeTruthy();

    // Sản phẩm số cần tệp: xin địa chỉ, gửi tệp tới đó, xác nhận, rồi mới tạo sản phẩm.
    const up = await tool('create_upload_url', { fileName: 'bo-prompt.pdf', mimeType: 'application/pdf', sizeBytes: 12, purpose: 'digital_product', communityId });
    expect(up.upload.url).toBeTruthy();
    const put = await hono.request(new URL(up.upload.url).pathname + new URL(up.upload.url).search, { method: up.upload.method ?? 'PUT', headers: { 'Content-Type': 'application/pdf', ...(up.upload.headers ?? {}) }, body: '%PDF-1.4 thu' });
    expect(put.status).toBe(200);
    await tool('complete_upload', { fileId: up.fileId });
    await expect(tool('create_product', { communityId, kind: 'digital', name: 'Thiếu tệp', priceMinor: 99_000 })).rejects.toThrow(/cần ít nhất 1 tệp/);
    const product = await tool('create_product', { communityId, kind: 'digital', name: 'Bộ prompt bán hàng', priceMinor: 99_000, digitalFileIds: [up.fileId] });
    await tool('update_product', { productId: product.id, priceMinor: 129_000 });
    expect((await tool('get_product', { productId: product.id })).priceMinor).toBe(129_000);
    expect((await tool('list_products', { communityId })).items.some((p: Loose) => p.id === product.id)).toBe(true);
    await tool('delete_product', { productId: product.id });
  });

  it('tiền và affiliate: doanh thu, giá gói, đơn chờ xác nhận, hàng đợi rút', async () => {
    expect(await tool('get_revenue', { communityId, days: 30 })).toBeTruthy();
    const pricing = await tool('get_pricing', { communityId });
    expect(pricing.tiers.length).toBeGreaterThan(0);
    expect(Array.isArray((await tool('list_pending_orders', { communityId })).items)).toBe(true);
    expect((await tool('get_affiliate_program', { communityId })).program).toBeTruthy();
    expect(await tool('get_affiliate_leaderboard', { communityId, period: 'all' })).toBeTruthy();
    expect(await tool('list_withdrawals', { communityId })).toBeTruthy();
    // Đơn chờ xác nhận không được lộ tài khoản nhận tiền hay địa chỉ webhook báo có.
    expect(JSON.stringify(await tool('list_pending_orders', { communityId }))).not.toMatch(/webhook|accountNumber/i);
  });

  it('thẻ và quy tắc tự động', async () => {
    expect(await tool('get_automation_options', { communityId })).toBeTruthy();
    const source = await tool('create_inbound_source', { communityId, name: 'Landing Webcake' });
    expect(source.url).toContain('/webhooks/in/');
    await tool('update_inbound_source', { communityId, sourceId: source.id, status: 'paused' });
    expect((await tool('list_inbound_sources', { communityId })).some((s: Loose) => s.id === source.id)).toBe(true);
    expect(await tool('list_inbound_events', { communityId, sourceId: source.id })).toBeTruthy();
    const options = await tool('get_automation_options', { communityId });
    const courseId = options.courses[0].id;
    const rule = await tool('create_automation_rule', { communityId, name: 'Mua xong thì mở khóa', tag: 'da_mua_javis', actions: [{ type: 'grant_course', courseId }] });
    await tool('update_automation_rule', { communityId, ruleId: rule.id, enabled: false });
    const contact = await tool('create_contact', { communityId, email: 'lien.he@example.com', name: 'Liên Hệ', tags: ['quan_tam'] });
    await tool('add_contact_tag', { communityId, contactId: contact.id, tag: 'nong' });
    await tool('remove_contact_tag', { communityId, contactId: contact.id, tag: 'nong' });
    expect((await tool('list_contacts', { communityId, q: 'lien.he' })).items.length).toBe(1);
    expect(await tool('list_tags', { communityId })).toBeTruthy();
    expect(await tool('list_automation_rules', { communityId })).toBeTruthy();
    expect(await tool('list_automation_runs', { communityId })).toBeTruthy();
    await tool('delete_contact', { communityId, contactId: contact.id });
    await tool('delete_automation_rule', { communityId, ruleId: rule.id });
    await tool('delete_inbound_source', { communityId, sourceId: source.id });
  });

  it('tin nhắn, thông báo, webhook gửi đi', async () => {
    const members = await tool('list_members', { communityId, limit: 20 });
    const other = members.items.find((x: Loose) => x.role === 'member');
    const sent = await tool('send_message', { recipientUserId: other.userId, communityId, body: 'Chào bạn, mình nhắn qua Javis.' });
    expect(sent.conversationId).toBeTruthy();
    expect((await tool('list_conversations')).items.length).toBeGreaterThan(0);
    expect(await tool('list_messages', { conversationId: sent.conversationId })).toBeTruthy();
    expect(await tool('list_notifications', { limit: 5 })).toBeTruthy();
    const hook = await tool('create_webhook', { url: 'https://example.com/hook', events: ['member.joined'] });
    expect(hook.secret).toBeTruthy();
    expect((await tool('list_webhooks')).some((w: Loose) => w.id === hook.id)).toBe(true);
    await tool('delete_webhook', { webhookId: hook.id });
  });

  it('đơn chuyển khoản: người mua tạo đơn, Javis thấy đơn chờ, xác nhận đã nhận tiền, đơn thành đã trả, rồi hoàn tiền', async () => {
    const buyer = (await http('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'congtran@gmail.com', password: 'hoiminh123' }) })).data.accessToken as string;
    const session = (await http('/v1/checkout', { method: 'POST', auth: buyer, body: JSON.stringify({ target: { type: 'tier', communityId, tierKey: 'premium', cycle: 'yearly' }, provider: 'sepay' }) })).data;
    const pending = await tool('list_pending_orders', { communityId });
    expect(pending.items.map((o: Loose) => o.orderId)).toContain(session.orderId);
    expect((await tool('get_order', { communityId, orderId: session.orderId })).status).toBe('pending');
    await tool('confirm_order_received', { communityId, orderId: session.orderId });
    expect((await tool('get_order', { communityId, orderId: session.orderId })).status).toBe('paid');
    expect((await tool('list_pending_orders', { communityId })).items.map((o: Loose) => o.orderId)).not.toContain(session.orderId);
    // Key không có billing:manage thì không xác nhận và không hoàn tiền được.
    const noMoney = await rpc(readKey, 'tools/call', { name: 'refund_order', arguments: { orderId: session.orderId, reason: 'thử' } });
    expect(noMoney.result.isError).toBe(true);
    expect(await tool('refund_order', { orderId: session.orderId, reason: 'Khách đổi ý' })).toBeTruthy();
  });

  it('cài đặt: chuyên mục, tiện ích, affiliate, khóa và mở khóa thành viên, duyệt bài', async () => {
    const feedSettings = await tool('get_feed_settings', { communityId });
    await tool('update_feed_settings', { communityId, requireSpace: feedSettings.requireSpace ?? true });
    const plugin = (await tool('list_plugins', { communityId })).find((p: Loose) => p.pluginKey === 'links');
    await tool('update_plugin', { communityId, key: 'links', enabled: plugin.enabled, config: plugin.config });
    const aff = (await tool('get_affiliate_program', { communityId })).program;
    await tool('update_affiliate_program', { communityId, enabled: aff.status === 'active', commissionRateBps: aff.commissionRateBps, holdDays: aff.holdDays, minWithdrawalMinor: aff.minWithdrawalMinor });
    const m = (await tool('list_members', { communityId, role: 'member', limit: 5 })).items[0];
    await tool('member_action', { communityId, memberId: m.id, action: 'ban' });
    expect((await tool('list_members', { communityId, status: 'banned' })).items.map((x: Loose) => x.id)).toContain(m.id);
    await tool('member_action', { communityId, memberId: m.id, action: 'unban' });
    const pricing = await tool('get_pricing', { communityId });
    const saved = await tool('update_pricing', { communityId, pricingMode: pricing.pricingMode, doorsOpen: pricing.doorsOpen, tiers: pricing.tiers.map((t: Loose) => ({ id: t.id, key: t.key, name: t.name, description: t.description ?? '', benefits: t.benefits ?? [], isDefault: t.isDefault, isActive: t.isActive, monthlyMinor: t.monthlyMinor, yearlyMinor: t.yearlyMinor, oneTimeMinor: t.oneTimeMinor })) });
    expect(saved).toBeTruthy();
  });

  it('webhook bài đăng mới và bình luận mới: kèm nội dung, tác giả, đường dẫn; nội dung do key tạo có cờ viaApiKey', async () => {
    const hook = await tool('create_webhook', { url: 'https://example.com/javis', events: ['post.created', 'comment.created'] });
    const deliveries = async () => (await app.ctx.db.query.webhookDeliveries.findMany()).filter((d) => d.webhookId === hook.id).map((d) => ({ event: d.eventName, data: d.payload as Loose }));
    const feed = await tool('list_posts', { communityId, limit: 1 });
    const space = feed.spaces.find((s: Loose) => s.postPermission === 'everyone') ?? feed.spaces[0];

    // Thành viên đăng bài và bình luận trên web.
    const member = (await http('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'congtran@gmail.com', password: 'hoiminh123' }) })).data.accessToken as string;
    const post = (await http(`/v1/communities/${communityId}/posts`, { method: 'POST', auth: member, body: JSON.stringify({ spaceId: space.id, title: 'Hỏi về funnel', contentMd: 'Mọi người cho mình hỏi cách dựng funnel với ạ.' }) })).data;
    expect(post.moderationStatus).toBe('approved');
    const comment = (await http('/v1/comments', { method: 'POST', auth: member, body: JSON.stringify({ targetType: 'post', targetId: post.id, contentMd: 'Mình bổ sung: ngân sách 5 triệu.' }) })).data;
    let got = await deliveries();
    const postEvent = got.find((d) => d.event === 'post.created' && d.data.postId === post.id)!;
    expect(postEvent.data).toMatchObject({ communityId, communitySlug: 'minhquy', title: 'Hỏi về funnel', contentMd: 'Mọi người cho mình hỏi cách dựng funnel với ạ.', author: { name: 'Công Trần' }, space: { id: space.id }, viaApiKey: false });
    expect(postEvent.data.url).toMatch(new RegExp(`/minhquy/bai-viet/${post.id}$`));
    const commentEvent = got.find((d) => d.event === 'comment.created' && d.data.commentId === comment.id)!;
    expect(commentEvent.data).toMatchObject({ targetType: 'post', targetId: post.id, parentCommentId: null, contentMd: 'Mình bổ sung: ngân sách 5 triệu.', author: { name: 'Công Trần' }, post: { id: post.id, title: 'Hỏi về funnel' }, viaApiKey: false });

    // Javis trả lời bằng API key: webhook vẫn phát, nhưng có cờ để Javis không tự trả lời chính mình.
    const reply = await tool('create_comment', { targetType: 'post', targetId: post.id, parentCommentId: comment.id, contentMd: 'Chào bạn, 5 triệu thì bắt đầu bằng một landing và một chuỗi email.' });
    got = await deliveries();
    expect(got.find((d) => d.event === 'comment.created' && d.data.commentId === reply.id)!.data).toMatchObject({ parentCommentId: comment.id, viaApiKey: true });
    const own = await tool('create_post', { communityId, title: 'Bài của chủ hội qua Javis', contentMd: 'Nội dung.' });
    expect((await deliveries()).find((d) => d.event === 'post.created' && d.data.postId === own.id)!.data.viaApiKey).toBe(true);

    // Webhook không đăng ký hai sự kiện này thì không nhận.
    const other = await tool('create_webhook', { url: 'https://example.com/khac', events: ['member.joined'] });
    await tool('create_comment', { targetType: 'post', targetId: post.id, contentMd: 'Thêm một bình luận.' });
    expect((await app.ctx.db.query.webhookDeliveries.findMany()).filter((d) => d.webhookId === other.id)).toHaveLength(0);
    expect((await tool('list_webhooks')).find((w: Loose) => w.id === hook.id).recent.length).toBeGreaterThanOrEqual(5);
    await tool('delete_webhook', { webhookId: hook.id });
    await tool('delete_webhook', { webhookId: other.id });
  });

  it('mọi lệnh đều có khai báo MCP hợp lệ', () => {
    for (const t of TOOLS) expect(describeTool(t).inputSchema.type).toBe('object');
    expect(TOOLS.length).toBeGreaterThan(70);
  });
});
