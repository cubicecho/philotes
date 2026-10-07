const PAD_WIDTH = 2;

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
