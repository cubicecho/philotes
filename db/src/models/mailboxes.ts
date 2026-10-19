import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.ts';

/** Where a mailbox's polling stands. */
export const MailboxStatus = {
  /** Polled on schedule. */
  Active: 'active',
  /** The last poll failed for a reason that may pass; the next waits longer. */
  Failing: 'failing',
  /** The login was refused, or the credential cannot be opened. Not polled until the user connects again. */
  NeedsReconnect: 'needs-reconnect',
} as const;
export type MailboxStatus = (typeof MailboxStatus)[keyof typeof MailboxStatus];

/** How far one folder of a mailbox has been read. */
export interface MailFolderCursor {
  /** The folder's UIDVALIDITY when the cursor was written. A new one means every UID was reassigned. */
  uidValidity: string;
  /** The highest UID logged. */
  lastUid: number;
}

/**
 * A user's connected mailbox, read over IMAP by the server's poller (server/src/mail/). One per user.
 * `credential` is the app password sealed with AES-256-GCM under a key from the environment; it is
 * never sent back out, which is why the table is not in the GraphQL schema.
 */
export const mailboxes = pgTable('mailboxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  /** The IMAP login. */
  username: text('username').notNull(),
  /** The user's own address, never matched to a person. Usually the login. */
  address: text('address').notNull(),
  /** `v1.<key id>.<iv>.<tag>.<ciphertext>`: see server/src/mail/credential.ts. */
  credential: text('credential').notNull(),
  status: text('status').$type<MailboxStatus>().notNull().default(MailboxStatus.Active),
  /** What went wrong last, for the Settings card. null while polls succeed. */
  lastError: text('last_error'),
  /** Polls failed in a row. The wait before the next grows with it. */
  failureCount: integer('failure_count').notNull().default(0),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  nextPollAt: timestamp('next_poll_at', { withTimezone: true }).notNull().defaultNow(),
  /** How far each folder has been read, by folder path. */
  cursors: jsonb('cursors').$type<Record<string, MailFolderCursor>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** A mailbox row as read. */
export type Mailbox = typeof mailboxes.$inferSelect;
/** A mailbox row as inserted. */
export type NewMailbox = typeof mailboxes.$inferInsert;
