// Đường dẫn hệ thống nào cũng phải được giữ chỗ, không thì một hội đặt trùng tên sẽ bị che mất trang (trang của hội nằm
// ở hoiminh.com/<slug>). Test đọc thẳng ba nơi khai báo đường dẫn, nên thêm route mới mà quên giữ chỗ thì test đỏ.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from './index';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
/** Một đoạn đường dẫn có thể bị đặt làm slug của hội: chữ thường, số, gạch ngang (xem slugSchema). Đoạn có dấu chấm, gạch dưới thì không ai đặt trùng được. */
const couldBeSlug = (segment: string) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(segment);
const missing = (segments: string[]) => [...new Set(segments)].filter((s) => couldBeSlug(s) && !RESERVED_SLUGS.has(s)).sort();

describe('giữ chỗ đường dẫn hệ thống', () => {
  it('route cấp cao nhất của web', () => {
    // Route cấp cao nhất viết dạng `path: '/ten/...'`; route con của hội viết không có dấu gạch chéo đầu.
    const segments = [...read('apps/web/src/app/router.tsx').matchAll(/path:\s*'\/([^/':*]+)/g)].map((m) => m[1]!);
    expect(segments.length).toBeGreaterThan(10);
    expect(missing(segments)).toEqual([]);
  });

  it('đường dẫn chạy Worker trước giao diện (API, MCP, webhook, tệp)', () => {
    const line = /run_worker_first\s*=\s*\[([^\]]*)\]/.exec(read('apps/api/wrangler.toml'))?.[1] ?? '';
    const segments = [...line.matchAll(/"\/([^/"*]+)/g)].map((m) => m[1]!);
    expect(segments).toEqual(expect.arrayContaining(['v1', 'mcp', 'webhooks', 'r', 'files', 'health']));
    expect(missing(segments)).toEqual([]);
  });

  it('thư mục tệp tĩnh của web', () => {
    const dir = new URL('apps/web/public/', root);
    const folders = existsSync(dir) ? readdirSync(dir).filter((name) => statSync(new URL(name, dir)).isDirectory()) : [];
    // `assets` là thư mục Vite sinh ra lúc build, không nằm trong public nhưng cũng phải được giữ.
    expect(missing([...folders, 'assets'])).toEqual([]);
  });

  it('các tên vừa bổ sung đều bị chặn', () => {
    for (const slug of ['chung-nhan', 'mcp', 'webhooks', 'pay', 'files', 'health', 'icons']) expect(RESERVED_SLUGS.has(slug), slug).toBe(true);
  });
});
