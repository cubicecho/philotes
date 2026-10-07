import * as dbSchema from '@philotes/db/schema';
import { eq } from 'drizzle-orm';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';

const { persons, importantDates } = dbSchema;

interface UpcomingDatesArgs {
  limit?: number | null;
  offset?: number | null;
  lookaheadDays?: number | null;
}

interface ImportantDateRow {
  id: string;
  name: string;
  description: string | null;
  date: string;
  recurrence: string | null;
  personId: string;
  personFirstName: string;
  personLastName: string;
}

interface UpcomingDateEntry {
  id: string;
  name: string;
  description: string | null;
  date: string;
  recurrence: string | null;
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

/** Return today at midnight in local time. */
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Days between two midnight-normalised dates (can be negative). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a Date as YYYY-MM-DD in local time.
 */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compute days until next occurrence and the next occurrence date.
 * Returns null when the event is one-time and has already passed.
 */
function computeNextOccurrence(
  dateStr: string,
  recurrence: string | null,
): { daysUntil: number; nextDate: Date } | null {
  const t = todayMidnight();
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const storedYear = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed for Date constructor
  const day = Number(dayStr);

  if (!recurrence) {
    const stored = new Date(storedYear, month, day);
    const daysUntil = daysBetween(t, stored);
    if (daysUntil < 0) {
      return null;
    }
    return { daysUntil, nextDate: stored };
  }

  if (recurrence === 'yearly') {
    const thisYear = new Date(t.getFullYear(), month, day);
    const diff = daysBetween(t, thisYear);
    if (diff >= 0) {
      return { daysUntil: diff, nextDate: thisYear };
    }
    const nextYear = new Date(t.getFullYear() + 1, month, day);
    return { daysUntil: daysBetween(t, nextYear), nextDate: nextYear };
  }

  if (recurrence === 'monthly') {
    const thisMonth = new Date(t.getFullYear(), t.getMonth(), day);
    const diff = daysBetween(t, thisMonth);
    if (diff >= 0) {
      return { daysUntil: diff, nextDate: thisMonth };
    }
    const nextMonth = new Date(t.getFullYear(), t.getMonth() + 1, day);
    return { daysUntil: daysBetween(t, nextMonth), nextDate: nextMonth };
  }

  if (recurrence === 'weekly') {
    const storedDate = new Date(storedYear, month, day);
    const targetDow = storedDate.getDay(); // 0 = Sun
    const todayDow = t.getDay();
    const daysAhead = (targetDow - todayDow + 7) % 7;
    const next = new Date(t);
    next.setDate(t.getDate() + daysAhead);
    return { daysUntil: daysAhead, nextDate: next };
  }

  return null;
}

export function applyUpcomingDatesExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, upcomingDatesExtensionSDL);

  const queryType = extendedSchema.getType('Query') as GraphQLObjectType;

  queryType.getFields().upcomingDates.resolve = async (_parent: unknown, args: UpcomingDatesArgs, context: Context) => {
    if (!context.userId) {
      return [];
    }
    const lookaheadDays = args.lookaheadDays ?? 30;
    const offset = args.offset ?? 0;

    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const dbCtx = context.db as any;

    const rows: ImportantDateRow[] = await dbCtx
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
      if (occurrence === null || occurrence.daysUntil > lookaheadDays) {
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

    const paginated = entries.slice(offset);
    return args.limit != null ? paginated.slice(0, args.limit) : paginated;
  };

  return extendedSchema;
}
