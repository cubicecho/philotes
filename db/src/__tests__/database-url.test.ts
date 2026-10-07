import { describe, expect, it } from 'vitest';
import { isPostgresUrl } from '../database-url.ts';

describe('isPostgresUrl', () => {
  it.each(['postgres://user:pw@db:5432/philotes', 'postgresql://db/philotes'])('is true for %s', (url) => {
    expect(isPostgresUrl(url)).toBe(true);
  });

  it.each(['memory://', 'file:/data', '/data/pgdata', ''])('is false for the PGlite location "%s"', (url) => {
    expect(isPostgresUrl(url)).toBe(false);
  });
});
