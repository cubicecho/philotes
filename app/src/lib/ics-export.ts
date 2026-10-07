// RFC 5545 calendar export. The `GetAllEventsForExport` query in export-calendar-card.tsx must select
// every field these shapes name. Dates arrive as `Date` objects, made by the Apollo cache's scalar policies.

import { CALENDAR_EXPORT_DEFAULTS } from '@/lib/defaults';
import { localIsoDate } from '@/lib/local-date';
import { MS_PER_MINUTE } from '@/lib/time';
import { Recurrence } from '@/lib/vocabulary';

export interface CalendarPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
}

export interface CalendarInteraction {
  id: string;
  channel: string;
  occurredAt: Date;
  note?: string | null;
  person?: CalendarPerson | null;
}

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

export interface CalendarEventsData {
  interactions: CalendarInteraction[];
  importantDates: CalendarImportantDate[];
}

function buildCalendarPersonName(person?: CalendarPerson | null): string {
  if (!person) {
    return 'Unknown';
  }
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

function formatIcsDateTime(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Format a date-only value as a DATE (not DATE-TIME) for all-day events */
function formatIcsDateOnly(date: Date): string {
  return localIsoDate(date).replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

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
  if (importantDate.recurrence === Recurrence.Yearly) {
    lines.push('RRULE:FREQ=YEARLY');
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

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
