import { ContactFrequency } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { ADDRESS_DEFAULTS, CONTACT_INFO_DEFAULTS, PERSON_DEFAULTS } from '../core/defaults.ts';

/**
 * Builds the schema for one of a person's names: trimmed, not empty and within the name length.
 *
 * @param label - What the field is called in the messages, such as "First name".
 * @returns The zod schema.
 */
const nameSchema = (label: string) =>
  z.string().trim().min(1, `${label} cannot be empty.`).max(PERSON_DEFAULTS.maxNameLength, `${label} is too long.`);
const emailSchema = z
  .string()
  .trim()
  .max(PERSON_DEFAULTS.maxEmailLength, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'))
  .nullable();

/** Partial, since an update's `set` carries only the changed columns. */
export const personInput = z
  .object({ firstName: nameSchema('First name'), lastName: nameSchema('Last name'), email: emailSchema })
  .partial();

/** What a user keeps about a person in their contacts. */
export const userPersonInput = z
  .object({
    contactFrequency: z.enum(ContactFrequency, 'Choose weekly, monthly, quarterly or yearly.').nullable(),
    howWeMet: z.string().max(PERSON_DEFAULTS.maxHowWeMetLength, 'How we met is too long.').nullable(),
    firstMetDate: z.iso.date('First met date must be a day, as YYYY-MM-DD.').nullable(),
    avatarPath: z.string().max(PERSON_DEFAULTS.maxAvatarPathLength, 'Avatar path is too long.').nullable(),
  })
  .partial();

/**
 * Builds the schema for a part of an address that may be null, such as the city.
 *
 * @param label - What the part is called in the message.
 * @returns The zod schema.
 */
const addressPart = (label: string) =>
  z.string().max(ADDRESS_DEFAULTS.maxPartLength, `${label} is too long.`).nullable();

/** What an address may hold. Partial, since an update's `set` carries only the changed columns. */
export const addressInput = z
  .object({
    label: addressPart('Label'),
    line1: z
      .string()
      .trim()
      .min(1, 'Address line 1 cannot be empty.')
      .max(ADDRESS_DEFAULTS.maxLineLength, 'Address line 1 is too long.'),
    line2: z.string().max(ADDRESS_DEFAULTS.maxLineLength, 'Address line 2 is too long.').nullable(),
    city: addressPart('City'),
    state: addressPart('State'),
    postalCode: z.string().max(ADDRESS_DEFAULTS.maxPostalCodeLength, 'Postal code is too long.').nullable(),
    country: addressPart('Country'),
  })
  .partial();

/** What a contact detail may hold. Partial, since an update's `set` carries only the changed columns. */
export const contactInfoInput = z
  .object({
    value: z
      .string()
      .trim()
      .min(1, 'Value cannot be empty.')
      .max(CONTACT_INFO_DEFAULTS.maxValueLength, 'Value is too long.'),
    label: z.string().max(CONTACT_INFO_DEFAULTS.maxLabelLength, 'Label is too long.').nullable(),
  })
  .partial();
