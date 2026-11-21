// Khóa học, module, bài học, tiến độ.
import { createCourseSchema, lessonInputSchema, moduleInputSchema, reorderCoursesSchema, reorderSchema, updateCourseSchema, updateLessonSchema } from '@hoiminh/contracts';
import { courses, videoMeta } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const learningRoutes = router();

learningRoutes.get('/communities/:id/courses', async (c) => c.json(await courses.listCourses(c.get('ctx'), c.req.param('id'))));
learningRoutes.post('/communities/:id/courses', requireAuth, async (c) => c.json(await courses.createCourse(c.get('ctx'), c.req.param('id'), await parse(createCourseSchema, await body(c))), 201));
learningRoutes.put('/communities/:id/courses/order', requireAuth, async (c) => {
  const { courseIds } = await parse(reorderCoursesSchema, await body(c));
  await courses.reorderCourses(c.get('ctx'), c.req.param('id'), courseIds);
  return c.json({ ok: true });
});
learningRoutes.get('/courses/:id', async (c) => c.json(await courses.getCourse(c.get('ctx'), c.req.param('id'))));
learningRoutes.post('/courses/:id/duplicate', requireAuth, async (c) => c.json(await courses.duplicateCourse(c.get('ctx'), c.req.param('id')), 201));
// Công khai: trang kiểm tra chứng nhận không cần đăng nhập.
learningRoutes.get('/courses/:id/certificate/:userId', async (c) => c.json(await courses.certificate(c.get('ctx'), c.req.param('id'), c.req.param('userId'))));
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
  // `lesson: true` là ô link video của bài học, nơi duy nhất nhận thêm tệp Google Drive.
  const { url, lesson } = await parse(z.object({ url: z.string(), lesson: z.boolean().optional() }), await body(c));
  const { parseLessonVideoUrl, parseVideoUrl } = await import('@hoiminh/contracts');
  return c.json({ embed: lesson ? parseLessonVideoUrl(url) : parseVideoUrl(url) });
});
// Nhận diện link và lấy tên, mô tả, thời lượng từ YouTube để điền sẵn bài học. Cần đăng nhập vì máy chủ phải gọi ra ngoài.
// Đường dẫn này nằm trong NO_DB_PATHS (middleware/auth.ts): không mở transaction database trong lúc chờ YouTube.
learningRoutes.post('/video/meta', requireAuth, async (c) => {
  const { url } = await parse(z.object({ url: z.string().max(2000) }), await body(c));
  const { env, log } = c.get('ctx');
  return c.json(await videoMeta.fetchVideoMeta(url, { apiKey: env.YOUTUBE_API_KEY, warn: (msg, data) => log.warn(msg, data) }));
});
