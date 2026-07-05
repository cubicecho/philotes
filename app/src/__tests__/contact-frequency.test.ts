import { describe, expect, it } from 'vitest';
import { computeOverdueByDays, FREQUENCY_DAYS } from '../lib/contact-frequency';

describe('FREQUENCY_DAYS', () => {
  it('has the expected period values', () => {
    expect(FREQUENCY_DAYS.weekly).toBe(7);
    expect(FREQUENCY_DAYS.monthly).toBe(30);
    expect(FREQUENCY_DAYS.quarterly).toBe(90);
    expect(FREQUENCY_DAYS.yearly).toBe(365);
  });
});

describe('computeOverdueByDays', () => {
  it('returns the full period when never contacted', () => {
    expect(computeOverdueByDays('monthly', null)).toBe(30);
    expect(computeOverdueByDays('weekly', null)).toBe(7);
  });

  it('defaults to 30-day period for an unknown frequency', () => {
    expect(computeOverdueByDays('bimonthly', null)).toBe(30);
  });

  it('returns a positive number when overdue', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const overdueBy = computeOverdueByDays('monthly', fortyDaysAgo);
    expect(overdueBy).toBeGreaterThan(0);
    // 40 days since last contact, 30-day period → ~10 days overdue
    expect(overdueBy).toBeCloseTo(10, 0);
  });

  it('returns a negative number when not yet due', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const overdueBy = computeOverdueByDays('monthly', fiveDaysAgo);
    expect(overdueBy).toBeLessThan(0);
  });

  it('returns ~0 when contacted exactly on schedule', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdueBy = computeOverdueByDays('monthly', thirtyDaysAgo);
    expect(Math.abs(overdueBy)).toBeLessThanOrEqual(1);
  });

  it('handles weekly frequency correctly', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const overdueBy = computeOverdueByDays('weekly', tenDaysAgo);
    // 10 days since last contact, 7-day period → ~3 days overdue
    expect(overdueBy).toBeCloseTo(3, 0);
  });
});
