import { describe, expect, it } from 'vitest';
import { initialsOf, personName, UNNAMED_PERSON } from '@/lib/person-name';

const email = { type: 'email', value: 'ada@example.com' };
const phone = { type: 'phone', value: '555-0100' };

describe('personName', () => {
  it('is the display name when there is one', () => {
    expect(personName({ displayName: 'Ada Lovelace', contactInfos: [email] })).toBe('Ada Lovelace');
  });

  it('falls back to the email address, then the phone number', () => {
    expect(personName({ displayName: '', contactInfos: [phone, email] })).toBe('ada@example.com');
    expect(personName({ displayName: '', contactInfos: [phone] })).toBe('555-0100');
  });

  it('is "Unnamed" for a person with nothing to be called by', () => {
    expect(personName({ displayName: '' })).toBe(UNNAMED_PERSON);
    expect(personName({ displayName: '', contactInfos: [] })).toBe(UNNAMED_PERSON);
  });
});

describe('initialsOf', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['Mary Ann van der Berg', 'MB'],
    ['Analytical Engines', 'AE'],
    ['Countess', 'C'],
    ['+1 555 0100', '10'],
    ['', ''],
  ])('reads %j as %j', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
