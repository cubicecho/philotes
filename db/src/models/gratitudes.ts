import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

/** Something a user appreciates about a person. It goes when the person does. */
export const gratitudes = pgTable(
  'gratitudes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('idx_gratitudes_person_id').on(t.personId), index('idx_gratitudes_user_id').on(t.userId)],
);

/** A gratitude row as read. */
export type Gratitude = typeof gratitudes.$inferSelect;
/** A gratitude row as inserted. */
export type NewGratitude = typeof gratitudes.$inferInsert;
