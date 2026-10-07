import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

/** The ways of reaching a person that a contact detail can hold. */
export const ContactType = {
  Email: 'email',
  Phone: 'phone',
  Mobile: 'mobile',
  Linkedin: 'linkedin',
  Twitter: 'twitter',
  Instagram: 'instagram',
  Website: 'website',
  Other: 'other',
} as const;
export type ContactType = (typeof ContactType)[keyof typeof ContactType];

/** The Postgres enum behind a contact detail's `type`. */
export const contactTypeEnum = pgEnum('contact_type', ContactType);

/** One way of reaching a person, as a user keeps it: an email, a phone number, a handle. */
export const contactInfos = pgTable(
  'contact_infos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: contactTypeEnum('type').notNull(),
    value: text('value').notNull(),
    label: text('label'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('idx_contact_infos_person_id').on(t.personId), index('idx_contact_infos_user_id').on(t.userId)],
);

/** A contact detail row as read. */
export type ContactInfo = typeof contactInfos.$inferSelect;
/** A contact detail row as inserted. */
export type NewContactInfo = typeof contactInfos.$inferInsert;
