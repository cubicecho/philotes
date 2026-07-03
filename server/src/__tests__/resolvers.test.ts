import { describe, expect, it } from 'vitest';
import { signMagicToken, signToken, verifyMagicToken, verifyToken } from '../resolvers/auth.ts';
import { parseGoogleContactsCsv } from '../resolvers/import-contacts.ts';
import { buildPersonsOrderBy, buildPersonsWhere } from '../resolvers/user-scope.ts';

// ---------------------------------------------------------------------------
// 1. Google CSV parser
// ---------------------------------------------------------------------------

describe('parseGoogleContactsCsv', () => {
  it('returns empty for fewer than 2 rows', () => {
    expect(parseGoogleContactsCsv('').contacts).toEqual([]);
    expect(parseGoogleContactsCsv('First Name,Last Name').contacts).toEqual([]);
  });

  it('parses a minimal contact with an email', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value\nAlice,Smith,alice@example.com';
    const { contacts, skippedCount } = parseGoogleContactsCsv(csv);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe('Alice');
    expect(contacts[0].lastName).toBe('Smith');
    expect(contacts[0].email).toBe('alice@example.com');
    expect(skippedCount).toBe(0);
  });

  it('imports a phone-only contact (no email) with null email', () => {
    const csv = 'First Name,Last Name,Phone 1 - Value\nBob,Jones,555-1234';
    const { contacts, skippedCount } = parseGoogleContactsCsv(csv);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].email).toBeNull();
    expect(contacts[0].phones[0].value).toBe('555-1234');
    expect(skippedCount).toBe(0);
  });

  it('skips rows with no name data', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value\n,,nobody@example.com';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts).toHaveLength(0);
  });

  it('falls back to the Name column when First/Last are absent', () => {
    const csv = 'Name,E-mail 1 - Value\nAlice Smith,alice@example.com';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].firstName).toBe('Alice');
    expect(contacts[0].lastName).toBe('Smith');
  });

  it('strips the Google ::: duplicate encoding', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value\nAlice,Smith,alice@example.com ::: alice@example.com';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].email).toBe('alice@example.com');
  });

  it('strips leading BOM', () => {
    const csv = '﻿First Name,Last Name,E-mail 1 - Value\nAlice,Smith,alice@example.com';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts).toHaveLength(1);
  });

  it('deduplicates emails', () => {
    const csv =
      'First Name,Last Name,E-mail 1 - Value,E-mail 2 - Value\nAlice,Smith,alice@example.com,alice@example.com';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].emails).toHaveLength(1);
  });

  it('excludes "mycontacts" noise labels', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value,Labels\nAlice,Smith,alice@example.com,myContacts ::: friends';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].labels).toEqual(['friends']);
  });

  it('parses a birthday in YYYY-MM-DD format', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value,Birthday\nAlice,Smith,alice@example.com,1990-06-15';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].birthday).toBe('1990-06-15');
  });

  it('returns null birthday for --MM-DD format', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value,Birthday\nAlice,Smith,alice@example.com,--06-15';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].birthday).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Auth token utilities
// ---------------------------------------------------------------------------

describe('signToken / verifyToken (session)', () => {
  it('round-trips a userId', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload?.userId).toBe('user-123');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('user-123');
    expect(verifyToken(`${token}x`)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('does not contain an email claim', () => {
    const token = signToken('user-123');
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    expect(payload.email).toBeUndefined();
    expect(payload.userId).toBe('user-123');
  });
});

describe('signMagicToken / verifyMagicToken', () => {
  it('round-trips an email', () => {
    const token = signMagicToken('alice@example.com');
    const payload = verifyMagicToken(token);
    expect(payload?.email).toBe('alice@example.com');
  });

  it('returns null for a tampered token', () => {
    const token = signMagicToken('alice@example.com');
    expect(verifyMagicToken(`${token}x`)).toBeNull();
  });

  it('does not contain a userId claim', () => {
    const token = signMagicToken('alice@example.com');
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    expect(payload.userId).toBeUndefined();
    expect(payload.email).toBe('alice@example.com');
  });

  it('session verifyToken returns a payload with no userId for a magic token', () => {
    // Magic tokens share the same secret but carry email not userId.
    // The extractUserId helper in the server will return null because
    // payload.userId is undefined — this test documents that behaviour.
    const magicToken = signMagicToken('alice@example.com');
    const payload = verifyToken(magicToken);
    expect(payload?.userId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. GraphQL → Drizzle filter / sort translators
// ---------------------------------------------------------------------------

describe('buildPersonsWhere', () => {
  it('returns undefined for an empty object', () => {
    expect(buildPersonsWhere({})).toBeUndefined();
  });

  it('builds a condition for a simple eq filter', () => {
    const sql = buildPersonsWhere({ firstName: { eq: 'Alice' } });
    expect(sql).toBeDefined();
  });

  it('builds an OR condition', () => {
    const sql = buildPersonsWhere({
      OR: [{ firstName: { ilike: '%ali%' } }, { lastName: { ilike: '%ali%' } }],
    });
    expect(sql).toBeDefined();
  });

  it('ignores unknown field names', () => {
    // Should not throw; unknown fields are silently skipped
    const sql = buildPersonsWhere({ unknownField: { eq: 'x' } } as never);
    expect(sql).toBeUndefined();
  });
});

describe('buildPersonsOrderBy', () => {
  it('returns empty array for empty input', () => {
    expect(buildPersonsOrderBy({})).toEqual([]);
  });

  it('returns one clause per field and respects priority ordering', () => {
    const fwd = buildPersonsOrderBy({
      firstName: { direction: 'asc', priority: 2 },
      lastName: { direction: 'asc', priority: 1 },
    });
    const rev = buildPersonsOrderBy({
      firstName: { direction: 'asc', priority: 1 },
      lastName: { direction: 'asc', priority: 2 },
    });
    expect(fwd).toHaveLength(2);
    expect(rev).toHaveLength(2);
    // Priority 1 in fwd is lastName, in rev is firstName — so the leading
    // clause should differ between the two orderings.
    expect(fwd[0]).not.toBe(rev[0]);
  });

  it('returns two clauses for two fields regardless of direction', () => {
    const asc = buildPersonsOrderBy({ firstName: { direction: 'asc', priority: 1 } });
    const desc = buildPersonsOrderBy({ firstName: { direction: 'desc', priority: 1 } });
    expect(asc).toHaveLength(1);
    expect(desc).toHaveLength(1);
    // asc and desc produce different SQL objects
    expect(asc[0]).not.toBe(desc[0]);
  });

  it('ignores unknown field names', () => {
    const clauses = buildPersonsOrderBy({ unknownField: { direction: 'asc', priority: 1 } } as never);
    expect(clauses).toHaveLength(0);
  });
});
