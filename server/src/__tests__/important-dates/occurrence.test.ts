import { Recurrence } from '@cubicecho/philotes-db/schema';
import { describe, expect, it } from 'vitest';
import { computeNextOccurrence } from '../../important-dates/resolvers.ts';

describe('computeNextOccurrence', () => {
  it('puts a monthly date on the 31st on the last day of a 30-day month', () => {
    const today = new Date(2026, 3, 10);

    const occurrence = computeNextOccurrence('2020-01-31', Recurrence.Monthly, today);

    expect(occurrence?.nextDate).toEqual(new Date(2026, 3, 30));
    expect(occurrence?.daysUntil).toBe(20);
  });

  it('puts a 29 February date on the 28th outside a leap year', () => {
    const today = new Date(2026, 0, 1);

    const occurrence = computeNextOccurrence('2024-02-29', Recurrence.Yearly, today);

    expect(occurrence?.nextDate).toEqual(new Date(2026, 1, 28));
  });

  it('counts a date that falls today as zero days away', () => {
    const today = new Date(2026, 5, 15);

    const occurrence = computeNextOccurrence('1990-06-15', Recurrence.Yearly, today);

    expect(occurrence?.daysUntil).toBe(0);
  });
});
