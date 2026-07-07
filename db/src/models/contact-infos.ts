import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

export const CONTACT_TYPE_VALUES = [
  'email',
  'phone',
  'mobile',
  'linkedin',
  'twitter',
  'instagram',
  'website',
  'other',
] as const;
export type ContactTypeValue = (typeof CONTACT_TYPE_VALUES)[number];

export const contactTypeEnum = pgEnum('contact_type', CONTACT_TYPE_VALUES);

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
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_contact_infos_person_id').on(t.personId), index('idx_contact_infos_user_id').on(t.userId)],
);

export type ContactInfo = typeof contactInfos.$inferSelect;
export type NewContactInfo = typeof contactInfos.$inferInsert;
