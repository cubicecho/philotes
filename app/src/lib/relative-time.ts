import { DAYS_PER_MONTH, DAYS_PER_WEEK, DAYS_PER_YEAR, MS_PER_DAY } from './time';

function plural(n: number, unit: string): string {
  return n === 1 ? `1 ${unit} ago` : `${n} ${unit}s ago`;
}

/** Human-friendly "how long ago" label: Today, Yesterday, 3 days ago, 2 weeks ago… */
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
