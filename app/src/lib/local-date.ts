const PAD_WIDTH = 2;

/** The length of `YYYY-MM-DD`. */
const ISO_DAY_LENGTH = 10;

/**
 * Writes a date as the calendar day it shows in the reader's own time zone. `toISOString` gives the
 * UTC day instead, which is the day before for a local midnight anywhere east of Greenwich.
 *
 * @param date - The date to write.
 * @returns The day as `YYYY-MM-DD`.
 */
export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(PAD_WIDTH, '0');
  const day = String(date.getDate()).padStart(PAD_WIDTH, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Writes a day for reading, in the reader's locale. A day whose year is not known is written without one.
 *
 * @param date - Local midnight of the day.
 * @param hasYear - Whether the day's year is known. `false` for a birthday kept as a month and a day.
 * @returns The day with a long month name: "March 9, 2026", or "March 9" without its year, in US English.
 */
export function formatDay(date: Date, hasYear: boolean): string {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: hasYear ? 'numeric' : undefined });
}

/**
 * Reads a `YYYY-MM-DD` day as a local date. `new Date(str)` reads it as UTC midnight instead, which is
 * the day before anywhere west of Greenwich.
 *
 * @param value - The day as `YYYY-MM-DD`; anything after those ten characters is ignored.
 * @returns Local midnight of that day, or `null` when the value does not name a day.
 */
export function parseLocalDay(value: string): Date | null {
  const [year, month, day] = value.slice(0, ISO_DAY_LENGTH).split('-').map(Number);
  const isIncomplete = !year || !month || !day;
  if (isIncomplete) {
    return null;
  }
  return new Date(year, month - 1, day);
}
