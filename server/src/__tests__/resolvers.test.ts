import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Inline re-export of the pure CSV parsing utilities so we can unit-test
// them without spinning up a DB or GraphQL server.
// ---------------------------------------------------------------------------

// The functions below are extracted verbatim from import-contacts.ts.
// If that file is refactored, keep these in sync.

function stripGoogleDuplicate(s: string): string {
  const idx = s.indexOf(' ::: ');
  return idx !== -1 ? s.slice(0, idx).trim() : s.trim();
}

function normalizeHyphens(s: string): string {
  return s.replace(/[‐‑‒–]/g, '-');
}

function parseBirthday(raw: string): string | null {
  if (!raw) return null;
  if (raw.startsWith('--')) return null;
  if (raw.startsWith('0000-')) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  if (Number(match[1]) === 0) return null;
  return raw;
}

// ---------------------------------------------------------------------------

describe('stripGoogleDuplicate', () => {
  it('returns the first part when \" ::: \" is present', () => {
    expect(stripGoogleDuplicate('foo ::: bar')).toBe('foo');
  });
  it('returns the whole string when no separator', () => {
    expect(stripGoogleDuplicate('hello')).toBe('hello');
  });
  it('trims whitespace', () => {
    expect(stripGoogleDuplicate('  hello  ')).toBe('hello');
  });
});

describe('normalizeHyphens', () => {
  it('replaces Unicode hyphen variants with ASCII hyphen', () => {
    expect(normalizeHyphens('‐‑‒–')).toBe('----');
  });
  it('leaves regular hyphens untouched', () => {
    expect(normalizeHyphens('555-1234')).toBe('555-1234');
  });
});

describe('parseBirthday', () => {
  it('returns null for empty string', () => {
    expect(parseBirthday('')).toBeNull();
  });
  it('returns null for --MM-DD format (no year)', () => {
    expect(parseBirthday('--03-15')).toBeNull();
  });
  it('returns null for 0000-MM-DD format', () => {
    expect(parseBirthday('0000-03-15')).toBeNull();
  });
  it('returns the date string for valid YYYY-MM-DD', () => {
    expect(parseBirthday('1990-03-15')).toBe('1990-03-15');
  });
  it('returns null for non-matching format', () => {
    expect(parseBirthday('March 15')).toBeNull();
  });
});
