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
