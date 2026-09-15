// Khóa học, module, bài học, tiến độ, chứng nhận hoàn thành.
import { createCourseSchema, lessonInputSchema, moduleInputSchema, reorderSchema, updateCourseSchema, updateLessonSchema } from '@hoiminh/contracts';
import { certificates, courses, systemCtx } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const learningRoutes = router();

learningRoutes.get('/communities/:id/courses', async (c) => c.json(await courses.listCourses(c.get('ctx'), c.req.param('id'))));
learningRoutes.post('/communities/:id/courses', requireAuth, async (c) => c.json(await courses.createCourse(c.get('ctx'), c.req.param('id'), await parse(createCourseSchema, await body(c))), 201));
learningRoutes.get('/courses/:id', async (c) => c.json(await courses.getCourse(c.get('ctx'), c.req.param('id'))));

/** Chứng nhận của tôi cho khóa này; 404 nếu chưa hoàn thành hoặc khóa tắt chứng nhận. */
learningRoutes.get('/courses/:id/certificate', requireAuth, async (c) => {
  const cert = await certificates.myCertificate(c.get('ctx'), c.req.param('id'));
  if (!cert) return c.json({ code: 'not_found', message: 'Bạn chưa có chứng nhận cho khóa học này' }, 404);
  return c.json(cert);
});
/**
 * Tra cứu công khai theo mã in trên chứng nhận: ai cầm tờ giấy cũng kiểm được, không cần tài khoản.
 * Chạy dưới ngữ cảnh hệ thống vì RLS của bảng chỉ cho chủ sở hữu đọc.
 */
learningRoutes.get('/certificates/:code', async (c) => c.json(await certificates.verifyCertificate(systemCtx(c.get('app').ctx, c.get('ctx').requestId), c.req.param('code'))));
learningRoutes.patch('/courses/:id', requireAuth, async (c) => c.json(await courses.updateCourse(c.get('ctx'), c.req.param('id'), await parse(updateCourseSchema, await body(c)))));
learningRoutes.delete('/courses/:id', requireAuth, async (c) => {
  await courses.deleteCourse(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
learningRoutes.post('/courses/:id/modules', requireAuth, async (c) => c.json(await courses.upsertModule(c.get('ctx'), c.req.param('id'), await parse(moduleInputSchema, await body(c))), 201));
learningRoutes.patch('/courses/:id/modules/:moduleId', requireAuth, async (c) => c.json(await courses.upsertModule(c.get('ctx'), c.req.param('id'), { id: c.req.param('moduleId'), ...(await parse(moduleInputSchema, await body(c))) })));
learningRoutes.delete('/modules/:id', requireAuth, async (c) => {
  await courses.deleteModule(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
learningRoutes.post('/courses/:id/lessons', requireAuth, async (c) => c.json(await courses.upsertLesson(c.get('ctx'), c.req.param('id'), await parse(lessonInputSchema, await body(c))), 201));
learningRoutes.patch('/courses/:id/lessons/:lessonId', requireAuth, async (c) => c.json(await courses.upsertLesson(c.get('ctx'), c.req.param('id'), { id: c.req.param('lessonId'), ...(await parse(updateLessonSchema, await body(c))) })));
learningRoutes.delete('/lessons/:id', requireAuth, async (c) => {
  await courses.deleteLesson(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
learningRoutes.put('/courses/:id/reorder', requireAuth, async (c) => {
  const { modules } = await parse(reorderSchema, await body(c));
  await courses.reorder(c.get('ctx'), c.req.param('id'), modules);
  return c.json({ ok: true });
});
learningRoutes.get('/lessons/:id', async (c) => c.json(await courses.getLesson(c.get('ctx'), c.req.param('id'))));
learningRoutes.post('/lessons/:id/complete', requireAuth, async (c) => c.json(await courses.completeLesson(c.get('ctx'), c.req.param('id'))));
learningRoutes.post('/video/parse', async (c) => {
  const { url } = await parse(z.object({ url: z.string() }), await body(c));
  const { parseVideoUrl } = await import('@hoiminh/contracts');
  return c.json({ embed: parseVideoUrl(url) });
});
