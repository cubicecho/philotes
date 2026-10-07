// RFC 5545 calendar export. The `GetAllEventsForExport` query in export-calendar-card.tsx must select
// every field these shapes name. Dates arrive as `Date` objects, made by the Apollo cache's scalar policies.

import { CALENDAR_EXPORT_DEFAULTS } from '@/lib/defaults';
import { localIsoDate } from '@/lib/local-date';
import { MS_PER_MINUTE } from '@/lib/time';
import { Recurrence } from '@/lib/vocabulary';

/** The person an exported event is about. */
export interface CalendarPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
}

/** An interaction, as the calendar export reads it. */
export interface CalendarInteraction {
  id: string;
  channel: string;
  occurredAt: Date;
  note?: string | null;
  person?: CalendarPerson | null;
}

/** An important date, as the calendar export reads it. */
export interface CalendarImportantDate {
  id: string;
  name: string;
  description?: string | null;
  /** Local midnight of the calendar day. */
  date: Date;
  recurrence?: string | null;
  milestoneType?: string | null;
  person?: CalendarPerson | null;
}

/** Everything one calendar file holds. */
export interface CalendarEventsData {
  interactions: CalendarInteraction[];
  importantDates: CalendarImportantDate[];
}

/**
 * Writes the name an event shows for its person.
 *
 * @param [person] - The person, when the event has one.
 * @returns First and last name, or "Unknown" when there is no person.
 */
function buildCalendarPersonName(person?: CalendarPerson | null): string {
  if (!person) {
    return 'Unknown';
  }
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

/**
 * Writes a moment as an iCalendar DATE-TIME in UTC.
 *
 * @param date - The moment.
 * @returns The form `YYYYMMDDTHHMMSSZ`.
 */
function formatIcsDateTime(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Writes a day as an iCalendar DATE, the form an all-day event takes.
 *
 * @param date - Local midnight of the day.
 * @returns The form `YYYYMMDD`.
 */
function formatIcsDateOnly(date: Date): string {
  return localIsoDate(date).replace(/-/g, '');
}

/**
 * Escapes text for an iCalendar property value.
 *
 * @param text - The text as the user wrote it.
 * @returns The text with backslashes, semicolons, commas and newlines escaped.
 */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Builds the VEVENT for an interaction. It lasts `interactionMinutes`, since no length is recorded.
 *
 * @param interaction - The interaction to write.
 * @param now - The export's time as an iCalendar DATE-TIME, for DTSTAMP.
 * @returns The event's lines, joined by CRLF.
 */
function buildInteractionEvent(interaction: CalendarInteraction, now: string): string {
  const personName = buildCalendarPersonName(interaction.person);
  const summary = escapeIcsText(
    `${interaction.channel.charAt(0).toUpperCase()}${interaction.channel.slice(1)} with ${personName}`,
  );
  const dtStart = formatIcsDateTime(interaction.occurredAt);
  const dtEnd = formatIcsDateTime(
    new Date(interaction.occurredAt.getTime() + CALENDAR_EXPORT_DEFAULTS.interactionMinutes * MS_PER_MINUTE),
  );
  const lines = [
    'BEGIN:VEVENT',
    `UID:interaction-${interaction.id}@philotes`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];
  if (interaction.note) {
    lines.push(`DESCRIPTION:${escapeIcsText(interaction.note)}`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/** The iCalendar frequency each recurrence repeats at. */
const RRULE_FREQUENCY: Record<Recurrence, string> = {
  [Recurrence.Yearly]: 'YEARLY',
  [Recurrence.Monthly]: 'MONTHLY',
  [Recurrence.Weekly]: 'WEEKLY',
};

/** The last day of the month every month has; a monthly date after it needs a rule for the shorter months. */
const LAST_DAY_IN_EVERY_MONTH = 28;

/** February, as `Date.getMonth` counts it and as an RRULE's BYMONTH does. */
const FEBRUARY = { monthIndex: 1, byMonth: 2 } as const;

/** The day February has only in a leap year. */
const LEAP_DAY = 29;

/**
 * Writes the RRULE for an important date. A monthly date past the 28th names every day from the 28th to
 * its own and takes the last one each month has, so the 31st falls on the 30th in April rather than
 * skipping the month, which is what a bare `FREQ=MONTHLY` does. A yearly 29 February is written the same
 * way, so it falls on the 28th outside a leap year rather than skipping three years in four.
 *
 * @param date - The date as recorded, at local midnight.
 * @param [recurrence] - How the date repeats.
 * @returns The RRULE line, or `null` for a date that happens once or a recurrence the file cannot express.
 */
function recurrenceRule(date: Date, recurrence: string | null | undefined): string | null {
  const frequency = Object.entries(RRULE_FREQUENCY).find(([known]) => known === recurrence)?.[1];
  if (!frequency) {
    return null;
  }
  const day = date.getDate();
  const isShortMonthProne = recurrence === Recurrence.Monthly && day > LAST_DAY_IN_EVERY_MONTH;
  if (isShortMonthProne) {
    const days = Array.from({ length: day - LAST_DAY_IN_EVERY_MONTH + 1 }, (_, i) => LAST_DAY_IN_EVERY_MONTH + i);
    return `RRULE:FREQ=${frequency};BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
  }
  const isLeapDay = date.getMonth() === FEBRUARY.monthIndex && day === LEAP_DAY;
  const isLeapYearOnly = recurrence === Recurrence.Yearly && isLeapDay;
  if (isLeapYearOnly) {
    const days = [LAST_DAY_IN_EVERY_MONTH, LEAP_DAY];
    return `RRULE:FREQ=${frequency};BYMONTH=${FEBRUARY.byMonth};BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
  }
  return `RRULE:FREQ=${frequency}`;
}

/**
 * Builds the all-day VEVENT for an important date, repeating as the date does.
 *
 * @param importantDate - The date to write.
 * @param now - The export's time as an iCalendar DATE-TIME, for DTSTAMP.
 * @returns The event's lines, joined by CRLF.
 */
function buildImportantDateEvent(importantDate: CalendarImportantDate, now: string): string {
  const personName = buildCalendarPersonName(importantDate.person);
  const summary = escapeIcsText(`${importantDate.name} (${personName})`);
  const dtStart = formatIcsDateOnly(importantDate.date);
  const lines = [
    'BEGIN:VEVENT',
    `UID:importantdate-${importantDate.id}@philotes`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `SUMMARY:${summary}`,
  ];
  if (importantDate.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(importantDate.description)}`);
  }
  const rule = recurrenceRule(importantDate.date, importantDate.recurrence);
  if (rule) {
    lines.push(rule);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/**
 * Builds an iCalendar (RFC 5545) file of interactions and important dates.
 *
 * @param data - The events to write.
 * @returns The file's text, with CRLF line endings.
 */
export function buildIcsContent(data: CalendarEventsData): string {
  const now = formatIcsDateTime(new Date());

  const events = [
    ...data.interactions.map((i) => buildInteractionEvent(i, now)),
    ...data.importantDates.map((d) => buildImportantDateEvent(d, now)),
  ].join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Philotes CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}
