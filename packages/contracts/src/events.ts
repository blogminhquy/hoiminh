// Hợp đồng sự kiện: tạo, lặp, đăng ký, câu hỏi gửi trước, bản ghi.
import { z } from 'zod';
import { idSchema } from './common';

export const eventKindSchema = z.enum(['online', 'offline', 'hybrid']);
export const eventAccessSchema = z.enum(['all_members', 'premium', 'public']);
export const recurrenceSchema = z.enum(['none', 'weekly', 'monthly']);

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  descriptionMd: z.string().max(10_000).default(''),
  coverColor: z.string().max(16).optional(),
  seriesId: idSchema.nullable().optional(),
  seriesTitle: z.string().max(120).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  recurrence: recurrenceSchema.default('none'),
  occurrences: z.number().int().min(1).max(52).default(8),
  kind: eventKindSchema.default('online'),
  meetingUrl: z.string().url().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  hostUserIds: z.array(idSchema).max(5).default([]),
  capacity: z.number().int().positive().nullable().optional(),
  access: eventAccessSchema.default('all_members'),
  allowQuestions: z.boolean().default(true),
  autoPublishRecording: z.boolean().default(true),
  reminders: z.array(z.enum(['1d', '1h', 'start', '15m'])).default(['1d', '1h', 'start']),
  announceOnFeed: z.boolean().default(true),
  broadcastEmail: z.boolean().default(false),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;
export const updateEventSchema = createEventSchema.partial();

export const eventQuestionSchema = z.object({ question: z.string().trim().min(3).max(500) });
export const eventRecordingSchema = z.object({
  videoUrl: z.string().url(),
  title: z.string().max(120).optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export const eventsQuerySchema = z.object({
  filter: z.enum(['upcoming', 'mine', 'past']).default('upcoming'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
