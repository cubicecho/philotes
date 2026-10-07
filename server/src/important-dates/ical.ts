import type { DB } from '@philotes/db';
import { apiKeys } from '@philotes/db/api-keys';
import { importantDates, persons } from '@philotes/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request, RequestHandler, Response } from 'express';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';
import { hashApiKey, isApiKey } from '../api-keys/tokens.ts';

/**
 * Writes the caller's important dates as an iCalendar feed. The caller is identified by the API
 * key in `?key=`, because a calendar client cannot send a header.
 *
 * @param db - Drizzle client.
 * @param req - The request, with the API key in its query.
 * @param res - The response the feed is written to.
 * @returns Nothing.
 */
async function sendCalendar(db: DB, req: Request, res: Response): Promise<void> {
  const { key } = req.query;

  if (!key || typeof key !== 'string' || isApiKey(key) === false) {
    res.status(400).send('Missing or invalid API key. Use ?key=phlt_...');
    return;
  }

  const hash = hashApiKey(key);
  const now = new Date();

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!apiKey || (apiKey.expiresAt !== null && apiKey.expiresAt < now)) {
    res.status(401).send('Invalid or expired API key');
    return;
  }

  db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, apiKey.id)).catch(console.error);

  const rows = await db
    .select({
      id: importantDates.id,
      name: importantDates.name,
      description: importantDates.description,
      date: importantDates.date,
      recurrence: importantDates.recurrence,
      personFirstName: persons.firstName,
      personLastName: persons.lastName,
    })
    .from(importantDates)
    .leftJoin(persons, eq(importantDates.personId, persons.id))
    .where(eq(importantDates.userId, apiKey.userId));

  const cal = ical({ name: 'Philotes – Important Dates' });

  for (const row of rows) {
    const personName = [row.personFirstName, row.personLastName].filter(Boolean).join(' ') || 'Unknown';

    // Parse as UTC midnight to keep the date stable across timezones
    const start = new Date(`${row.date}T00:00:00Z`);

    const event = cal.createEvent({
      id: `importantdate-${row.id}@philotes`,
      start,
      summary: `${row.name} (${personName})`,
      allDay: true,
    });

    if (row.description) {
      event.description(row.description);
    }

    if (row.recurrence === 'yearly') {
      event.repeating({ freq: ICalEventRepeatingFreq.YEARLY });
    } else if (row.recurrence === 'monthly') {
      event.repeating({ freq: ICalEventRepeatingFreq.MONTHLY });
    } else if (row.recurrence === 'weekly') {
      event.repeating({ freq: ICalEventRepeatingFreq.WEEKLY });
    }
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="philotes-important-dates.ics"');
  res.send(cal.toString());
}

/**
 * Builds the `/ical` handler over one database.
 *
 * @param db - Drizzle client.
 * @returns The handler.
 */
export function createIcalHandler(db: DB): RequestHandler {
  return (req, res) => sendCalendar(db, req, res);
}
