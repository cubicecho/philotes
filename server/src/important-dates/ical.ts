import type { DB } from '@cubicecho/philotes-db';
import { importantDates, persons, Recurrence } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import type { Request, RequestHandler, Response } from 'express';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';
import { API_KEY_PREFIX, type Auth } from '../auth/better-auth.ts';
import { HttpStatus } from '../core/wire.ts';

/** How each recurrence is said in an iCal repeat rule. */
const REPEAT_FREQUENCIES: Record<Recurrence, ICalEventRepeatingFreq> = {
  [Recurrence.Yearly]: ICalEventRepeatingFreq.YEARLY,
  [Recurrence.Monthly]: ICalEventRepeatingFreq.MONTHLY,
  [Recurrence.Weekly]: ICalEventRepeatingFreq.WEEKLY,
};

/** What an event calls a person who has no name, nickname or organization. */
const UNNAMED_PERSON = 'Unknown';

/** What the feed is built from. */
export interface IcalDeps {
  /** Drizzle client. */
  db: DB;
  /** Verifies the API key. */
  auth: Auth;
}

/**
 * Writes the caller's important dates as an iCalendar feed. The caller is identified by the API
 * key in `?key=`, because a calendar client cannot send a header.
 *
 * @param deps - The database and the auth instance.
 * @param req - The request, with the API key in its query.
 * @param res - The response the feed is written to.
 * @returns Nothing.
 */
async function sendCalendar({ db, auth }: IcalDeps, req: Request, res: Response): Promise<void> {
  const { key } = req.query;

  const isApiKey = typeof key === 'string' && key.startsWith(API_KEY_PREFIX);
  if (isApiKey === false) {
    res.status(HttpStatus.BadRequest).send(`Missing or invalid API key. Use ?key=${API_KEY_PREFIX}...`);
    return;
  }

  // Also records the use, which is what the settings page shows as "last used".
  const { valid, key: verified } = await auth.api.verifyApiKey({ body: { key } });
  const isRefused = valid === false || verified === null;
  if (isRefused) {
    res.status(HttpStatus.Unauthorized).send('Invalid or expired API key');
    return;
  }

  const rows = await db
    .select({
      id: importantDates.id,
      name: importantDates.name,
      description: importantDates.description,
      date: importantDates.date,
      hasYear: importantDates.hasYear,
      recurrence: importantDates.recurrence,
      personName: persons.displayName,
    })
    .from(importantDates)
    .leftJoin(persons, eq(importantDates.personId, persons.id))
    .where(eq(importantDates.userId, verified.referenceId));

  const cal = ical({ name: 'Philotes – Important Dates' });

  for (const row of rows) {
    const personName = row.personName || UNNAMED_PERSON;

    // Parse as UTC midnight to keep the date stable across timezones
    const start = new Date(`${row.date}T00:00:00Z`);
    if (row.hasYear === false) {
      // The stored year is a placeholder. A calendar is given this year's, which a repeat rule carries on from.
      start.setUTCFullYear(new Date().getUTCFullYear());
    }

    const event = cal.createEvent({
      id: `importantdate-${row.id}@philotes`,
      start,
      summary: `${row.name} (${personName})`,
      allDay: true,
    });

    if (row.description) {
      event.description(row.description);
    }

    // A row written before recurrences were validated may hold a word outside the set. It does not repeat.
    const frequency = row.recurrence === null ? undefined : REPEAT_FREQUENCIES[row.recurrence];
    if (frequency !== undefined) {
      event.repeating({ freq: frequency });
    }
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="philotes-important-dates.ics"');
  res.send(cal.toString());
}

/**
 * Builds the `/ical` handler.
 *
 * @param deps - The database and the auth instance.
 * @returns The handler.
 */
export function createIcalHandler(deps: IcalDeps): RequestHandler {
  return (req, res) => sendCalendar(deps, req, res);
}
