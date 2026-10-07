import { type CountryCode, isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js';
import { ContactType } from './models/contact-infos.ts';

/** The contact types whose value is a telephone number. */
const NUMBER_TYPES: ReadonlySet<ContactType> = new Set([ContactType.Phone, ContactType.Fax]);

/** Everything in a written number that is not a digit. */
const NON_DIGITS = /\D/g;
/** What a number written with its country code starts with. */
const INTERNATIONAL_PREFIX = '+';

/**
 * Whether a word is a country libphonenumber knows.
 *
 * @param country - An ISO 3166-1 alpha-2 code, in upper case.
 * @returns True when numbers can be read as that country's.
 */
export function isPhoneCountry(country: string): country is CountryCode {
  return isSupportedCountry(country);
}

/**
 * Puts a telephone number in E.164 form (`+15550100123`). A number that cannot be one in the given
 * country keeps only its digits, and its `+` when it has one, so two spellings of it still match.
 *
 * @param value - The number as written.
 * @param country - The country a number without a country code is read as.
 * @returns The normalised number.
 */
function normalizePhone(value: string, country: string): string {
  const parsed = isPhoneCountry(country) ? parsePhoneNumberFromString(value, country) : undefined;
  if (parsed?.isPossible()) {
    return parsed.number;
  }
  const digits = value.replace(NON_DIGITS, '');
  const isInternational = value.trim().startsWith(INTERNATIONAL_PREFIX);
  return isInternational ? `${INTERNATIONAL_PREFIX}${digits}` : digits;
}

/**
 * Builds a contact detail's `normalizedValue`: the form two spellings of the same value share. A
 * phone or fax number becomes E.164; anything else is trimmed and lower-cased.
 *
 * @param type - What kind of detail it is.
 * @param value - The value as written.
 * @param country - The owner's default country, for numbers written without a country code.
 * @returns The normalised value.
 */
export function normalizeContactValue(type: ContactType, value: string, country: string): string {
  if (NUMBER_TYPES.has(type)) {
    return normalizePhone(value, country);
  }
  return value.trim().toLowerCase();
}

/**
 * Completes a contact detail that is about to be inserted with its `normalizedValue`.
 *
 * @typeParam Row - The row's shape, which names at least its type and value.
 * @param row - The contact detail.
 * @param country - The owner's default country.
 * @returns The row, with `normalizedValue` set.
 */
export function withNormalizedValue<Row extends { type: ContactType; value: string }>(
  row: Row,
  country: string,
): Row & { normalizedValue: string } {
  return { ...row, normalizedValue: normalizeContactValue(row.type, row.value, country) };
}
