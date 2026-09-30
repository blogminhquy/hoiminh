// Tiêu chí nghiệm thu của Phase 6: không còn cron mỗi phút ở bất kỳ đâu (Worker production, dev bằng Node, mã điều phối).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cronNameFor } from '../jobs/cron';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('lịch cron sau refactor', () => {
  it('wrangler.toml của hoiminh-jobs chỉ còn hai cron: 10 phút và hằng ngày', () => {
    const toml = read('../../../../apps/jobs/wrangler.toml');
    const line = toml.split('\n').find((l) => /^\s*crons\s*=/.test(l));
    expect(line).toBeTruthy();
    const crons = [...line!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(crons).toEqual(['*/10 * * * *', '0 18 * * *']);
  });

  it('không còn tên cron every_minute trong Worker jobs, server dev Node và mã điều phối', () => {
    for (const rel of ['../../../../apps/jobs/src/worker.ts', '../../../../apps/api/src/node.ts', '../jobs/cron.ts']) {
      expect(read(rel), rel).not.toContain('every_minute');
    }
  });

  it('hoiminh-api không có cron', () => {
    expect(read('../../../../apps/api/wrangler.toml')).toMatch(/crons\s*=\s*\[\s*\]/);
  });
});

describe('cronNameFor: lịch cron → nhóm việc', () => {
  it('chỉ nhận đúng hai lịch của wrangler.toml', () => {
    expect(cronNameFor('*/10 * * * *')).toBe('every_10_minutes');
    expect(cronNameFor('0 18 * * *')).toBe('daily');
  });

  it('lịch lạ (trigger cũ còn sót sau khi gỡ khỏi wrangler.toml) bị bỏ qua thay vì chạy nhầm bộ quét và xếp hạng', () => {
    expect(cronNameFor('* * * * *')).toBeNull();
    expect(cronNameFor('*/5 * * * *')).toBeNull();
    expect(cronNameFor('')).toBeNull();
  });

  it('Worker jobs dùng cronNameFor, không tự suy tên cron từ chuỗi', () => {
    const worker = read('../../../../apps/jobs/src/worker.ts');
    expect(worker).toContain('cronNameFor(event.cron)');
    expect(worker).not.toMatch(/event\.cron\s*===/);
  });
});
