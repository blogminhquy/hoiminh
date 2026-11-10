// Trang "Hội của tôi": doanh thu 30 ngày của từng hội phải khớp với trang Tổng quan của chính hội đó.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as revenue from '../services/revenue';
import * as workspaces from '../services/workspaces';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('myWorkspaceHome', () => {
  it('doanh thu 30 ngày của mỗi hội khớp với Tổng quan của hội đó (từng luôn là 0)', async () => {
    const ctx = await app.as('minhquy');
    const home = await workspaces.myWorkspaceHome(ctx);
    expect(home.owned.length).toBeGreaterThan(0);
    for (const c of home.owned) {
      const overview = await revenue.settingsOverview(ctx, c.id, { days: 30 });
      expect(c.revenue30Minor, `hội ${c.name}`).toBe(overview.stats.revenueMinor);
    }
    const kd = home.owned.find((c) => c.slug === 'minhquy');
    expect(kd?.revenue30Minor).toBeGreaterThan(0);
  });
});
