const MS_PER_DAY = 1000 * 60 * 60 * 24;

function plural(n: number, unit: string): string {
  return n === 1 ? `1 ${unit} ago` : `${n} ${unit}s ago`;
}

/** Human-friendly "how long ago" label: Today, Yesterday, 3 days ago, 2 weeks ago… */
export function relativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return plural(diffDays, 'day');
  if (diffDays < 30) return plural(Math.floor(diffDays / 7), 'week');
  if (diffDays < 365) return plural(Math.floor(diffDays / 30), 'month');
  return plural(Math.floor(diffDays / 365), 'year');
}
