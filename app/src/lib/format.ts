export type Moment = string | number | Date;

/** How a size steps from one unit to the next, and what it calls each. */
type ByteScale = { step: number; units: readonly string[] };

/**
 * `binary` and `decimal` are the two a reader can be offered; left out, a size keeps the 1024-step
 * `KB` it has always been written with, so a screen that never chose does not change.
 */
const BYTE_SCALES = {
  default: { step: 1024, units: ["B", "KB", "MB", "GB"] },
  binary: { step: 1024, units: ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] },
  decimal: { step: 1000, units: ["B", "kB", "MB", "GB", "TB", "PB"] },
} as const satisfies Record<string, ByteScale>;

/** How `formatBytes` and `formatRate` step a size. */
export type FormatBytesOptions = {
  /**
   * `binary` steps by 1024 and writes `KiB`, `MiB` up to `PiB`; `decimal` steps by 1000 and writes
   * `kB`, `MB` up to `PB`, as a disk's label does. Left out, it steps by 1024 and writes `KB`, `MB`,
   * `GB`.
   */
  units?: "binary" | "decimal" | undefined;
};

/**
 * A size in bytes as `512 B`, `1.5 KB`, `3.0 MB`, `2.1 GB`.
 *
 * A size from the first unit up carries one decimal place. Sizes past the last unit stay in it —
 * `2048.0 GB` — and do not grow a unit nobody asked for.
 *
 * @param options.units - `binary` for `1.5 KiB`, `decimal` for `1.5 kB`.
 */
export function formatBytes(bytes: number, { units }: FormatBytesOptions = {}): string {
  const { step, units: names } = BYTE_SCALES[units ?? "default"];
  const shown = (value: number, unit: number) => (unit === 0 ? String(value) : value.toFixed(1));
  let value = bytes;
  let unit = 0;
  // The unit is chosen on the figure as written, so a size just under a megabyte, which rounds to
  // `1024.0 KB`, is `1.0 MB`.
  while (Number(shown(value, unit)) >= step && unit < names.length - 1) {
    value /= step;
    unit += 1;
  }
  return `${shown(value, unit)} ${names[unit]}`;
}

/**
 * A rate in bytes per second as `1.4 MiB/s`: {@link formatBytes}, per second, in the same units.
 *
 * @param options.units - `binary` for `1.4 MiB/s`, `decimal` for `1.4 MB/s`.
 */
export function formatRate(bytesPerSecond: number, options: FormatBytesOptions = {}): string {
  return `${formatBytes(bytesPerSecond, options)}/s`;
}

/**
 * A count shortened for a line with other facts on it: `340`, `1.2K`, `3.4M`, with one decimal
 * place at most, in the reader's locale. For a count where the last digits do not matter, such as
 * tokens used; {@link formatCount} writes them all.
 */
export function formatCompact(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    count,
  );
}

/**
 * A ratio as a percentage in the reader's locale: `0.425` is `43%`, or `42.5%` with one digit.
 * A ratio, not a percentage, as `Intl` takes it: a reading that is already 0 to 100 is divided by
 * 100 first.
 *
 * @param fractionDigits - The decimal places, always written: `1` makes `0.4` read `40.0%`.
 */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
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
  return parts.filter(Boolean).join(" · ");
}

/**
 * A span of seconds at the grain a reader wants: `42s`, `5m`, `3h 12m`, `2d 4h`.
 *
 * Seconds and minutes stand alone; from an hour up the next unit down rides along, because
 * `3h` could be anything up to an hour out.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** A bare calendar day, and nothing after it. */
const BARE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The moment in epoch milliseconds, or nothing when it does not parse. A bare day is its local
 * midnight, and a day the calendar does not have (`2026-02-31`) does not parse.
 */
function milliseconds(moment: Moment): number | undefined {
  const day = typeof moment === "string" ? BARE_DAY.exec(moment) : null;
  if (day !== null) {
    const [year, month, date] = [Number(day[1]), Number(day[2]) - 1, Number(day[3])];
    const midnight = new Date(year, month, date);
    const isOnTheCalendar = midnight.getMonth() === month && midnight.getDate() === date;
    return isOnTheCalendar ? midnight.getTime() : undefined;
  }
  const time = new Date(moment).getTime();
  return Number.isNaN(time) ? undefined : time;
}

/**
 * A medium-length date in the reader's own locale — `Oct 3, 2026` — or an empty string when the
 * moment does not parse, so a missing timestamp draws nothing where `Invalid Date` would show.
 */
export function formatDate(moment: Moment): string {
  const time = milliseconds(moment);
  if (time === undefined) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(time);
}

/**
 * A medium date and a short time in the reader's own locale — `Oct 3, 2026, 2:32 PM` — for the
 * place where two things arrived on the same day and the hour is what tells them apart. Empty for
 * a moment that does not parse, as in {@link formatDate}.
 */
export function formatDateTime(moment: Moment): string {
  const time = milliseconds(moment);
  if (time === undefined) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    time,
  );
}

const MS_PER_SECOND = 1000;
/** Lengths in seconds. A month is thirty days and a year 365: this is for "3 mo ago", not dates. */
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const WEEK = 604_800;
const MONTH = 2_592_000;
const YEAR = 31_536_000;
const MONTHS_PER_YEAR = 12;

/**
 * The units `formatAgo` counts in, largest first, each with its length in seconds, the letters
 * the narrow English fallback writes it with, and how many of it read as one of the unit above.
 * A week has none: a span under a month is under five weeks, and four weeks is not a month.
 */
