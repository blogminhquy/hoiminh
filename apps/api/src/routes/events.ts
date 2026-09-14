// Sự kiện: danh sách, tạo, chi tiết, đăng ký, câu hỏi gửi trước, bản ghi.
import { createEventSchema, eventQuestionSchema, eventRecordingSchema, eventsQuerySchema, updateEventSchema } from '@hoiminh/contracts';
import { events } from '@hoiminh/core';
import { body, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const eventRoutes = router();

eventRoutes.get('/communities/:id/events', async (c) => {
  const q = await parse(eventsQuerySchema, query(c));
  return c.json(await events.listEvents(c.get('ctx'), c.req.param('id'), { filter: q.filter, limit: q.limit, month: query(c).month }));
});
eventRoutes.post('/communities/:id/events', requireAuth, async (c) => c.json(await events.createEvent(c.get('ctx'), c.req.param('id'), await parse(createEventSchema, await body(c))), 201));
eventRoutes.get('/communities/:id/recordings', async (c) => c.json(await events.listRecordings(c.get('ctx'), c.req.param('id'))));
eventRoutes.get('/events/:id', async (c) => c.json(await events.getEvent(c.get('ctx'), c.req.param('id'))));
eventRoutes.patch('/events/:id', requireAuth, async (c) => c.json(await events.updateEvent(c.get('ctx'), c.req.param('id'), await parse(updateEventSchema, await body(c)))));
eventRoutes.post('/events/:id/register', requireAuth, async (c) => c.json(await events.registerEvent(c.get('ctx'), c.req.param('id'), true)));
eventRoutes.delete('/events/:id/register', requireAuth, async (c) => c.json(await events.registerEvent(c.get('ctx'), c.req.param('id'), false)));
eventRoutes.post('/events/:id/questions', requireAuth, async (c) => {
  const { question } = await parse(eventQuestionSchema, await body(c));
  return c.json(await events.askQuestion(c.get('ctx'), c.req.param('id'), question), 201);
});
eventRoutes.post('/event-questions/:id/vote', requireAuth, async (c) => c.json(await events.voteQuestion(c.get('ctx'), c.req.param('id'))));
eventRoutes.post('/events/:id/recordings', requireAuth, async (c) => c.json(await events.addRecording(c.get('ctx'), c.req.param('id'), await parse(eventRecordingSchema, await body(c))), 201));
eventRoutes.get('/events/:id/attendees', requireAuth, async (c) => c.json(await events.eventAttendees(c.get('ctx'), c.req.param('id'))));
