import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.ts';

export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').notNull(),
    label: text('label').notNull(),
  },
  (t) => [index('idx_labels_user_id').on(t.userId)],
);

export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
