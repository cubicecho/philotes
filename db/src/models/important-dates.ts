import { date, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

// Recurrence values mirror Google Calendar's model.
// null = one-time event (only appears if the original date is upcoming).
// "yearly"  = repeats every year on the same month + day (e.g. birthdays).
// "monthly" = repeats every month on the same day-of-month.
// "weekly"  = repeats every week on the same day-of-week.
export const RECURRENCE_VALUES = ['yearly', 'monthly', 'weekly'] as const;
export type Recurrence = (typeof RECURRENCE_VALUES)[number];

export const MILESTONE_TYPES = [
  'new_job',
  'promotion',
  'moved',
  'new_baby',
  'married',
  'divorced',
  'retired',
  'health_event',
  'graduation',
  'loss',
  'other',
] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export const importantDates = pgTable(
  'important_dates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    date: date('date').notNull(),
    recurrence: text('recurrence').$type<Recurrence>(),
    milestoneType: text('milestone_type', {
      enum: [
        'new_job',
        'promotion',
        'moved',
        'new_baby',
        'married',
        'divorced',
        'retired',
        'health_event',
        'graduation',
        'loss',
        'other',
      ],
    }).$type<MilestoneType>(),
  },
  (t) => [
    index('idx_important_dates_person_id').on(t.personId),
    index('idx_important_dates_user_id').on(t.userId),
    index('idx_important_dates_date').on(t.date),
  ],
);

export const importantDateTags = pgTable(
  'important_date_tags',
  {
    importantDateId: uuid('important_date_id')
      .notNull()
      .references(() => importantDates.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.importantDateId, t.labelId] })],
);

export const importantDatePersons = pgTable(
  'important_date_persons',
  {
    importantDateId: uuid('important_date_id')
      .notNull()
      .references(() => importantDates.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.importantDateId, t.personId] }),
    index('idx_important_date_persons_person_id').on(t.personId),
  ],
);

export type ImportantDate = typeof importantDates.$inferSelect;
export type NewImportantDate = typeof importantDates.$inferInsert;
export type ImportantDateTag = typeof importantDateTags.$inferSelect;
export type NewImportantDateTag = typeof importantDateTags.$inferInsert;
export type ImportantDatePerson = typeof importantDatePersons.$inferSelect;
export type NewImportantDatePerson = typeof importantDatePersons.$inferInsert;
