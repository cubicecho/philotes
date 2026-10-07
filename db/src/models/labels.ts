import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.ts';

/** A user's own tag, with a colour, for people, notes, interactions and important dates. */
export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('idx_labels_user_id').on(t.userId)],
);

/** A label row as read. */
export type Label = typeof labels.$inferSelect;
/** A label row as inserted. */
export type NewLabel = typeof labels.$inferInsert;
