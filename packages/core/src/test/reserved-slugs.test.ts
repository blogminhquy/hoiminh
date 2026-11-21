// Hai trang pháp lý /dieu-khoan và /quyen-rieng-tu (chủ dự án báo ngày 22/11/2026: mở ra thì hiện "Hội không tồn tại").
// Hai địa chỉ này nay là trang của hệ thống, nên không hội nào được đặt hoặc đổi đường dẫn thành hai tên đó.
import { inArray } from 'drizzle-orm';
import { communities as communitiesTable, communitySlugAliases } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as communities from '../services/communities';
import { createTestApp, type TestApp } from './setup';

const LEGAL = ['dieu-khoan', 'quyen-rieng-tu'];
let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('đường dẫn giữ chỗ cho hai trang pháp lý', () => {
  it('kiểm tra đường dẫn: báo là hệ thống đang dùng', async () => {
    const mq = await app.as('minhquy');
    for (const slug of LEGAL) await expect(communities.assertSlugAvailable(mq, slug), slug).rejects.toThrow(/được hệ thống dùng/);
  });

  it('không tạo được hội mới với hai đường dẫn này', async () => {
    const mq = await app.as('minhquy');
    for (const slug of LEGAL) {
      await expect(communities.createCommunity(mq, { name: 'Hội thử', slug, shortDescription: '', description: '', pricingMode: 'free', category: 'kinh-doanh', template: 'blank' }), slug).rejects.toThrow(/được hệ thống dùng/);
    }
  });

  it('hội đang có không đổi được đường dẫn sang hai tên này', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids('community:kd');
    for (const slug of LEGAL) await expect(communities.updateGeneral(mq, kd, { slug }), slug).rejects.toThrow(/được hệ thống dùng/);
  });

  it('dữ liệu mẫu không có hội hay đường dẫn cũ nào dùng hai tên này', async () => {
    const taken = await app.ctx.db.select({ slug: communitiesTable.slug }).from(communitiesTable).where(inArray(communitiesTable.slug, LEGAL));
    const aliases = await app.ctx.db.select({ slug: communitySlugAliases.slug }).from(communitySlugAliases).where(inArray(communitySlugAliases.slug, LEGAL));
    expect([...taken, ...aliases]).toEqual([]);
  });
});
