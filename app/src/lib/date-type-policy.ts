import type { FieldPolicy } from '@apollo/client';

/** What a date scalar's `merge` is handed: the server's string, a value already converted, or null. */
type IncomingDate = string | Date | null;

/**
 * Apollo InMemoryCache FieldPolicy for GraphQL `DateTime` scalar.
 * Incoming value is a full ISO 8601 timestamp string (e.g. "2026-03-09T14:32:00.000Z").
 * new Date() is safe here since the string includes timezone info.
 */
export const dateTimeTypePolicy: FieldPolicy<Date | null, IncomingDate> = {
  merge: (_existing, incoming) => {
    if (incoming == null) {
      return incoming;
    }
    if (incoming instanceof Date) {
      return incoming;
    }
    return new Date(incoming);
  },
};

/**
 * Apollo InMemoryCache FieldPolicy for GraphQL `Date` scalar.
 * Incoming value is a date-only string (e.g. "2026-03-09").
 * new Date("2026-03-09") parses as UTC midnight and can display as the
 * previous day in negative-offset timezones. Parse the parts explicitly
 * to construct a local-timezone date instead.
 */
export const dateTypePolicy: FieldPolicy<Date | null, IncomingDate> = {
  merge: (_existing, incoming) => {
    if (incoming == null) {
      return incoming;
    }
    const isAlreadyDate = typeof incoming !== 'string';
    if (isAlreadyDate) {
      return incoming;
    }
    // Parse YYYY-MM-DD parts and construct as local time (not UTC)
    const [year, month, day] = incoming.split('-').map(Number);
    return new Date(year, month - 1, day);
  },
};
