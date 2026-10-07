import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { IMPORTANT_DATE_DEFAULTS, OPERATION_LIMIT_DEFAULTS } from '../core/defaults.ts';
import { DAYS_PER_WEEK, MS_PER_DAY } from '../core/wire.ts';
import { objectType } from '../graphql/object-type.ts';

const { defaultPageSize, maxPageSize } = OPERATION_LIMIT_DEFAULTS;

const { persons, importantDates, Recurrence } = dbSchema;
type Recurrence = dbSchema.Recurrence;

interface UpcomingDatesArgs {
  limit?: number | null;
  offset?: number | null;
  lookaheadDays?: number | null;
}

interface UpcomingDateEntry {
  id: string;
  name: string;
  description: string | null;
  date: string;
  recurrence: Recurrence | null;
  daysUntil: number;
  nextDate: string;
  personId: string;
  personFirstName: string;
  personLastName: string;
}

const upcomingDatesExtensionSDL = parse(`
  type UpcomingDateEntry {
    id: String!
    name: String!
    description: String
    date: String!
    recurrence: String
    daysUntil: Int!
    nextDate: String!
    personId: String!
    personFirstName: String!
    personLastName: String!
  }

  extend type Query {
    upcomingDates(limit: Int, offset: Int, lookaheadDays: Int): [UpcomingDateEntry!]!
  }
`);

/**
 * Reads today's date in the server's time zone.
 *
 * @returns Midnight at the start of today, local time.
 */
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Counts the days from one midnight to another.
 *
 * @param a - The midnight counted from.
 * @param b - The midnight counted to.
 * @returns Whole days from `a` to `b`, negative when `b` comes first.
 */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Formats a date in the server's time zone.
 *
 * @param d - The date.
 * @returns The date as `YYYY-MM-DD`.
 */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Finds when a date next falls, counting from today in the server's time zone.
 *
 * @param dateStr - The stored date, as `YYYY-MM-DD`.
 * @param recurrence - How the date repeats, or null for a one-time date.
 * @returns The next occurrence and the days until it, 0 for today. null for a one-time date that has passed,
 * or a recurrence outside the vocabulary.
 */
function computeNextOccurrence(
  dateStr: string,
  recurrence: Recurrence | null,
): { daysUntil: number; nextDate: Date } | null {
  const t = todayMidnight();
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const storedYear = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed for Date constructor
  const day = Number(dayStr);

  if (!recurrence) {
    const stored = new Date(storedYear, month, day);
    const daysUntil = daysBetween(t, stored);
    const hasPassed = daysUntil < 0;
    if (hasPassed) {
      return null;
    }
    return { daysUntil, nextDate: stored };
  }

  if (recurrence === Recurrence.Yearly) {
    const thisYear = new Date(t.getFullYear(), month, day);
    const diff = daysBetween(t, thisYear);
    const isStillAhead = diff >= 0;
    if (isStillAhead) {
      return { daysUntil: diff, nextDate: thisYear };
    }
    const nextYear = new Date(t.getFullYear() + 1, month, day);
    return { daysUntil: daysBetween(t, nextYear), nextDate: nextYear };
  }

  if (recurrence === Recurrence.Monthly) {
    const thisMonth = new Date(t.getFullYear(), t.getMonth(), day);
    const diff = daysBetween(t, thisMonth);
    const isStillAhead = diff >= 0;
    if (isStillAhead) {
      return { daysUntil: diff, nextDate: thisMonth };
    }
    const nextMonth = new Date(t.getFullYear(), t.getMonth() + 1, day);
    return { daysUntil: daysBetween(t, nextMonth), nextDate: nextMonth };
  }

  if (recurrence === Recurrence.Weekly) {
    const storedDate = new Date(storedYear, month, day);
    const targetDow = storedDate.getDay(); // 0 = Sun
    const todayDow = t.getDay();
    const daysAhead = (targetDow - todayDow + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    const next = new Date(t);
    next.setDate(t.getDate() + daysAhead);
    return { daysUntil: daysAhead, nextDate: next };
  }

  return null;
}

/**
 * Adds `upcomingDates` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the upcoming dates query.
 */
export function applyUpcomingDatesExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, upcomingDatesExtensionSDL);

  const queryType = objectType(extendedSchema, 'Query');

  const upcomingDatesField = queryType.getFields().upcomingDates;
  /**
   * Resolves `Query.upcomingDates`. Lists the caller's important dates that next fall within the lookahead,
   * soonest first. An anonymous caller gets an empty list, not an error.
   *
   * @param _parent - Unused.
   * @param [args.limit] - Most entries to return, capped at the largest page size.
   * @param [args.offset] - Entries to pass over first.
   * @param [args.lookaheadDays] - How many days ahead to look, counting today as day 0.
   * @param context - Request context.
   * @returns The entries, each with its next date and the days until it.
   */
  upcomingDatesField.resolve = async (_parent: unknown, args: UpcomingDatesArgs, context: Context) => {
    if (!context.userId) {
      return [];
    }
    const lookaheadDays = args.lookaheadDays ?? IMPORTANT_DATE_DEFAULTS.lookaheadDays;
    const offset = args.offset ?? 0;

    const dbCtx = context.db;

    const rows = await dbCtx
      .select({
        id: importantDates.id,
        name: importantDates.name,
        description: importantDates.description,
        date: importantDates.date,
        recurrence: importantDates.recurrence,
        personId: persons.id,
        personFirstName: persons.firstName,
        personLastName: persons.lastName,
      })
      .from(importantDates)
      .innerJoin(persons, eq(importantDates.personId, persons.id))
      .where(eq(importantDates.userId, context.userId));

    const entries: UpcomingDateEntry[] = rows.flatMap((row) => {
      const occurrence = computeNextOccurrence(row.date, row.recurrence);
      if (occurrence === null) {
        return [];
      }
      const isBeyondLookahead = occurrence.daysUntil > lookaheadDays;
      if (isBeyondLookahead) {
        return [];
      }
      return [
        {
          id: row.id,
          name: row.name,
          description: row.description,
          date: row.date,
          recurrence: row.recurrence,
          daysUntil: occurrence.daysUntil,
          nextDate: toLocalDateString(occurrence.nextDate),
          personId: row.personId,
          personFirstName: row.personFirstName,
          personLastName: row.personLastName,
        },
      ];
    });

    entries.sort((a, b) => a.daysUntil - b.daysUntil);

    // Hand-written lists don't inherit drizzle-graphql's page size, so this one applies the same two bounds.
    const pageSize = Math.min(args.limit ?? defaultPageSize, maxPageSize);
    return entries.slice(offset, offset + pageSize);
  };
  // The cost hint the generated lists carry: a page of rows, each priced by its selection.
  upcomingDatesField.extensions = {
    ...upcomingDatesField.extensions,
    complexity: ({ args, childComplexity }: { args: UpcomingDatesArgs; childComplexity: number }) =>
      Math.min(args.limit ?? defaultPageSize, maxPageSize) * childComplexity,
  };

  return extendedSchema;
}
