import { CHECK_IN_DEFAULTS } from './defaults';
import { MS_PER_DAY } from './time';
import { ContactFrequency } from './vocabulary';

/** How many days each check-in frequency allows between contacts. */
export const FREQUENCY_DAYS: Record<string, number> = {
  [ContactFrequency.Weekly]: 7,
  [ContactFrequency.Monthly]: 30,
  [ContactFrequency.Quarterly]: 90,
  [ContactFrequency.Yearly]: 365,
};

export function computeOverdueByDays(contactFrequency: string, lastContactedAt: Date | null): number {
  const periodDays = FREQUENCY_DAYS[contactFrequency] ?? CHECK_IN_DEFAULTS.fallbackPeriodDays;
  if (!lastContactedAt) {
    return periodDays;
  }
  const daysSince = Math.floor((Date.now() - lastContactedAt.getTime()) / MS_PER_DAY);
  return daysSince - periodDays;
}
