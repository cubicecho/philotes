import { apiKeys, db, importantDates, persons } from '@philotes/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';
import { hashApiKey, isApiKey } from '../api-keys.ts';

export async function icalHandler(req: Request, res: Response): Promise<void> {
  const { key } = req.query;

  if (!key || typeof key !== 'string' || !isApiKey(key)) {
    res.status(400).send('Missing or invalid API key. Use ?key=phlt_...');
    return;
  }

  const hash = hashApiKey(key);
  const now = new Date();

  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 union type compat
  const anyDb = db as any;

  const [apiKey] = await anyDb
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!apiKey || (apiKey.expiresAt !== null && apiKey.expiresAt < now)) {
    res.status(401).send('Invalid or expired API key');
    return;
  }

  anyDb.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, apiKey.id)).catch(console.error);

  const rows = await anyDb
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
