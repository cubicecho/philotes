import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons.ts';
import { users } from './users.ts';

export const personRelationships = pgTable(
  'person_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromPersonId: uuid('from_person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    toPersonId: uuid('to_person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
  },
  (t) => [
    index('idx_person_relationships_from_person_id').on(t.fromPersonId),
    index('idx_person_relationships_to_person_id').on(t.toPersonId),
    index('idx_person_relationships_user_id').on(t.userId),
  ],
);

export type PersonRelationship = typeof personRelationships.$inferSelect;
export type NewPersonRelationship = typeof personRelationships.$inferInsert;
