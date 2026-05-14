import { date, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

export const CONTACT_FREQUENCY_VALUES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type ContactFrequency = (typeof CONTACT_FREQUENCY_VALUES)[number];

export const userPersons = pgTable(
  'user_persons',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    contactFrequency: text('contact_frequency').$type<ContactFrequency>(),
    howWeMet: text('how_we_met'),
    firstMetDate: date('first_met_date'),
    avatarPath: text('avatar_path'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.personId] }),
    index('idx_user_persons_user_id').on(t.userId),
    index('idx_user_persons_person_id').on(t.personId),
  ],
);

export type UserPerson = typeof userPersons.$inferSelect;
export type NewUserPerson = typeof userPersons.$inferInsert;
