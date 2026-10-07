import { describe, expect, it } from 'vitest';
import { buildIcsContent, type CalendarEventsData } from '../lib/ics-export';

const ada = { id: 'p1', firstName: 'Ada', lastName: 'Lovelace' };

function events(overrides: Partial<CalendarEventsData> = {}): CalendarEventsData {
  return { interactions: [], importantDates: [], ...overrides };
}

describe('buildIcsContent', () => {
  it('wraps events in a VCALENDAR with CRLF line endings', () => {
    const ics = buildIcsContent(events());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('writes an interaction as a 30-minute timed event', () => {
    const ics = buildIcsContent(
      events({
        interactions: [
          {
            id: 'i1',
            channel: 'call',
            occurredAt: new Date('2024-03-01T10:00:00.000Z'),
            note: 'Caught up',
            person: ada,
          },
        ],
      }),
    );
    expect(ics).toContain('UID:interaction-i1@philotes');
    expect(ics).toContain('DTSTART:20240301T100000Z');
    expect(ics).toContain('DTEND:20240301T103000Z');
    expect(ics).toContain('SUMMARY:Call with Ada Lovelace');
    expect(ics).toContain('DESCRIPTION:Caught up');
  });

  it('omits DESCRIPTION when there is no note', () => {
    const ics = buildIcsContent(
      events({
        interactions: [
          { id: 'i1', channel: 'email', occurredAt: new Date('2024-03-01T10:00:00.000Z'), note: null, person: ada },
        ],
      }),
    );
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('falls back to "Unknown" when the interaction has no person', () => {
    const ics = buildIcsContent(
      events({
        interactions: [{ id: 'i1', channel: 'text', occurredAt: new Date('2024-03-01T10:00:00.000Z'), person: null }],
      }),
    );
    expect(ics).toContain('SUMMARY:Text with Unknown');
  });

  it('writes an important date as an all-day event', () => {
    const ics = buildIcsContent(
      events({
        importantDates: [
          { id: 'd1', name: 'Birthday', date: new Date(1815, 11, 10), recurrence: 'yearly', person: ada },
        ],
      }),
    );
    expect(ics).toContain('UID:importantdate-d1@philotes');
    expect(ics).toContain('DTSTART;VALUE=DATE:18151210');
    expect(ics).toContain('SUMMARY:Birthday (Ada Lovelace)');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
  });

  it('only recurs a date whose recurrence is yearly', () => {
    const ics = buildIcsContent(
      events({
        importantDates: [{ id: 'd1', name: 'Move-in', date: new Date(2020, 0, 1), recurrence: null, person: ada }],
      }),
    );
    expect(ics).not.toContain('RRULE');
  });

  it('escapes the characters RFC 5545 reserves', () => {
    const ics = buildIcsContent(
      events({
        importantDates: [
          {
            id: 'd1',
            name: 'Party',
            description: 'Cake; balloons, and\na card',
            date: new Date(2020, 0, 1),
            person: ada,
          },
        ],
      }),
    );
    expect(ics).toContain('DESCRIPTION:Cake\\; balloons\\, and\\na card');
  });

  it('includes both kinds of event', () => {
    const ics = buildIcsContent(
      events({
        interactions: [{ id: 'i1', channel: 'call', occurredAt: new Date('2024-03-01T10:00:00.000Z'), person: ada }],
        importantDates: [{ id: 'd1', name: 'Birthday', date: new Date(1815, 11, 10), person: ada }],
      }),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
