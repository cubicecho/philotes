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

  it('keeps the case of a label and drops a repeat that differs only by case', () => {
    const csv = 'First Name,Last Name,Labels\nAlice,Smith,* Book Club ::: book club ::: NYC';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].labels).toEqual(['Book Club', 'NYC']);
  });

  it('parses a birthday in YYYY-MM-DD format', () => {
    const csv = 'First Name,Last Name,E-mail 1 - Value,Birthday\nAlice,Smith,alice@example.com,1990-06-15';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].birthday).toBe('1990-06-15');
  });

  it('says a full birthday has its year', () => {
    const csv = 'First Name,Birthday\nAlice,1990-06-15';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].birthdayHasYear).toBe(true);
  });

  it.each(['--06-15', '0000-06-15'])('keeps the month and day of the yearless birthday %s', (cell) => {
    const csv = `First Name,Birthday\nAlice,${cell}`;
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0]).toMatchObject({ birthday: '1604-06-15', birthdayHasYear: false });
  });

  it('has no birthday for a cell in another form', () => {
    const csv = 'First Name,Birthday\nAlice,June 15';
    const { contacts } = parseGoogleContactsCsv(csv);
    expect(contacts[0].birthday).toBeNull();
  });

  it('reads the rest of the name, the work fields and the notes', () => {
    const csv = [
      'Name Prefix,First Name,Middle Name,Last Name,Name Suffix,Nickname,Organization Name,Organization Title,Organization Department,Notes',
      'Dr.,Grace,Brewster,Hopper,PhD,Amazing Grace,US Navy,Rear Admiral,Computing,Found the first bug',
    ].join('\n');

    const { contacts } = parseGoogleContactsCsv(csv);

    expect(contacts[0]).toMatchObject({
      namePrefix: 'Dr.',
      firstName: 'Grace',
      middleName: 'Brewster',
      lastName: 'Hopper',
      nameSuffix: 'PhD',
      nickname: 'Amazing Grace',
      organization: 'US Navy',
      jobTitle: 'Rear Admiral',
      department: 'Computing',
      about: 'Found the first bug',
    });
  });

  it('keeps a contact that has only an organization or a nickname, and skips one with neither', () => {
    const csv = [
      'First Name,Nickname,Organization Name,Phone 1 - Value',
      ',,Analytical Engines,555-0100',
      ',Countess,,555-0101',
      ',,,555-0102',
    ].join('\n');

    const { contacts, skippedCount } = parseGoogleContactsCsv(csv);

    expect(contacts.map((contact) => contact.organization || contact.nickname)).toEqual([
      'Analytical Engines',
      'Countess',
    ]);
    expect(skippedCount).toBe(1);
  });
});
