import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

/** How an interaction took place. */
export const InteractionChannel = {
  Call: 'call',
  Text: 'text',
  Email: 'email',
  InPerson: 'in-person',
  Other: 'other',
} as const;
export type InteractionChannel = (typeof InteractionChannel)[keyof typeof InteractionChannel];

/** How an interaction felt. */
export const InteractionSentiment = {
  Great: 'great',
  Good: 'good',
  Neutral: 'neutral',
  Difficult: 'difficult',
} as const;
export type InteractionSentiment = (typeof InteractionSentiment)[keyof typeof InteractionSentiment];

/** Where an interaction came from: typed in, or read from the phone's call log, its texts or a mailbox. */
export const InteractionSource = {
  Manual: 'manual',
  CallLog: 'call-log',
  Sms: 'sms',
  Email: 'email',
} as const;
export type InteractionSource = (typeof InteractionSource)[keyof typeof InteractionSource];

/** Which way an interaction went. A missed call is a call that came in and was not answered. */
export const InteractionDirection = {
  Incoming: 'incoming',
  Outgoing: 'outgoing',
  Missed: 'missed',
} as const;
export type InteractionDirection = (typeof InteractionDirection)[keyof typeof InteractionDirection];

/** One time a user was in touch with a person. */
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    channel: text('channel').$type<InteractionChannel>().notNull(),
    sentiment: text('sentiment').$type<InteractionSentiment>(),
    note: text('note'),
    source: text('source').$type<InteractionSource>().notNull().default(InteractionSource.Manual),
    /** null when nobody said, as on most interactions typed in. */
    direction: text('direction').$type<InteractionDirection>(),
    /** How long a call lasted. null for anything that is not a call. */
    durationSeconds: integer('duration_seconds'),
    /**
     * What the source knows the event by: a call-log or SMS row's id and time, an email's Message-ID.
     * null on an interaction typed in. With the person, it is what keeps a rescan from logging an event twice.
     */
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_interactions_person_id').on(t.personId),
    index('idx_interactions_user_id').on(t.userId),
    index('idx_interactions_person_id_occurred_at').on(t.personId, t.occurredAt),
    // One row per event and person: an email to three people is three interactions, and a rescan none.
    // Interactions typed in carry no external id, and Postgres never counts two nulls as the same.
    uniqueIndex('uq_interactions_user_id_source_external_id_person_id').on(
      t.userId,
      t.source,
      t.externalId,
      t.personId,
    ),
  ],
);

/** Ties an interaction to a label. */
export const interactionTags = pgTable(
  'interaction_tags',
  {
    interactionId: uuid('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.interactionId, t.labelId] }),
    index('idx_interaction_tags_label_id').on(t.labelId),
    index('idx_interaction_tags_user_id').on(t.userId),
  ],
);

/** An interaction row as read. */
export type Interaction = typeof interactions.$inferSelect;
/** An interaction row as inserted. */
export type NewInteraction = typeof interactions.$inferInsert;
/** An interaction tag row as read. */
export type InteractionTag = typeof interactionTags.$inferSelect;
/** An interaction tag row as inserted. */
export type NewInteractionTag = typeof interactionTags.$inferInsert;
