import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

export const INTERACTION_CHANNELS = ['call', 'text', 'email', 'in-person', 'other'] as const;
export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];

export const INTERACTION_SENTIMENTS = ['great', 'good', 'neutral', 'difficult'] as const;
export type InteractionSentiment = (typeof INTERACTION_SENTIMENTS)[number];

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
  },
  (t) => [primaryKey({ columns: [t.interactionId, t.labelId] })],
);

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type InteractionTag = typeof interactionTags.$inferSelect;
export type NewInteractionTag = typeof interactionTags.$inferInsert;