const AGO_STEPS = [
  ["year", YEAR, "y", undefined],
  ["month", MONTH, "mo", MONTHS_PER_YEAR],
  ["week", WEEK, "w", undefined],
  ["day", DAY, "d", WEEK / DAY],
  ["hour", HOUR, "h", DAY / HOUR],
  ["minute", MINUTE, "m", HOUR / MINUTE],
] as const;

/** What `formatAgo` writes: a count of a unit, and the unit's letters for the narrow fallback. */
type AgoSpan = { amount: number; unit: Intl.RelativeTimeFormatUnit; letters: string };

/** Under a minute is no unit at all: `Intl` words a nought of seconds as the locale's `now`. */
const UNDER_A_MINUTE: AgoSpan = { amount: 0, unit: "second", letters: "s" };

/** The largest unit an age of `seconds` holds whole, and how many of it, rounded. */
function agoSpan(seconds: number): AgoSpan {
  const index = AGO_STEPS.findIndex(([, size]) => Math.abs(seconds) >= size);
  const step = AGO_STEPS[index];
  if (step === undefined) {
    return UNDER_A_MINUTE;
  }
  const [unit, size, letters, perNext] = step;
  const amount = Math.round(seconds / size);
  // Rounding can reach the unit above — 23.5 hours is `24 hours` — and that is one of it.
  const larger = AGO_STEPS[index - 1];
  if (larger !== undefined && perNext !== undefined && Math.abs(amount) >= perNext) {
    const [largerUnit, largerSize, largerLetters] = larger;
    return { amount: Math.round(seconds / largerSize), unit: largerUnit, letters: largerLetters };
  }
  return { amount, unit, letters };
}

/** The days a week holds, below which `by: "day"` counts days rather than weeks. */
const DAYS_PER_WEEK = WEEK / DAY;

/**
 * Whole calendar days from `from` to `then` in the reader's zone: one moment the evening before
 * and another the morning after are a day apart, however few hours lie between them. Counted on
 * each day's UTC midnight, so a 23- or 25-hour day is still one.
 */
function calendarDays(then: number, from: number): number {
  const midnight = (time: number) => {
    const date = new Date(time);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return Math.round((midnight(then) - midnight(from)) / (DAY * MS_PER_SECOND));
}

/** An age in calendar days, as `formatAgo` words it: days under a week, its larger units above. */
function daySpan(days: number): AgoSpan {
  if (Math.abs(days) < DAYS_PER_WEEK) {
    return { amount: days, unit: "day", letters: "d" };
  }
  return agoSpan(days * DAY);
}

/** What the English fallback calls the day before, the day itself and the day after. */
const NEAR_DAYS: Record<number, string> = { [-1]: "yesterday", 0: "today", 1: "tomorrow" };

/** How `formatAgo` words an age. */
export type FormatAgoOptions = {
  /**
   * `long`, the default, writes `5 minutes ago`. `narrow` writes `5m ago`, for a column where the
   * time is one fact among several.
   */
  style?: "long" | "narrow" | undefined;
  /**
   * `time`, the default, counts the time between: `5 minutes ago`. `day` counts the calendar days
   * crossed, in the reader's zone: `today`, `yesterday`, `3 days ago`, then weeks, months and
   * years. For a date with no time worth saying, such as when a note was last met or the heading
   * over a day's rows; last night at eleven is `yesterday` at nine the next morning.
   */
  by?: "time" | "day" | undefined;
};

/**
 * How long ago a moment was, in its largest whole unit: `3 days ago`, `yesterday`, `now` under a
 * minute. A moment still to come reads `in 2 hours`, and one that does not parse is an empty
 * string, as in {@link formatDate}. The count is rounded, and a count that rounds up to the next
 * unit is written in it: 23 and a half hours is `yesterday`, not `24 hours ago`. With
 * `by: "day"` it counts calendar days instead: `today`, `yesterday`, `3 days ago`.
 *
 * @param now - The moment to count from, for a caller that ticks its own clock.
 * @param options.style - `narrow` writes `5m ago`, `3d ago`, `in 2h` for a dense column.
 * @param options.by - `day` counts calendar days: `today`, `yesterday`, `3 days ago`.
 */
export function formatAgo(
  moment: Moment,
  now: Moment = Date.now(),
  { style = "long", by = "time" }: FormatAgoOptions = {},
): string {
  const then = milliseconds(moment);
  const from = milliseconds(now);
  if (then === undefined || from === undefined) {
    return "";
  }

  const { amount, unit, letters } =
    by === "day"
      ? daySpan(calendarDays(then, from))
      : agoSpan(Math.round((then - from) / MS_PER_SECOND));
  // Hermes ships `Intl` without `RelativeTimeFormat` on some devices, and a missing
  // constructor would take the screen down with it. English is the fallback there.
  if (typeof Intl.RelativeTimeFormat !== "function") {
    const nearDay = by === "day" && unit === "day" ? NEAR_DAYS[amount] : undefined;
    if (nearDay !== undefined) {
      return nearDay;
    }
    if (amount === 0) {
      return "now";
    }
    const count = Math.abs(amount);
    const span = style === "narrow" ? `${count}${letters}` : formatCount(count, unit);
    return amount < 0 ? `${span} ago` : `in ${span}`;
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style }).format(amount, unit);
}
