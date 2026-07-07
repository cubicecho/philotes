import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

export const ADDRESS_TYPE_VALUES = ['home', 'work', 'other'] as const;
export type AddressTypeValue = (typeof ADDRESS_TYPE_VALUES)[number];

export const addressTypeEnum = pgEnum('address_type', ADDRESS_TYPE_VALUES);

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: addressTypeEnum('type').notNull(),
    label: text('label'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').default('US'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_addresses_person_id').on(t.personId), index('idx_addresses_user_id').on(t.userId)],
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
