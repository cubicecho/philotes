import { type SQL, sql } from 'drizzle-orm';
import { bigint, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/** How often a user means to be in touch with a person. */
export const ContactFrequency = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
} as const;
export type ContactFrequency = (typeof ContactFrequency)[keyof typeof ContactFrequency];

/** The given and family name, in the order they are read. Empty when the person has neither. */
const FULL_NAME_SQL = `btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))`;
/** The family and given name, in the order a list is sorted by. */
const FAMILY_FIRST_SQL = `btrim(coalesce(last_name, '') || ' ' || coalesce(first_name, ''))`;
/** What stands in for a missing name. */
const NAME_FALLBACK_SQL = `nullif(btrim(nickname), ''), nullif(btrim(organization), ''), ''`;
const DISPLAY_NAME_SQL = `coalesce(nullif(${FULL_NAME_SQL}, ''), ${NAME_FALLBACK_SQL})`;
const SORT_NAME_SQL = `lower(coalesce(nullif(${FAMILY_FIRST_SQL}, ''), ${NAME_FALLBACK_SQL}))`;

/** The revision of a person no change has been counted for yet. */
export const UNREVISED = 0;

/** A person in one user's contacts. Two users who know the same person each hold their own row. */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    namePrefix: text('name_prefix'),
    /** null for a person known only by a nickname or an organization. */
    firstName: text('first_name'),
    middleName: text('middle_name'),
    lastName: text('last_name'),
    nameSuffix: text('name_suffix'),
    nickname: text('nickname'),
    organization: text('organization'),
    jobTitle: text('job_title'),
    department: text('department'),
    /** What a phone's contact card calls the note. A user's Philotes notes are kept apart from it. */
    about: text('about'),
    /** What the person is called in a list: the name, else the nickname, else the organization. Empty when none is set. */
    displayName: text('display_name')
      .notNull()
      .generatedAlwaysAs((): SQL => sql.raw(DISPLAY_NAME_SQL)),
    /** What a list of people is ordered by: family name first, in lower case. */
    sortName: text('sort_name')
      .notNull()
      .generatedAlwaysAs((): SQL => sql.raw(SORT_NAME_SQL)),
    /** The person's id in a synced address book (the vCard UID). A phone that creates the person supplies its own. */
    uid: text('uid').notNull().default(sql`gen_random_uuid()::text`),
    /** The lines of a synced contact card that no column holds, kept so a phone gets them back unchanged. */
    vcardExtra: text('vcard_extra'),
    /**
     * The user's `personsRevision` when this person, or a detail a contact card carries, last changed.
     * 0 only until the write that made the row has finished.
     */
    revision: bigint('revision', { mode: 'number' }).notNull().default(UNREVISED),
    contactFrequency: text('contact_frequency').$type<ContactFrequency>(),
    howWeMet: text('how_we_met'),
    firstMetDate: date('first_met_date'),
    /** The stored path of the person's picture, `/avatars/<file>`. null when there is none. */
    avatarPath: text('avatar_path'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_persons_user_id').on(t.userId),
    index('idx_persons_user_id_sort_name').on(t.userId, t.sortName),
    index('idx_persons_user_id_revision').on(t.userId, t.revision),
    uniqueIndex('uq_persons_user_id_uid').on(t.userId, t.uid),
  ],
);

/** A person row as read. */
export type Person = typeof persons.$inferSelect;
/** A person row as inserted. */
export type NewPerson = typeof persons.$inferInsert;
