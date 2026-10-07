import { DAYS_PER_MONTH, DAYS_PER_WEEK, DAYS_PER_YEAR, MS_PER_DAY } from './time';

/**
 * Writes a count of units ago, adding an "s" for any count but one.
 *
 * @param n - How many units.
 * @param unit - The unit in the singular, such as "day".
 * @returns The label, such as "1 day ago" or "3 days ago".
 */
function plural(n: number, unit: string): string {
  return n === 1 ? `1 ${unit} ago` : `${n} ${unit}s ago`;
}

/**
 * Says how long ago a date was: Today, Yesterday, 3 days ago, 2 weeks ago, and on up to years.
 *
 * @param date - The moment to measure back to.
 * @returns The label. A date under 24 hours old, or in the future, reads "Today".
 */
export function relativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
  if (diffDays <= 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < DAYS_PER_WEEK) {
    return plural(diffDays, 'day');
  }
  if (diffDays < DAYS_PER_MONTH) {
    return plural(Math.floor(diffDays / DAYS_PER_WEEK), 'week');
  }
  if (diffDays < DAYS_PER_YEAR) {
    return plural(Math.floor(diffDays / DAYS_PER_MONTH), 'month');
  }
  return plural(Math.floor(diffDays / DAYS_PER_YEAR), 'year');
}
