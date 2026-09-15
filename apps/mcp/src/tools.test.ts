import { describe, expect, it } from 'vitest';
import { createClient } from './client';
import { TOOLS, runTool } from './tools';

describe('MCP tools', () => {
  it('khai báo đủ 10 tool', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual(['add_member', 'change_member_tier', 'create_course', 'create_event', 'create_post', 'get_member_progress', 'list_withdrawals', 'mark_withdrawal_paid', 'send_announcement', 'list_communities'].sort());
    expect(TOOLS.find((t) => t.name === 'create_post')?.inputSchema).toMatchObject({ type: 'object', required: ['communityId', 'contentMd'] });
  });
  it('gọi API với API key và map lỗi', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), auth: (init?.headers as Record<string, string>)['Authorization'] ?? null });
      if (String(input).endsWith('/v1/me/communities')) return new Response(JSON.stringify([{ id: '1', slug: 'x', workspaceId: 'w' }]), { status: 200 });
      return new Response(JSON.stringify({ code: 'forbidden', message: 'Không có quyền' }), { status: 403 });
    };
    const client = createClient('http://api', 'hm_test_key', fetchImpl);
    expect(await runTool(client, 'list_communities', {})).toEqual([{ id: '1', slug: 'x', workspaceId: 'w' }]);
    expect(calls[0]?.auth).toBe('Bearer hm_test_key');
    await expect(runTool(client, 'mark_withdrawal_paid', { withdrawalId: '00000000-0000-4000-8000-000000000000', transferReference: 'FT1', version: 1 })).rejects.toThrow(/forbidden/);
    await expect(runTool(client, 'khong_co', {})).rejects.toThrow();
  });
});
