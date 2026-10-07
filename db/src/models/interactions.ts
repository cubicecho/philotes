import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
  ],
);

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

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type InteractionTag = typeof interactionTags.$inferSelect;
export type NewInteractionTag = typeof interactionTags.$inferInsert;
