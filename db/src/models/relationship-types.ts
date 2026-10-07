import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/** A name for a kind of relationship, kept per user. */
export const relationshipTypes = pgTable(
  'relationship_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('idx_relationship_types_user_id').on(t.userId)],
);

/** A relationship type row as read. */
export type RelationshipType = typeof relationshipTypes.$inferSelect;
/** A relationship type row as inserted. */
export type NewRelationshipType = typeof relationshipTypes.$inferInsert;
