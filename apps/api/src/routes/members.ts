// /v1/communities/:id/members: quản trị thành viên (bộ lọc, modal 4 tab, đổi vai trò/gói, hành động, mời, CSV) và danh bạ công khai.
import { inviteSchema, memberFilterSchema, updateMemberSchema } from '@hoiminh/contracts';
import { members } from '@hoiminh/core';
import { z } from 'zod';
import { body, csv, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const memberRoutes = router();
// Danh bạ thành viên đăng ký TRƯỚC các dòng requireAuth bên dưới: hội mở cho cả người chưa đăng nhập xem danh bạ,
// còn có được xem hay không do service quyết định (access.canView). Hội kín vẫn chỉ thành viên xem được.
memberRoutes.get('/:id/members/directory', async (c) => c.json(await members.memberDirectory(c.get('ctx'), c.req.param('id'), { q: query(c).q })));
// Chỉ bắt buộc đăng nhập cho các đường dẫn thành viên (không áp cho /v1/communities/* công khai).
memberRoutes.use('/:id/members', requireAuth);
memberRoutes.use('/:id/members/*', requireAuth);
memberRoutes.use('/:id/invites', requireAuth);
memberRoutes.use('/:id/touch', requireAuth);
memberRoutes.use('/:id/today', requireAuth);

memberRoutes.get('/:id/members', async (c) => {
  const q = await parse(memberFilterSchema, query(c));
  return c.json(await members.listMembers(c.get('ctx'), c.req.param('id'), q));
});
memberRoutes.get('/:id/members/export.csv', async (c) => csv(c, await members.exportMembersCsv(c.get('ctx'), c.req.param('id'), { status: query(c).status as 'active' }), 'thanh-vien.csv'));
memberRoutes.get('/:id/members/:memberId', async (c) => c.json(await members.memberDetail(c.get('ctx'), c.req.param('id'), c.req.param('memberId'))));
memberRoutes.patch('/:id/members/:memberId', async (c) => c.json(await members.updateMember(c.get('ctx'), c.req.param('id'), c.req.param('memberId'), await parse(updateMemberSchema, await body(c)))));
memberRoutes.post('/:id/members/:memberId/actions', async (c) => {
  const { action } = await parse(z.object({ action: z.enum(['remove', 'ban', 'cancel_subscription', 'approve', 'unban']) }), await body(c));
  await members.memberAction(c.get('ctx'), c.req.param('id'), c.req.param('memberId'), action);
  return c.json({ ok: true });
});
memberRoutes.post('/:id/members/:memberId/grant-course', async (c) => {
  const { courseId } = await parse(z.object({ courseId: z.string().uuid() }), await body(c));
  await members.grantCourse(c.get('ctx'), c.req.param('id'), c.req.param('memberId'), courseId);
  return c.json({ ok: true });
});
memberRoutes.post('/:id/invites', async (c) => c.json(await members.invite(c.get('ctx'), c.req.param('id'), await parse(inviteSchema.partial({ emails: true }), await body(c))), 201));
/** Việc người xem đã làm hôm nay trong hội (trang Hôm nay): số bài học xong, bình luận, bài đăng. */
memberRoutes.get('/:id/today', async (c) => c.json(await members.todayActivity(c.get('ctx'), c.req.param('id'))));
memberRoutes.post('/:id/touch', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.actor.type === 'user') await members.touchActivity(ctx, c.req.param('id'), ctx.actor.userId);
  return c.json({ ok: true });
});
