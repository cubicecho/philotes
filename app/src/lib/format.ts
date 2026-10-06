export type Moment = string | number | Date;

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * A size in bytes as `512 B`, `1.5 KB`, `3.0 MB`, `2.1 GB`.
 *
 * A step is 1024, and a size from a kilobyte up carries one decimal place. Sizes past the last
 * unit stay in it — `2048.0 GB` — and do not grow a unit nobody asked for.
 */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

/**
 * A count with its thousands grouped, and its noun when one is given: `1,204`, `1 file`,
 * `3 files`, `2 entries`.
 *
 * @param one - The noun for exactly one. Left out, the number is returned alone.
 * @param many - The noun for any other count, when adding an `s` is not it.
 */
export function formatCount(count: number, one?: string, many = `${one}s`): string {
  const number = count.toLocaleString();
  return one === undefined ? number : `${number} ${count === 1 ? one : many}`;
}

/**
 * The facts under a title as one line: `1 file · 2 chunks · human-only`.
 *
 * A part that is empty, `false`, `null` or `undefined` is left out, so a fact that only sometimes
 * applies is written inline — `joinStats(formatCount(files, "file"), locked && "human-only")` —
 * and no dot is left hanging where it would have been.
 */
export function joinStats(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * A span of seconds at the grain a reader wants: `42s`, `5m`, `3h 12m`, `2d 4h`.
 *
 * Seconds and minutes stand alone; from an hour up the next unit down rides along, because
 * `3h` could be anything up to an hour out.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** The moment in epoch milliseconds, or nothing when it does not parse. */
function milliseconds(moment: Moment): number | undefined {
  const time = new Date(moment).getTime();
  return Number.isNaN(time) ? undefined : time;
}

/**
 * A medium-length date in the reader's own locale — `Oct 3, 2026` — or an empty string when the
 * moment does not parse, so a missing timestamp draws nothing where `Invalid Date` would show.
 */
export function formatDate(moment: Moment): string {
  const time = milliseconds(moment);
  if (time === undefined) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(time);
}

/** The units `formatAgo` counts in, largest first, each with its length in seconds. */
const AGO_STEPS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
] as const;

/**
 * How long ago a moment was, in its largest whole unit: `3 days ago`, `yesterday`, `just now`
 * under a minute. A moment still to come reads `in 2 hours`, and one that does not parse is an
 * empty string, as in {@link formatDate}.
 *
 * @param now - The moment to count from, for a caller that ticks its own clock.
 */
export function formatAgo(moment: Moment, now: Moment = Date.now()): string {
  const then = milliseconds(moment);
  const from = milliseconds(now);
  if (then === undefined || from === undefined) return '';

  const seconds = Math.round((then - from) / 1000);
  for (const [unit, size] of AGO_STEPS) {
    if (Math.abs(seconds) < size) continue;
    const amount = Math.round(seconds / size);
    // Hermes ships `Intl` without `RelativeTimeFormat` on some devices, and a missing
    // constructor would take the screen down with it. English is the fallback there.
    if (typeof Intl.RelativeTimeFormat !== 'function') {
      const span = formatCount(Math.abs(amount), unit);
      return amount < 0 ? `${span} ago` : `in ${span}`;
    }
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(amount, unit);
  }
  return 'just now';
}
