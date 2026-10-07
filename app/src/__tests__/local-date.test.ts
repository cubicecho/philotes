import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localIsoDate } from '../lib/local-date';

describe('localIsoDate', () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    // East of Greenwich, where local midnight falls on the previous UTC day.
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it('writes the local calendar day, not the UTC one', () => {
    expect(localIsoDate(new Date(1815, 11, 10))).toBe('1815-12-10');
  });

  it('pads the month and the day', () => {
    expect(localIsoDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });
});
