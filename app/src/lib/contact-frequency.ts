export const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export function computeOverdueByDays(contactFrequency: string, lastContactedAt: Date | null): number {
  const periodDays = FREQUENCY_DAYS[contactFrequency] ?? 30;
  if (!lastContactedAt) {
    return periodDays;
  }
  const daysSince = Math.floor((Date.now() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince - periodDays;
}
