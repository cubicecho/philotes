import { AddressType, ContactKind, ContactType, ImportantDateKind } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';

// The shape a phone's contact arrives in. Only the words are checked here: the lengths, the names and
// the dates are checked by `saveCard`, with the same schemas every other write uses.

const text = z.string().nullable();

const contactInfo = z.object({
  type: z.enum(ContactType, 'Unknown contact type.'),
  value: z.string(),
  kind: z.enum(ContactKind, 'Unknown contact kind.').nullable(),
  label: text,
  isPrimary: z.boolean(),
});

const address = z.object({
  type: z.enum(AddressType, 'Unknown address type.'),
  label: text,
  line1: z.string(),
  line2: text,
  city: text,
  state: text,
  postalCode: text,
  country: text,
  isPrimary: z.boolean(),
});

const date = z.object({
  kind: z.enum(ImportantDateKind, 'Unknown date kind.'),
  name: z.string(),
  date: z.string(),
  hasYear: z.boolean(),
});

/** `ContactCardInput`, as `saveContactCard` takes it. */
export const contactCardInput = z.object({
  personId: z.uuid('Person not found').nullable(),
  ifRevision: z.number().int().nonnegative().nullable(),
  namePrefix: text,
  firstName: text,
  middleName: text,
  lastName: text,
  nameSuffix: text,
  nickname: text,
  organization: text,
  department: text,
  jobTitle: text,
  about: text,
  contactInfos: z.array(contactInfo),
  addresses: z.array(address),
  dates: z.array(date),
});

/** What a phone sends for one contact. */
export type ContactCardInput = z.infer<typeof contactCardInput>;

/** A `contactCards` cursor: the id of the last card of the page before. */
export const cursorInput = z.uuid('Unknown cursor.');
