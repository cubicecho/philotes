import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

export const personLabels = pgTable(
  'person_labels',
  {
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.labelId, t.userId] }),
    index('idx_person_labels_label_id').on(t.labelId),
    index('idx_person_labels_user_id').on(t.userId),
  ],
);

export type PersonLabel = typeof personLabels.$inferSelect;
export type NewPersonLabel = typeof personLabels.$inferInsert;
