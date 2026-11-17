// POST /mcp: địa chỉ MCP từ xa của Hội Mình. Trợ lý AI (Javis, Claude, Cursor...) chỉ cần URL này và một API key
// ở header `Authorization: Bearer hm_...`, không phải cài gì trên máy.
//
// Mỗi lệnh gọi lại chính REST `/v1` của API này ngay trong tiến trình (không qua mạng), mang theo đúng API key của người gọi.
// Nhờ vậy quyền theo phạm vi, hạn mức gói, nhật ký dùng key và giới hạn số lần gọi của MCP giống hệt REST, không có đường tắt.
import { AppError, unauthorized } from '@hoiminh/core';
import type { Hono } from 'hono';
import type { Env } from '../lib/hono';
import { handleMcp } from '../mcp/server';
import { ApiError, type Api } from '../mcp/tools';

const MAX_BODY_CHARS = 1_000_000;

export function mountMcp(h: Hono<Env>): void {
  h.post('/mcp', async (c) => {
    const actor = c.get('ctx').actor;
    if (actor.type !== 'api_key') {
      c.header('WWW-Authenticate', 'Bearer realm="hoiminh"');
      throw unauthorized('MCP cần API key ở header Authorization: Bearer hm_... (tạo ở Hội của tôi, Nhà phát triển).');
    }
    const authorization = c.req.header('authorization') ?? '';
    const requestId = c.get('ctx').requestId;
    const ip = c.req.header('cf-connecting-ip');
    let execution: unknown;
    try {
      execution = c.executionCtx;
    } catch {
      execution = undefined; // Node và test không có ExecutionContext của Workers.
    }
    let n = 0;
    const api: Api = async (method, path, body) => {
      n += 1;
      const headers: Record<string, string> = { Authorization: authorization, 'Content-Type': 'application/json', 'X-Request-Id': `${requestId}.${n}` };
      if (ip) headers['cf-connecting-ip'] = ip;
      const res = await h.fetch(new Request(new URL(path, c.req.url), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), c.env, execution as never);
      const text = await res.text();
      const isJson = (res.headers.get('content-type') ?? '').includes('json');
      let data: unknown = text;
      if (isJson && text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) {
        const e = (data ?? {}) as { code?: string; message?: string; details?: unknown };
        throw new ApiError(e.code ?? String(res.status), e.message ?? 'Lỗi API', res.status, e.details);
      }
      return data;
    };

    // Cờ `mcp` do quản trị hệ thống giữ: tắt thì cả địa chỉ này ngừng phục vụ.
    const integration = (await api('GET', '/v1/me/integration')) as { mcpEnabled?: boolean };
    if (!integration.mcpEnabled) throw new AppError('feature_disabled', 'MCP đang tắt trên Hội Mình. Quản trị hệ thống bật ở Hệ thống, Gói nền tảng, Tính năng, "MCP cho AI".', 403);

    const raw = await c.req.text();
    if (raw.length > MAX_BODY_CHARS) return c.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Yêu cầu quá lớn (tối đa 1MB)' } }, 413);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Thân yêu cầu không phải JSON hợp lệ' } }, 400);
    }
    const out = await handleMcp(payload, { scopes: actor.scopes, api });
    if (out.body === null) return c.body(null, 202);
    return c.json(out.body, out.status);
  });

  // Máy chủ không mở luồng SSE và không giữ phiên, nên GET và DELETE trả 405 đúng như chuẩn MCP quy định.
  const notAllowed = (c: { json: (b: unknown, s: 405, h: Record<string, string>) => Response }) => c.json({ code: 'method_not_allowed', message: 'MCP của Hội Mình chỉ nhận POST (JSON-RPC).' }, 405, { Allow: 'POST' });
  h.get('/mcp', (c) => notAllowed(c));
  h.delete('/mcp', (c) => notAllowed(c));
}
