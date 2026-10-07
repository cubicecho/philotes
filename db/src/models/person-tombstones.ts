import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/**
 * What is left of a deleted person: enough for a client that had them to learn they are gone. A person
 * folded into another by a merge leaves one too.
 */
export const personTombstones = pgTable(
  'person_tombstones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The id the person had. Not a reference: the row it named is gone. */
    personId: uuid('person_id').notNull(),
    /** The id a synced address book knew the person by. */
    uid: text('uid').notNull(),
    /** The user's `personsRevision` when the person was deleted. */
    revision: bigint('revision', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_person_tombstones_user_id_uid').on(t.userId, t.uid),
    index('idx_person_tombstones_user_id_revision').on(t.userId, t.revision),
  ],
);

/** A tombstone row as read. */
export type PersonTombstone = typeof personTombstones.$inferSelect;
/** A tombstone row as inserted. */
export type NewPersonTombstone = typeof personTombstones.$inferInsert;
