import { DAYS_PER_WEEK, MS_PER_DAY } from '@/lib/time';
import { Recurrence } from '@/lib/vocabulary';

/**
 * Gives the start of today.
 *
 * @returns Today at local midnight.
 */
export function todayMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Counts the calendar days from one local midnight to another.
 *
 * @param from - The day counted from.
 * @param to - The day counted to.
 * @returns Whole days; rounding absorbs the hour a daylight-saving change adds or removes.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Builds a day in a month, falling back to the month's last day when the month is shorter: the 31st
 * in April is the 30th, and 29 February is the 28th outside a leap year.
 *
 * @param year - The full year.
 * @param month - The month, 0 for January; 12 rolls into the next year.
 * @param day - The day of the month wanted.
 * @returns Local midnight of that day.
 */
function dateInMonth(year: number, month: number, day: number): Date {
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * Counts the days until an important date next comes round.
 *
 * @param stored - The date as recorded, at local midnight.
 * @param recurrence - How the date repeats; null, undefined or empty means it happens once.
 * @param [today] - The day counted from, at local midnight.
 * @returns Days from `today`, 0 for today itself, or `null` for a one-off date already past or an unknown recurrence.
 */
export function daysUntilNextOccurrence(
  stored: Date,
  recurrence: string | null | undefined,
  today: Date = todayMidnight(),
): number | null {
  const month = stored.getMonth();
  const day = stored.getDate();

  if (!recurrence) {
    const diff = daysBetween(today, new Date(stored.getFullYear(), month, day));
    const isStillAhead = diff >= 0;
    return isStillAhead ? diff : null;
  }

  if (recurrence === Recurrence.Yearly) {
    const diff = daysBetween(today, dateInMonth(today.getFullYear(), month, day));
    const isStillAhead = diff >= 0;
    return isStillAhead ? diff : daysBetween(today, dateInMonth(today.getFullYear() + 1, month, day));
  }

  if (recurrence === Recurrence.Monthly) {
    const diff = daysBetween(today, dateInMonth(today.getFullYear(), today.getMonth(), day));
    const isStillAhead = diff >= 0;
    return isStillAhead ? diff : daysBetween(today, dateInMonth(today.getFullYear(), today.getMonth() + 1, day));
  }

  if (recurrence === Recurrence.Weekly) {
    return (stored.getDay() - today.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  }

  return null;
}
