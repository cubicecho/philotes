import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

/** Something a user means to do about a person. */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    /** null while open. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_tasks_person_id').on(t.personId),
    index('idx_tasks_user_id').on(t.userId),
    index('idx_tasks_due_at').on(t.dueAt),
  ],
);

/** A task row as read. */
export type Task = typeof tasks.$inferSelect;
/** A task row as inserted. */
export type NewTask = typeof tasks.$inferInsert;
