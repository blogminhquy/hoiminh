#!/usr/bin/env node
// MCP server của Hội Mình: gọi REST API bằng API key (HOIMINH_API_KEY), không chạm database.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from './client';
import { TOOLS, runTool } from './tools';

const apiUrl = process.env.HOIMINH_API_URL ?? 'http://localhost:8787';
const apiKey = process.env.HOIMINH_API_KEY ?? '';
if (!apiKey) {
  console.error('Thiếu HOIMINH_API_KEY (tạo ở Hội của tôi → Nhà phát triển → API key).');
  process.exit(1);
}
const client = createClient(apiUrl, apiKey);

// Cờ `mcp` do super admin giữ: tắt thì server không phục vụ tool nào, thay vì báo lỗi rải rác ở từng lệnh.
try {
  const integration = await client.get<{ mcpEnabled: boolean }>('/v1/me/integration');
  if (!integration.mcpEnabled) {
    console.error('MCP đang tắt trên nền tảng này. Bật ở Hệ thống → Gói nền tảng → Tính năng → "MCP cho AI".');
    process.exit(1);
  }
} catch (err) {
  console.error(`Không kiểm tra được trạng thái MCP: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const server = new Server({ name: 'hoiminh', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await runTool(client, req.params.name, req.params.arguments ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`MCP Hội Mình sẵn sàng · ${apiUrl}`);
