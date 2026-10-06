import type { FieldPolicy } from '@apollo/client';

/**
 * Apollo InMemoryCache FieldPolicy for GraphQL `DateTime` scalar.
 * Incoming value is a full ISO 8601 timestamp string (e.g. "2026-03-09T14:32:00.000Z").
 * new Date() is safe here since the string includes timezone info.
 */
export const dateTimeTypePolicy: FieldPolicy<Date | null> = {
  merge: (_existing, incoming: unknown) => {
    if (incoming == null) {
      return incoming as null;
    }
    if (incoming instanceof Date) {
      return incoming;
    }
    return new Date(incoming as string);
  },
};

/**
 * Apollo InMemoryCache FieldPolicy for GraphQL `Date` scalar.
 * Incoming value is a date-only string (e.g. "2026-03-09").
 * new Date("2026-03-09") parses as UTC midnight and can display as the
 * previous day in negative-offset timezones. Parse the parts explicitly
 * to construct a local-timezone date instead.
 */
export const dateTypePolicy: FieldPolicy<Date | null> = {
  merge: (_existing, incoming: unknown) => {
    if (incoming == null) {
      return incoming as null;
    }
    if (incoming instanceof Date) {
      return incoming;
    }
    const str = incoming as string;
    // Parse YYYY-MM-DD parts and construct as local time (not UTC)
    const [year, month, day] = str.split('-').map(Number);
    return new Date(year, month - 1, day);
  },
};
