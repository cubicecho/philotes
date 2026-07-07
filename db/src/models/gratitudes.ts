import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.js';
import { users } from './users.js';

export const gratitudes = pgTable(
  'gratitudes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_gratitudes_person_id').on(t.personId),
    index('idx_gratitudes_user_id').on(t.userId),
  ],
);

export type Gratitude = typeof gratitudes.$inferSelect;
export type NewGratitude = typeof gratitudes.$inferInsert;
