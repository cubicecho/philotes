import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

/** The ways of reaching a person that a contact detail can hold. */
export const ContactType = {
  Email: 'email',
  Phone: 'phone',
  Fax: 'fax',
  Im: 'im',
  Linkedin: 'linkedin',
  Twitter: 'twitter',
  Instagram: 'instagram',
  Website: 'website',
  Other: 'other',
} as const;
export type ContactType = (typeof ContactType)[keyof typeof ContactType];

/** Where a contact detail reaches the person, as a phone's contact card sorts them. */
export const ContactKind = { Home: 'home', Work: 'work', Mobile: 'mobile', Other: 'other' } as const;
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];

/** The members of {@link ContactKind}, in the tuple form a `text` column's `enum` takes. */
const CONTACT_KINDS = [ContactKind.Home, ContactKind.Work, ContactKind.Mobile, ContactKind.Other] as const;

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
    /** null when the user has not said. */
    kind: text('kind', { enum: CONTACT_KINDS }).$type<ContactKind>(),
    /**
     * The value in the one form two spellings of it share: E.164 for a phone or fax, lower case for
     * the rest. The server derives it; it is what a caller's number is matched on.
     */
    normalizedValue: text('normalized_value').notNull(),
    label: text('label'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_contact_infos_person_id').on(t.personId),
    index('idx_contact_infos_user_id').on(t.userId),
    index('idx_contact_infos_user_id_normalized_value').on(t.userId, t.normalizedValue),
  ],
);

/** A contact detail row as read. */
export type ContactInfo = typeof contactInfos.$inferSelect;
/** A contact detail row as inserted. */
export type NewContactInfo = typeof contactInfos.$inferInsert;
