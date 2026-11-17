import { describe, expect, it } from 'vitest';
import { createRemote } from './remote';

describe('cầu nối stdio tới MCP từ xa', () => {
  it('gửi JSON-RPC tới <API>/mcp kèm API key và trả result', async () => {
    const calls: Array<{ url: string; auth: string; body: { method: string; params?: unknown; id: number } }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(input), auth: (init?.headers as Record<string, string>).Authorization ?? '', body });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'list_communities' }] } }), { status: 200 });
    };
    const remote = createRemote('https://api.hoiminh.com/', 'hm_test_key', fetchImpl);
    expect(await remote.request('tools/list')).toEqual({ tools: [{ name: 'list_communities' }] });
    await remote.request('tools/call', { name: 'list_communities', arguments: {} });
    expect(calls[0]).toMatchObject({ url: 'https://api.hoiminh.com/mcp', auth: 'Bearer hm_test_key', body: { method: 'tools/list', id: 1 } });
    expect(calls[1]?.body).toMatchObject({ method: 'tools/call', id: 2, params: { name: 'list_communities' } });
  });

  it('key sai, MCP tắt, lỗi giao thức và trang không phải JSON đều thành lỗi đọc được', async () => {
    const respond = (status: number, body: string): typeof fetch => async () => new Response(body, { status });
    await expect(createRemote('http://api', 'k', respond(401, JSON.stringify({ code: 'unauthorized', message: 'API key không hợp lệ hoặc đã thu hồi' }))).request('initialize')).rejects.toThrow(/unauthorized: API key không hợp lệ/);
    await expect(createRemote('http://api', 'k', respond(403, JSON.stringify({ code: 'feature_disabled', message: 'MCP đang tắt' }))).request('initialize')).rejects.toThrow(/feature_disabled/);
    await expect(createRemote('http://api', 'k', respond(200, JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Không hỗ trợ phương thức x' } }))).request('x')).rejects.toThrow(/Không hỗ trợ/);
    await expect(createRemote('http://api', 'k', respond(200, '<!doctype html><html>')).request('initialize')).rejects.toThrow(/không phải JSON/);
  });
});
