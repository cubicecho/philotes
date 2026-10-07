import type { AddressType, ContactKind, ContactType, ImportantDateKind } from '@cubicecho/philotes-db/schema';

// What a contact card says about a person, as plain data. The decoder makes one from a vCard, the
// encoder writes one out, and `store.ts` moves it to and from the database. Nothing here knows about
// either end.

/** A way to reach the person: an email address, a number, a web address or a handle. */
export interface CardContactInfo {
  type: ContactType;
  value: string;
  /** Home, work or mobile, when the card says. */
  kind: ContactKind | null;
  /** The card's own name for the detail, such as "Boat". */
  label: string | null;
  isPrimary: boolean;
}

/** A postal address. */
export interface CardAddress {
  type: AddressType;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPrimary: boolean;
}

/** A day that is the person's own: a birthday, an anniversary or a named date. */
export interface CardDate {
  kind: ImportantDateKind;
  name: string;
  /** `YYYY-MM-DD`. The year is `YEARLESS_DATE_YEAR` when `hasYear` is false. */
  date: string;
  hasYear: boolean;
}

/** The person's picture. */
export interface CardPhoto {
  /** Such as `image/jpeg`. */
  mediaType: string;
  data: Buffer;
}

/** Everything a contact card carries about one person. */
export interface Card {
  /** The id the phone knows the contact by, or null when the card gives none. */
  uid: string | null;
  namePrefix: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  organization: string | null;
  department: string | null;
  jobTitle: string | null;
  /** The card's note. */
  about: string | null;
  contactInfos: CardContactInfo[];
  addresses: CardAddress[];
  dates: CardDate[];
  /** The names of the person's labels, which a card calls categories. */
  labels: string[];
  photo: CardPhoto | null;
  /**
   * The properties Philotes has no field for, as JSON: an array of jCard properties. Kept so that a
   * phone's own fields survive a round trip, and read only by the encoder.
   */
  extra: string | null;
}

/** One jCard property: its name, its parameters, its value type and its values. */
export type JCardProperty = [
  name: string,
  params: Record<string, string | string[]>,
  type: string,
  ...values: unknown[],
];

/** One jCard: the word `vcard`, its properties and its (unused) children. */
export type JCard = [name: string, properties: JCardProperty[], children: unknown[]];

/** The vCard property names the codec reads or writes, in jCard's lower case. */
export const Property = {
  Version: 'version',
  ProductId: 'prodid',
  Uid: 'uid',
  Revision: 'rev',
  FormattedName: 'fn',
  Name: 'n',
  Nickname: 'nickname',
  Organization: 'org',
  Title: 'title',
  Note: 'note',
  Email: 'email',
  Phone: 'tel',
  Url: 'url',
  Messaging: 'impp',
  SocialProfile: 'x-socialprofile',
  OtherContact: 'x-philotes-contact',
  Address: 'adr',
  Birthday: 'bday',
  Anniversary: 'anniversary',
  LegacyAnniversary: 'x-anniversary',
  NamedDate: 'x-abdate',
  Categories: 'categories',
  Photo: 'photo',
  GroupLabel: 'x-ablabel',
} as const;
export type Property = (typeof Property)[keyof typeof Property];

/** The parameter names the codec reads or writes. `group` is jCard's place for a property's group. */
export const Param = {
  Type: 'type',
  Preference: 'pref',
  Group: 'group',
  Encoding: 'encoding',
  OmitYear: 'x-apple-omit-year',
} as const;

/** The words a `TYPE` parameter uses, lower-cased. */
export const TypeWord = {
  Preferred: 'pref',
  Home: 'home',
  Work: 'work',
  Mobile: 'cell',
  Other: 'other',
  Fax: 'fax',
  Internet: 'internet',
  Voice: 'voice',
} as const;

/** jCard's names for the value types the codec writes. */
export const ValueType = {
  Text: 'text',
  Uri: 'uri',
  Date: 'date',
  DateTime: 'date-time',
  Binary: 'binary',
  Phone: 'phone-number',
  Unknown: 'unknown',
} as const;

/** What a birthday and an anniversary are named when a card gives them no name of their own. */
export const BIRTHDAY_NAME = 'Birthday';
export const ANNIVERSARY_NAME = 'Anniversary';

/** The vCard version written. */
export const VCARD_VERSION = '3.0';
/** Who wrote the card. */
export const PRODUCT_ID = '-//Philotes//Philotes//EN';

/** Thrown when text is not a vCard, or holds one that cannot be read. */
export class VCardSyntaxError extends Error {
  override name = 'VCardSyntaxError';
}

/**
 * Builds a card with nothing on it.
 *
 * @returns The card.
 */
export function emptyCard(): Card {
  return {
    uid: null,
    namePrefix: null,
    firstName: null,
    middleName: null,
    lastName: null,
    nameSuffix: null,
    nickname: null,
    organization: null,
    department: null,
    jobTitle: null,
    about: null,
    contactInfos: [],
    addresses: [],
    dates: [],
    labels: [],
    photo: null,
    extra: null,
  };
}
