// Cột dùng chung cho mọi bảng: id uuid, timestamps, tiền theo đơn vị nhỏ nhất.
import { bigint, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Khóa chính uuid sinh tự động. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** Cột thời gian có múi giờ. */
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** created_at + updated_at chuẩn. */
export const timestamps = () => ({
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** Số tiền theo đơn vị nhỏ nhất (đồng cho VND, cent cho USD). */
export const money = (name: string) => bigint(name, { mode: 'number' });
