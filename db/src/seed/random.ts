// Random picks, counts and dates for the seed script.

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
/** The middle of `Math.random`'s range. Subtracting it gives a sort order that is as often negative as positive. */
const EVEN_ODDS = 0.5;

/**
 * Makes an id for a row.
 *
 * @returns A random UUID.
 */
export function randomId(): string {
  return crypto.randomUUID();
}

/**
 * Picks one item at random, each as likely as the next.
 *
 * @typeParam T - The item type.
 * @param arr - The items to pick from. Must hold at least one.
 * @returns The picked item.
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Picks a whole number from `min` to `max`, both included.
 *
 * @param min - The smallest number that can come back.
 * @param max - The largest number that can come back.
 * @returns The number.
 */
export function randomCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Answers true `probability` of the time.
 *
 * @param probability - From 0 for never to 1 for always.
 * @returns true on a hit.
 */
export function chance(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Picks a random handful of items, in random order.
 *
 * @typeParam T - The item type.
 * @param arr - The items to pick from.
 * @param min - Fewest to pick.
 * @param max - Most to pick.
 * @returns Between `min` and `max` of the items, or all of them when `arr` holds fewer than were drawn.
 */
export function pickRandomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = randomCount(min, max);
  const shuffled = [...arr].sort(() => Math.random() - EVEN_ODDS);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Picks a moment in the recent past.
 *
 * @param yearsBack - How far back it may fall, in years of 365 days.
 * @returns A moment between then and now.
 */
export function randomPastDate(yearsBack: number): Date {
  const now = Date.now();
  const msBack = yearsBack * DAYS_PER_YEAR * MS_PER_DAY;
  return new Date(now - Math.random() * msBack);
}

/**
 * Picks a moment in the near future.
 *
 * @param daysAhead - How far ahead it may fall, in days.
 * @returns A moment between now and then.
 */
export function randomFutureDate(daysAhead: number): Date {
  const now = Date.now();
  return new Date(now + Math.random() * daysAhead * MS_PER_DAY);
}

/**
 * Formats a moment as a calendar date in UTC.
 *
 * @param d - The moment.
 * @returns The date as `YYYY-MM-DD`.
 */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
