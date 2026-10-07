import { describe, expect, it } from 'vitest';
import { ContactType } from '../models/contact-infos.ts';
import { isPhoneCountry, normalizeContactValue, withNormalizedValue } from '../normalize.ts';

describe('normalizeContactValue', () => {
  it.each([
    ['(212) 555-0100', 'US', '+12125550100'],
    ['212.555.0100', 'US', '+12125550100'],
    ['1 212 555 0100', 'US', '+12125550100'],
    ['+1 212-555-0100', 'GB', '+12125550100'],
    ['020 7946 0958', 'GB', '+442079460958'],
    ['+44 20 7946 0958', 'US', '+442079460958'],
  ])('reads the phone number %s in %s as %s', (value, country, expected) => {
    expect(normalizeContactValue(ContactType.Phone, value, country)).toBe(expected);
  });

  it.each([
    ['555-0100', 'US', '5550100'],
    ['ext. 42', 'US', '42'],
    ['+999 1', 'US', '+9991'],
    ['(212) 555-0100', 'ZZ', '2125550100'],
  ])('keeps the digits of %s, which is no number in %s', (value, country, expected) => {
    expect(normalizeContactValue(ContactType.Phone, value, country)).toBe(expected);
  });

  it('reads a fax number as it does a phone number', () => {
    expect(normalizeContactValue(ContactType.Fax, '(212) 555-0199', 'US')).toBe('+12125550199');
  });

  it.each([ContactType.Email, ContactType.Im, ContactType.Website, ContactType.Other])(
    'trims and lower-cases a value of type %s',
    (type) => {
      expect(normalizeContactValue(type, '  Ada@Example.COM ', 'US')).toBe('ada@example.com');
    },
  );
});

describe('withNormalizedValue', () => {
  it('adds the normalized value and keeps the rest of the row', () => {
    const row = { type: ContactType.Phone, value: '212-555-0100', label: 'Desk' };

    expect(withNormalizedValue(row, 'US')).toEqual({ ...row, normalizedValue: '+12125550100' });
  });
});

describe('isPhoneCountry', () => {
  it('knows a country by its upper-case two-letter code only', () => {
    expect(isPhoneCountry('US')).toBe(true);
    expect(isPhoneCountry('us')).toBe(false);
    expect(isPhoneCountry('ZZ')).toBe(false);
  });
});
