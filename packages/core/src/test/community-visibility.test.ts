// Hội kín và hội mở: hội kín chỉ thành viên xem được bên trong; hội mở thì ai cũng xem được (kể cả chưa đăng nhập),
// nhưng đăng bài, bình luận, thả tim, đăng ký sự kiện vẫn chỉ dành cho thành viên.
import { and, eq } from 'drizzle-orm';
import { communities as communitiesTable, communityMembers } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { resolveCommunityAccess } from '../permissions';
import * as comments from '../services/comments';
import * as communities from '../services/communities';
import * as courses from '../services/courses';
import * as events from '../services/events';
import * as members from '../services/members';
import * as posts from '../services/posts';
import * as shell from '../services/shell';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let postId = '';
let spaceId = '';
/** Người có tài khoản nhưng chưa vào hội. */
let outsider: Ctx;

const NEW_POST = { title: 'Bài của người ngoài', contentMd: 'Nội dung', statusBgKey: null, imageFileIds: [], videoUrl: null, linkUrl: null, broadcastEmail: false, poll: null };

async function setVisibility(visibility: 'private' | 'public') {
  return communities.updateGeneral(await app.as('minhquy'), kd, { visibility });
}

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  const owner = await app.as('minhquy');
  spaceId = (await posts.feed(owner, kd, {})).spaces[0]!.id;
  postId = (await posts.createPost(owner, kd, { ...NEW_POST, spaceId, title: 'Bài thử hội mở' })).id;
  // Thảo Vy có hội riêng; gỡ khỏi hội này (nếu dữ liệu mẫu có) để chắc chắn là người ngoài.
  const vy = await app.ids('user:thaovy');
  await app.ctx.db.delete(communityMembers).where(and(eq(communityMembers.communityId, kd), eq(communityMembers.userId, vy)));
  outsider = { ...app.ctx, actor: { type: 'user', userId: vy, isSuperAdmin: false, email: 'vy.english@gmail.com' }, requestId: 'test-outsider' };
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('hội kín (mặc định)', () => {
  it('hội mới và hội có sẵn đều là hội kín', async () => {
    const row = await app.ctx.db.query.communities.findFirst({ where: eq(communitiesTable.id, kd), columns: { visibility: true } });
    expect(row?.visibility).toBe('private');
  });

  it('người ngoài và khách chưa đăng nhập không xem được bảng tin, bài viết, khóa học, sự kiện, thành viên', async () => {
    for (const ctx of [outsider, app.anon()]) {
      expect((await resolveCommunityAccess(ctx, kd)).canView).toBe(false);
      await expect(posts.feed(ctx, kd, {})).rejects.toThrow();
      await expect(posts.getPost(ctx, postId)).rejects.toThrow();
      await expect(comments.listComments(ctx, 'post', postId)).rejects.toThrow();
      await expect(courses.listCourses(ctx, kd)).rejects.toThrow();
      await expect(events.listEvents(ctx, kd, {})).rejects.toThrow();
      await expect(members.memberDirectory(ctx, kd, {})).rejects.toThrow();
    }
  });

  it('thành viên vẫn xem như cũ', async () => {
    const duy = await app.as('duy');
    expect((await resolveCommunityAccess(duy, kd)).canView).toBe(true);
    expect((await posts.feed(duy, kd, {})).items.length).toBeGreaterThan(0);
  });
});

describe('hội mở', () => {
  beforeAll(async () => {
    const row = await setVisibility('public');
    expect(row.visibility).toBe('public');
  });
  afterAll(async () => {
    await setVisibility('private');
  });

  it('người ngoài và khách chưa đăng nhập xem được bảng tin, bài viết, bình luận, khóa học, sự kiện, thành viên', async () => {
    for (const ctx of [outsider, app.anon()]) {
      const access = await resolveCommunityAccess(ctx, kd);
      expect(access.canView).toBe(true);
      // Xem được không có nghĩa là có quyền của thành viên.
      expect(access.role).toBe('guest');
      expect(access.permissions.size).toBe(0);
      expect((await posts.feed(ctx, kd, {})).items.some((p) => p.id === postId)).toBe(true);
      expect((await posts.getPost(ctx, postId)).title).toBe('Bài thử hội mở');
      expect(Array.isArray((await comments.listComments(ctx, 'post', postId)).items)).toBe(true);
      expect(Array.isArray((await events.listEvents(ctx, kd, {})).items)).toBe(true);
      expect((await members.memberDirectory(ctx, kd, {})).length).toBeGreaterThan(0);
    }
  });

  it('người ngoài thấy danh sách khóa học nhưng khóa nào cũng còn khóa', async () => {
    const list = await courses.listCourses(app.anon(), kd);
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((c) => c.status === 'published')).toBe(true);
    expect(list.items.every((c) => c.locked)).toBe(true);
    expect(list.canManage).toBe(false);
  });

  it('người ngoài không nhận bản ghi sự kiện và không thấy danh bạ kèm email', async () => {
    expect((await events.listEvents(outsider, kd, {})).recordings).toEqual([]);
    const row = (await members.memberDirectory(outsider, kd, {}))[0]!;
    expect(Object.keys(row.user)).not.toContain('email');
  });

  it('người ngoài không đăng bài, bình luận, thả tim được', async () => {
    await expect(posts.createPost(outsider, kd, { ...NEW_POST, spaceId })).rejects.toThrow();
    await expect(comments.createComment(outsider, 'post', postId, { contentMd: 'Bình luận của người ngoài' })).rejects.toThrow();
    await expect(comments.toggleReaction(outsider, 'post', postId)).rejects.toThrow();
    await expect(posts.createPost(app.anon(), kd, { ...NEW_POST, spaceId })).rejects.toThrow();
  });

  it('người ngoài không xem được danh sách quản trị thành viên, xếp hạng, bản ghi', async () => {
    await expect(members.listMembers(outsider, kd, {} as never)).rejects.toThrow();
    await expect(events.listRecordings(outsider, kd)).rejects.toThrow();
  });

  it('khung hội báo cho web biết hội đang mở và người xem vào xem được', async () => {
    const s = await shell.communityShell(app.anon(), 'minhquy');
    expect(s.community.visibility).toBe('public');
    expect(s.viewer).toMatchObject({ canView: true, isMember: false, role: 'guest' });
  });

  it('chỉ người quản lý hội đổi được chế độ', async () => {
    await expect(communities.updateGeneral(outsider, kd, { visibility: 'private' })).rejects.toThrow();
    await expect(communities.updateGeneral(await app.as('duy'), kd, { visibility: 'private' })).rejects.toThrow();
  });

  it('hội mở mà bị khóa hoặc lưu trữ thì người ngoài không xem được nữa', async () => {
    await app.ctx.db.update(communitiesTable).set({ status: 'locked' }).where(eq(communitiesTable.id, kd));
    try {
      expect((await resolveCommunityAccess(app.anon(), kd)).canView).toBe(false);
      await expect(posts.feed(app.anon(), kd, {})).rejects.toThrow();
    } finally {
      await app.ctx.db.update(communitiesTable).set({ status: 'active' }).where(eq(communitiesTable.id, kd));
    }
  });
});

describe('đổi lại thành hội kín', () => {
  it('người ngoài lập tức không xem được nữa', async () => {
    await setVisibility('public');
    expect((await posts.feed(app.anon(), kd, {})).items.length).toBeGreaterThan(0);
    await setVisibility('private');
    await expect(posts.feed(app.anon(), kd, {})).rejects.toThrow();
    await expect(posts.feed(outsider, kd, {})).rejects.toThrow();
  });
});
