import { date, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

/** How often a user means to be in touch with a person. */
export const ContactFrequency = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
} as const;
export type ContactFrequency = (typeof ContactFrequency)[keyof typeof ContactFrequency];

/** Puts a person in a user's contacts, and holds what that user alone keeps about them. */
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
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.personId] }),
    index('idx_user_persons_user_id').on(t.userId),
    index('idx_user_persons_person_id').on(t.personId),
  ],
);

/** A user-person link row as read. */
export type UserPerson = typeof userPersons.$inferSelect;
/** A user-person link row as inserted. */
export type NewUserPerson = typeof userPersons.$inferInsert;
