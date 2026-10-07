import { boolean, date, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { labels } from './labels.ts';
import { persons } from './persons.ts';
import { users } from './users.ts';

/** How a date repeats: on the same month and day, day of the month, or weekday. A null recurrence is a one-time date. */
export const Recurrence = { Yearly: 'yearly', Monthly: 'monthly', Weekly: 'weekly' } as const;
export type Recurrence = (typeof Recurrence)[keyof typeof Recurrence];

/** The life events an important date can mark. */
export const MilestoneType = {
  NewJob: 'new_job',
  Promotion: 'promotion',
  Moved: 'moved',
  NewBaby: 'new_baby',
  Married: 'married',
  Divorced: 'divorced',
  Retired: 'retired',
  HealthEvent: 'health_event',
  Graduation: 'graduation',
  Loss: 'loss',
  Other: 'other',
} as const;
export type MilestoneType = (typeof MilestoneType)[keyof typeof MilestoneType];

/** What an important date is, as a phone's contact card tells them apart. */
export const ImportantDateKind = { Birthday: 'birthday', Anniversary: 'anniversary', Other: 'other' } as const;
export type ImportantDateKind = (typeof ImportantDateKind)[keyof typeof ImportantDateKind];

/** The year a date is stored under when its own is not known. A leap year, so 29 February fits. */
export const YEARLESS_DATE_YEAR = 1604;

/**
 * Lists a vocabulary's members in the non-empty tuple form a `text` column's `enum` takes.
 *
 * @typeParam T - The vocabulary's union.
 * @param vocabulary - An `as const` vocabulary object.
 * @returns Its members, in the order they are written.
 * @throws An error when the vocabulary has no members.
 */
function membersOf<T extends string>(vocabulary: Readonly<Record<string, T>>): [T, ...T[]] {
  const [first, ...rest] = Object.values(vocabulary);
  if (first === undefined) {
    throw new Error('A vocabulary needs at least one member.');
  }
  return [first, ...rest];
}

/** A date a user keeps for a person, such as a birthday. A null recurrence is a one-time date. */
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
    kind: text('kind', { enum: membersOf(ImportantDateKind) })
      .$type<ImportantDateKind>()
      .notNull()
      .default(ImportantDateKind.Other),
    date: date('date').notNull(),
    /** false when only the month and day are known. The date is then stored under {@link YEARLESS_DATE_YEAR}. */
    hasYear: boolean('has_year').notNull().default(true),
    recurrence: text('recurrence').$type<Recurrence>(),
    milestoneType: text('milestone_type', { enum: membersOf(MilestoneType) }).$type<MilestoneType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_important_dates_person_id').on(t.personId),
    index('idx_important_dates_user_id').on(t.userId),
    index('idx_important_dates_date').on(t.date),
  ],
);

/** Ties an important date to a label. */
export const importantDateTags = pgTable(
  'important_date_tags',
  {
    importantDateId: uuid('important_date_id')
      .notNull()
      .references(() => importantDates.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.importantDateId, t.labelId] }),
    index('idx_important_date_tags_label_id').on(t.labelId),
    index('idx_important_date_tags_user_id').on(t.userId),
  ],
);

/** Ties an important date to another person it involves, such as the spouse on an anniversary. */
export const importantDatePersons = pgTable(
  'important_date_persons',
  {
    importantDateId: uuid('important_date_id')
      .notNull()
      .references(() => importantDates.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.importantDateId, t.personId] }),
    index('idx_important_date_persons_person_id').on(t.personId),
    index('idx_important_date_persons_user_id').on(t.userId),
  ],
);

/** An important date row as read. */
export type ImportantDate = typeof importantDates.$inferSelect;
/** An important date row as inserted. */
export type NewImportantDate = typeof importantDates.$inferInsert;
/** An important date tag row as read. */
export type ImportantDateTag = typeof importantDateTags.$inferSelect;
/** An important date tag row as inserted. */
export type NewImportantDateTag = typeof importantDateTags.$inferInsert;
/** An important date person row as read. */
export type ImportantDatePerson = typeof importantDatePersons.$inferSelect;
/** An important date person row as inserted. */
export type NewImportantDatePerson = typeof importantDatePersons.$inferInsert;
