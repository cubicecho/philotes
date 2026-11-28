import type { Moment } from '@/lib/format';

/** A calendar day, `2026-10-03`: a day and no instant, in no time zone. */
export type Day = string;

/** A day of the week, as `Date.getDay` numbers them: `0` is Sunday and `6` Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The shape of a day, before the calendar has been asked whether it has it. */
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** Monday, which ISO 8601 starts a week on. */
const MONDAY: Weekday = 1;
/** The width of a month and of a day of the month in `YYYY-MM-DD`. */
const TWO_DIGITS = 2;

/** A day of `year`, `month` (from 0) and `date`, written out. */
function write(year: number, month: number, date: number): Day {
  const pad = (value: number) => String(value).padStart(TWO_DIGITS, '0');
  return `${year}-${pad(month + 1)}-${pad(date)}`;
}

/** The day's UTC midnight, or nothing for a string that is not a day on the calendar. */
function utcMidnight(day: string): number | undefined {
  const match = DAY_PATTERN.exec(day);
  if (match === null) {
    return undefined;
  }
  const [year, month, date] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const time = Date.UTC(year, month, date);
  const at = new Date(time);
  const isOnTheCalendar = at.getUTCMonth() === month && at.getUTCDate() === date;
  return isOnTheCalendar ? time : undefined;
}

/** The day `time`'s UTC midnight is. */
function fromUtcMidnight(time: number): Day {
  const at = new Date(time);
  return write(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

/** The UTC midnight of a day the caller has already checked, or of a day that throws. */
function midnightOf(day: Day): number {
  const time = utcMidnight(day);
  if (time === undefined) {
    throw new RangeError(`Not a calendar day: "${day}"`);
  }
  return time;
}

/**
 * The day a moment fell on: in the reader's zone, or in `timeZone` when it is named, such as a
 * user's own zone kept on the server, so a reader abroad still sees that user's days. A moment
 * that does not parse has no day, and is `undefined`.
 *
 * @param moment - An ISO string, epoch milliseconds or a `Date`, as {@link Moment} reads it.
 * @param timeZone - An IANA zone, `Europe/Berlin`. Left out, the reader's own.
 */
export function dayOf(moment: Moment, timeZone?: string): Day | undefined {
  // A day is already the day it names, in any zone.
  if (typeof moment === 'string' && parseDay(moment) !== undefined) {
    return moment;
  }
  const instant = new Date(moment);
  if (Number.isNaN(instant.getTime())) {
    return undefined;
  }
  if (timeZone === undefined) {
    return write(instant.getFullYear(), instant.getMonth(), instant.getDate());
  }
  // `en-US` only for the digits, which every locale's `formatToParts` would hand back in its own.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((each) => each.type === type)?.value);
  return write(part('year'), part('month') - 1, part('day'));
}

/**
 * The day it is now: in the reader's zone, or in `timeZone` when it is named. Read once, it goes
 * stale at midnight; a screen that stays open holds `useToday` instead.
 *
 * @param timeZone - An IANA zone, `Europe/Berlin`. Left out, the reader's own.
 */
export function today(timeZone?: string): Day {
  return dayOf(new Date(), timeZone) ?? '';
}

/**
 * The day a string names, or `undefined` when it names none: what a URL, a date input or a stored
 * field offered, checked. It must be `YYYY-MM-DD` and a day the calendar has, so `2026-02-31` is
 * `undefined` rather than rolling on into March.
 */
export function parseDay(value: string | null | undefined): Day | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return utcMidnight(value) === undefined ? undefined : value;
}

/**
 * The day's local midnight, as a `Date`: what a `DatePicker` or a `Calendar` holds. `new Date(day)`
 * is UTC's midnight instead, which is the evening before anywhere west of Greenwich.
 *
 * @throws RangeError for a string that is not a day; check one from outside with {@link parseDay}.
 */
export function dayToDate(day: Day): Date {
  const at = new Date(midnightOf(day));
  return new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

/**
 * The day `count` days after `day`, or before it for a negative count, along the calendar: the
 * day after `2026-02-28` is `2026-03-01`.
 *
 * @throws RangeError for a string that is not a day.
 */
export function addDays(day: Day, count: number): Day {
  return fromUtcMidnight(midnightOf(day) + count * MS_PER_DAY);
}

/**
 * Whole days from `from` to `to`: `1` from a day to the next, negative when `to` is earlier.
 *
 * @throws RangeError for a string that is not a day.
 */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((midnightOf(to) - midnightOf(from)) / MS_PER_DAY);
}

/**
 * The first day of the week `day` is in.
 *
 * @param firstWeekday - The day a week starts on: Monday (`1`), as ISO 8601 has it, unless the
 * screen's calendar starts on another, such as Sunday (`0`).
 * @throws RangeError for a string that is not a day.
 */
export function startOfWeek(day: Day, firstWeekday: Weekday = MONDAY): Day {
  const weekday = new Date(midnightOf(day)).getUTCDay();
  return addDays(day, -((weekday - firstWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK));
}

/**
 * How `formatDay` writes a day, in the reader's locale, shown here as US English writes
 * `2026-10-03`. `medium` is `formatDate`'s own options, so the two write a day alike.
 */
const DAY_FORMATS = {
  /** `Oct 3`, for a day this year or beside its neighbours: an axis, a row in a week. */
  short: { month: 'short', day: 'numeric' },
  /** `Oct 3, 2026`. */
  medium: { dateStyle: 'medium' },
  /** `October 3, 2026`. */
  long: { dateStyle: 'long' },
  /** `Saturday, October 3, 2026`, for the title of the day's own page. */
  full: { dateStyle: 'full' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** How {@link formatDay} writes a day. */
export type DayStyle = keyof typeof DAY_FORMATS;

/**
 * A day written for a reader, in their locale: `Oct 3, 2026` by default. The day as it says, in no
 * zone, so `2026-10-03` reads the 3rd wherever the reader is. A string that is not a day is an
 * empty string, as a moment that does not parse is in `formatDate`.
 *
 * @param style - `short` for `Oct 3`, `medium` for `Oct 3, 2026` (the default, and what
 * `formatDate` writes), `long` for `October 3, 2026`, `full` for `Saturday, October 3, 2026`.
 */
export function formatDay(day: Day, style: DayStyle = 'medium'): string {
  const time = utcMidnight(day);
  if (time === undefined) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, { ...DAY_FORMATS[style], timeZone: 'UTC' }).format(time);
}
