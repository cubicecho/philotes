import { ContactFrequency, ContactKind } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { ADDRESS_DEFAULTS, CONTACT_INFO_DEFAULTS, PERSON_DEFAULTS } from '../core/defaults.ts';

/**
 * Builds the schema for one of a person's short texts, such as a name or a job title: trimmed, within
 * the name length, and null when nothing is left.
 *
 * @param label - What the field is called in the message, such as "First name".
 * @returns The zod schema.
 */
const namePart = (label: string) =>
  z
    .string()
    .trim()
    .max(PERSON_DEFAULTS.maxNameLength, `${label} is too long.`)
    .nullable()
    .transform((value) => value || null);

/**
 * What a person may hold. Partial, since an update's `set` carries only the changed columns. The avatar is
 * not here: only the upload route sets it.
 */
export const personInput = z
  .object({
    namePrefix: namePart('Prefix'),
    firstName: namePart('First name'),
    middleName: namePart('Middle name'),
    lastName: namePart('Last name'),
    nameSuffix: namePart('Suffix'),
    nickname: namePart('Nickname'),
    organization: namePart('Organization'),
    jobTitle: namePart('Job title'),
    department: namePart('Department'),
    about: z.string().max(PERSON_DEFAULTS.maxAboutLength, 'About is too long.').nullable(),
    contactFrequency: z.enum(ContactFrequency, 'Choose weekly, monthly, quarterly or yearly.').nullable(),
    howWeMet: z.string().max(PERSON_DEFAULTS.maxHowWeMetLength, 'How we met is too long.').nullable(),
    firstMetDate: z.iso.date('First met date must be a day, as YYYY-MM-DD.').nullable(),
  })
  .partial();

/** The columns that can name a person. A new person needs one of them. */
export const NAMING_KEYS = ['firstName', 'lastName', 'nickname', 'organization'] as const;

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
    kind: z.enum(ContactKind, 'Choose home, work, mobile or other.').nullable(),
  })
  .partial();
