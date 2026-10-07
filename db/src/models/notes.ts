import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

/** A note a user wrote. It outlives its person: deleting the person clears `personId`. */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    body: text('body').notNull(),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('idx_notes_person_id').on(t.personId), index('idx_notes_user_id').on(t.userId)],
);

/** Ties a note to a label. */
export const noteTags = pgTable(
  'note_tags',
  {
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.labelId] }),
    index('idx_note_tags_label_id').on(t.labelId),
    index('idx_note_tags_user_id').on(t.userId),
  ],
);

/** Ties a note to a person it mentions. */
export const noteMentions = pgTable(
  'note_mentions',
  {
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    mentionedPersonId: uuid('mentioned_person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.mentionedPersonId] }),
    index('idx_note_mentions_mentioned_person_id').on(t.mentionedPersonId),
    index('idx_note_mentions_user_id').on(t.userId),
  ],
);

/** A note row as read. */
export type Note = typeof notes.$inferSelect;
/** A note row as inserted. */
export type NewNote = typeof notes.$inferInsert;
/** A note tag row as read. */
export type NoteTag = typeof noteTags.$inferSelect;
/** A note tag row as inserted. */
export type NewNoteTag = typeof noteTags.$inferInsert;
/** A note mention row as read. */
export type NoteMention = typeof noteMentions.$inferSelect;
/** A note mention row as inserted. */
export type NewNoteMention = typeof noteMentions.$inferInsert;
