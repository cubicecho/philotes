import { describe, expect, it } from 'vitest';
import { daysUntilNextOccurrence } from '../lib/next-occurrence';
import { Recurrence } from '../lib/vocabulary';

describe('daysUntilNextOccurrence', () => {
  const today = new Date(2026, 3, 10);

  it('counts a yearly date falling today as today, not next year', () => {
    expect(daysUntilNextOccurrence(new Date(1990, 3, 10), Recurrence.Yearly, today)).toBe(0);
  });

  it('moves a yearly date already past to next year', () => {
    expect(daysUntilNextOccurrence(new Date(1990, 3, 9), Recurrence.Yearly, today)).toBe(364);
  });

  it('keeps a monthly 31st in a 30-day month, on its last day', () => {
    expect(daysUntilNextOccurrence(new Date(2020, 0, 31), Recurrence.Monthly, today)).toBe(20);
  });

  it('puts 29 February on the 28th outside a leap year', () => {
    expect(daysUntilNextOccurrence(new Date(2020, 1, 29), Recurrence.Yearly, new Date(2026, 1, 1))).toBe(27);
  });

  it('counts to the next matching weekday', () => {
    // 10 April 2026 is a Friday; 6 January 2020 was a Monday.
    expect(daysUntilNextOccurrence(new Date(2020, 0, 6), Recurrence.Weekly, today)).toBe(3);
  });

  it('gives null for a one-off date already past, and counts one still ahead', () => {
    expect(daysUntilNextOccurrence(new Date(2026, 3, 9), null, today)).toBeNull();
    expect(daysUntilNextOccurrence(new Date(2026, 3, 12), null, today)).toBe(2);
  });

  it('gives null for a recurrence it does not know', () => {
    expect(daysUntilNextOccurrence(new Date(2020, 0, 6), 'fortnightly', today)).toBeNull();
  });
});
