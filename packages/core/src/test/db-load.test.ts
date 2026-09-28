// Giảm tải database: email chỉ gửi sau khi transaction commit (hủy thì không gửi),
// và phạm vi quyền của người dùng tính bằng một truy vấn mà vẫn đúng như trước.
import { templates } from '@hoiminh/email';
import { communities, communityMembers, workspaceMembers, workspaces } from '@hoiminh/db';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveScope, withTenantScope } from '../lib/tenant-scope';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('Email gửi sau khi commit', () => {
  it('trong transaction chỉ ghi nhận, commit xong mới gửi', async () => {
    const ctx = await app.as('duy');
    const before = app.emails.length;
    let seenInside = -1;
    await withTenantScope(ctx, async (scoped) => {
      const r = await scoped.email.send(templates.passwordChanged('a@b.vn', 'A'));
      expect(r.status).toBe('queued');
      seenInside = app.emails.length;
    });
    expect(seenInside).toBe(before);
    expect(app.emails.length).toBe(before + 1);
  });

  it('transaction bị hủy thì email không đi', async () => {
    const ctx = await app.as('duy');
    const before = app.emails.length;
    await expect(withTenantScope(ctx, async (scoped) => {
      await scoped.email.send(templates.passwordChanged('a@b.vn', 'A'));
      throw new Error('lỗi giữa chừng');
    })).rejects.toThrow('lỗi giữa chừng');
    expect(app.emails.length).toBe(before);
  });
});

describe('Phạm vi quyền một truy vấn', () => {
  /** Cách tính cũ (bốn truy vấn), giữ lại để so. */
  async function oldScope(userId: string) {
    const db = app.ctx.db;
    const owned = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, userId));
    const member = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId));
    const cm = await db.select({ id: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, userId));
    const ws = [...new Set([...owned, ...member].map((r) => r.id))];
    const cs = new Set(cm.map((r) => r.id));
    if (ws.length) for (const r of await db.select({ id: communities.id }).from(communities).where(inArray(communities.workspaceId, ws))) cs.add(r.id);
    return { ws: ws.sort(), cs: [...cs].sort() };
  }

  it.each(['minhquy', 'duy', 'member1', 'thulan'] as const)('%s: giống hệt cách tính cũ', async (key) => {
    const ctx = await app.as(key);
    const userId = await app.ids(`user:${key}`);
    const scope = await resolveScope(ctx);
    const expected = await oldScope(userId);
    expect([...scope.workspaceIds].sort()).toEqual(expected.ws);
    expect([...scope.communityIds].sort()).toEqual(expected.cs);
    expect(scope.bypass).toBe(false);
  });

  it('chủ hội thấy mọi hội trong workspace của mình', async () => {
    const scope = await resolveScope(await app.as('minhquy'));
    expect(scope.workspaceIds.length).toBeGreaterThan(0);
    expect(scope.communityIds).toContain(await app.ids('community:kd'));
  });
});
