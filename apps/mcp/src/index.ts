#!/usr/bin/env node
// MCP của Hội Mình cho ứng dụng chỉ nhận máy chủ chạy trên máy (stdio): một cầu nối mỏng tới MCP từ xa ở <API>/mcp.
// Ứng dụng nào nhận được URL (Javis, Claude, Cursor...) thì cắm thẳng https://api.hoiminh.com/mcp, không cần file này.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRemote } from './remote';

const apiUrl = process.env.HOIMINH_API_URL ?? 'http://localhost:8787';
const apiKey = process.env.HOIMINH_API_KEY ?? '';
if (!apiKey) {
  console.error('Thiếu HOIMINH_API_KEY (tạo ở Hội của tôi → Nhà phát triển → API key).');
  process.exit(1);
}
const remote = createRemote(apiUrl, apiKey);

// Bắt tay một lần lúc khởi động: key sai, key bị thu hồi hoặc MCP đang tắt thì báo ngay, không để lỗi rải ở từng lệnh.
let info: { serverInfo?: { version?: string }; instructions?: string };
try {
  info = await remote.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'hoiminh-mcp-stdio', version: '2.0.0' } });
} catch (err) {
  console.error(`Không nối được MCP của Hội Mình ở ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const server = new Server({ name: 'hoiminh', version: info.serverInfo?.version ?? '2.0.0' }, { capabilities: { tools: {} }, instructions: info.instructions });

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
server.setRequestHandler(ListToolsRequestSchema, async () => remote.request<{ tools: never[] }>('tools/list'));
server.setRequestHandler(CallToolRequestSchema, async (req): Promise<ToolResult> => {
  try {
    return await remote.request<ToolResult>('tools/call', { name: req.params.name, arguments: req.params.arguments ?? {} });
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }] };
  }
});

await server.connect(new StdioServerTransport());
console.error(`MCP Hội Mình sẵn sàng · ${apiUrl}/mcp`);
