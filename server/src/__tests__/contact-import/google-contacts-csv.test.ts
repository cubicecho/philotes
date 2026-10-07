import { describe, expect, it } from 'vitest';
import { parseGoogleContactsCsv } from '../../contact-import/google-contacts-csv.ts';

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

  it('reads the second address line from the Extended Address column', () => {
    const csv = [
      'First Name,Last Name,Address 1 - Street,Address 1 - Extended Address,Address 2 - Street',
      'Ada,Lovelace,1 Analytical Way,Flat 2,12 St James Square',
    ].join('\n');

    const { contacts } = parseGoogleContactsCsv(csv);

    expect(contacts[0].addresses.map(({ line1, line2 }) => [line1, line2])).toEqual([
      ['1 Analytical Way', 'Flat 2'],
      ['12 St James Square', ''],
    ]);
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
    const { contacts, skippedCount } = parseGoogleContactsCsv(csv);
    expect(contacts).toHaveLength(0);
    expect(skippedCount).toBe(1);
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
