import { AddressType, ContactKind, ContactType, ImportantDateKind } from '@cubicecho/philotes-db/schema';
import ICAL from 'ical.js';
import {
  type Card,
  type CardAddress,
  type CardContactInfo,
  type CardDate,
  type JCard,
  type JCardProperty,
  Param,
  PRODUCT_ID,
  Property,
  TypeWord,
  ValueType,
  VCARD_VERSION,
} from './card.ts';

// Cards to vCard 3.0 text, the version every phone reads. ical.js does the escaping and the line
// folding; this file decides which property each field becomes. It is the decoder read backwards:
// what one writes, the other reads to the same card.

const VCARD = 'vcard';
const LINE_BREAK = '\r\n';
/** The prefix of the groups the encoder makes. A group ties a property to its `X-ABLabel`. */
const GROUP_PREFIX = 'philotes';
const NAME_SEPARATOR = ' ';
/** The fraction of a second in an ISO timestamp, which `REV` leaves out. */
const MILLISECONDS = /\.\d{3}(?=Z$)/;

/** The `TYPE` word for each kind. */
const TYPE_WORD_BY_KIND: Readonly<Record<ContactKind, string>> = {
  [ContactKind.Home]: TypeWord.Home,
  [ContactKind.Work]: TypeWord.Work,
  [ContactKind.Mobile]: TypeWord.Mobile,
  [ContactKind.Other]: TypeWord.Other,
};

/** The `TYPE` word for each address type. */
const TYPE_WORD_BY_ADDRESS_TYPE: Readonly<Record<AddressType, string>> = {
  [AddressType.Home]: TypeWord.Home,
  [AddressType.Work]: TypeWord.Work,
  [AddressType.Other]: TypeWord.Other,
};

/** The property each contact type is written as, and its value's type. */
const CONTACT_PROPERTIES: Readonly<Record<ContactType, { name: Property; valueType: string; network?: string }>> = {
  [ContactType.Email]: { name: Property.Email, valueType: ValueType.Text },
  [ContactType.Phone]: { name: Property.Phone, valueType: ValueType.Phone },
  [ContactType.Fax]: { name: Property.Phone, valueType: ValueType.Phone },
  [ContactType.Im]: { name: Property.Messaging, valueType: ValueType.Uri },
  [ContactType.Website]: { name: Property.Url, valueType: ValueType.Uri },
  [ContactType.Linkedin]: { name: Property.SocialProfile, valueType: ValueType.Unknown, network: 'linkedin' },
  [ContactType.Twitter]: { name: Property.SocialProfile, valueType: ValueType.Unknown, network: 'twitter' },
  [ContactType.Instagram]: { name: Property.SocialProfile, valueType: ValueType.Unknown, network: 'instagram' },
  [ContactType.Other]: { name: Property.OtherContact, valueType: ValueType.Unknown },
};

/** The property each kind of date is written as. */
const DATE_PROPERTIES: Readonly<Record<ImportantDateKind, { name: Property; valueType: string }>> = {
  [ImportantDateKind.Birthday]: { name: Property.Birthday, valueType: ValueType.Date },
  [ImportantDateKind.Anniversary]: { name: Property.Anniversary, valueType: ValueType.Unknown },
  [ImportantDateKind.Other]: { name: Property.NamedDate, valueType: ValueType.Unknown },
};

/** The `TYPE` word a 3.0 photo names its image type by. */
const PHOTO_TYPE_BY_MEDIA_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
};

/** What may be said about a card that the card itself does not hold. */
export interface WriteOptions {
  /** When the person last changed, written as `REV`. */
  revisedAt?: Date;
}

/** Hands out group names that no property kept in `extra` already uses. */
interface Groups {
  taken: Set<string>;
  next: number;
}

/**
 * Takes the next free group name.
 *
 * @param groups - The names in use.
 * @returns A name nothing else on the card has.
 */
function nextGroup(groups: Groups): string {
  let group: string;
  do {
    groups.next += 1;
    group = `${GROUP_PREFIX}${groups.next}`;
  } while (groups.taken.has(group));
  return group;
}

/**
 * Writes a property, and its label through a group when it has one.
 *
 * @param groups - The group names in use.
 * @param property - The property, without a group.
 * @param label - The card's own name for it, or null.
 * @returns The property, followed by its `X-ABLabel` when labelled.
 */
function withLabel(groups: Groups, property: JCardProperty, label: string | null): JCardProperty[] {
  if (label === null) {
    return [property];
  }
  const group = nextGroup(groups);
  const [name, params, type, ...values] = property;
  return [
    [name, { ...params, [Param.Group]: group }, type, ...values],
    [Property.GroupLabel, { [Param.Group]: group }, ValueType.Unknown, label],
  ];
}

/**
 * Builds a `TYPE` parameter from its words.
 *
 * @param words - The words, any of which may be absent.
 * @returns The parameters: empty when there are no words.
 */
function typeParams(words: Array<string | null | false>): Record<string, string | string[]> {
  const present = words.filter((word) => typeof word === 'string').map((word) => word.toUpperCase());
  return present.length > 0 ? { [Param.Type]: present } : {};
}

/**
 * Writes one way to reach the person.
 *
 * @param groups - The group names in use.
 * @param info - The detail.
 * @returns Its property, and its label's.
 */
function contactInfoProperties(groups: Groups, info: CardContactInfo): JCardProperty[] {
  const { name, valueType, network } = CONTACT_PROPERTIES[info.type];
  const params = typeParams([
    info.type === ContactType.Email && TypeWord.Internet,
    info.type === ContactType.Fax && TypeWord.Fax,
    network ?? null,
    info.kind === null ? null : TYPE_WORD_BY_KIND[info.kind],
    info.isPrimary && TypeWord.Preferred,
  ]);
  return withLabel(groups, [name, params, valueType, info.value], info.label);
}

/**
 * Writes one postal address.
 *
 * @param groups - The group names in use.
 * @param address - The address.
 * @returns Its `ADR` property, and its label's.
 */
function addressProperties(groups: Groups, address: CardAddress): JCardProperty[] {
  const params = typeParams([TYPE_WORD_BY_ADDRESS_TYPE[address.type], address.isPrimary && TypeWord.Preferred]);
  // The seven parts of ADR. The first, a post office box, is never written.
  const parts = [
    '',
    address.line2 ?? '',
    address.line1,
    address.city ?? '',
    address.state ?? '',
    address.postalCode ?? '',
    address.country ?? '',
  ];
  return withLabel(groups, [Property.Address, params, ValueType.Text, parts], address.label);
}

/**
 * Writes one date. A day with no year is written the way Apple does, which Android reads too: the
 * placeholder year, and a parameter that says to ignore it.
 *
 * @param groups - The group names in use.
 * @param date - The date.
 * @returns Its property, and the label that names a date which is neither a birthday nor an anniversary.
 */
function dateProperties(groups: Groups, date: CardDate): JCardProperty[] {
  const { name, valueType } = DATE_PROPERTIES[date.kind];
  const [year] = date.date.split('-');
  const params: Record<string, string> = date.hasYear ? {} : { [Param.OmitYear]: year };
  const label = date.kind === ImportantDateKind.Other ? date.name : null;
  return withLabel(groups, [name, params, valueType, date.date], label);
}

/**
 * Reads the properties a card keeps as they were sent.
 *
 * @param extra - The JSON in `Card.extra`.
 * @returns The properties, or none when the JSON is not a list of them.
 */
function extraProperties(extra: string | null): JCardProperty[] {
  if (extra === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extra);
  } catch {
    return [];
  }
  const items: unknown[] = Array.isArray(parsed) ? parsed : [];
  return items.filter(
    (item): item is JCardProperty => Array.isArray(item) && typeof item[0] === 'string' && typeof item[2] === 'string',
  );
}

/**
 * Works out what a card's person is called, for `FN`, which a vCard must have.
 *
 * @param card - The card.
 * @returns The name, else the nickname, else the organization, else the first way to reach them.
 */
export function formattedNameOf(card: Card): string {
  const name = [card.namePrefix, card.firstName, card.middleName, card.lastName, card.nameSuffix]
    .filter(Boolean)
    .join(NAME_SEPARATOR);
  return name || card.nickname || card.organization || card.contactInfos[0]?.value || '';
}

/**
 * Builds a card's jCard.
 *
 * @param card - The card.
 * @param options - What else to say about it.
 * @returns The jCard, ready for ical.js to write.
 */
function toJCard(card: Card, options: WriteOptions): JCard {
  const extra = extraProperties(card.extra);
  const taken = extra.map(([, params]) => params[Param.Group]).filter((group) => typeof group === 'string');
  const groups: Groups = { taken: new Set(taken.map((group) => group.toLowerCase())), next: 0 };
  const text = (name: Property, value: string | null): JCardProperty[] =>
    value === null ? [] : [[name, {}, ValueType.Text, value]];

  const properties: JCardProperty[] = [
    [Property.Version, {}, ValueType.Text, VCARD_VERSION],
    [Property.ProductId, {}, ValueType.Text, PRODUCT_ID],
    ...text(Property.Uid, card.uid),
    [Property.FormattedName, {}, ValueType.Text, formattedNameOf(card)],
    [
      Property.Name,
      {},
      ValueType.Text,
      [card.lastName ?? '', card.firstName ?? '', card.middleName ?? '', card.namePrefix ?? '', card.nameSuffix ?? ''],
    ],
    ...text(Property.Nickname, card.nickname),
  ];
  if (card.organization !== null || card.department !== null) {
    const units = card.department === null ? [] : [card.department];
    properties.push([Property.Organization, {}, ValueType.Text, [card.organization ?? '', ...units]]);
  }
  properties.push(
    ...text(Property.Title, card.jobTitle),
    ...text(Property.Note, card.about),
    ...card.contactInfos.flatMap((info) => contactInfoProperties(groups, info)),
    ...card.addresses.flatMap((address) => addressProperties(groups, address)),
    ...card.dates.flatMap((date) => dateProperties(groups, date)),
  );
  if (card.labels.length > 0) {
    properties.push([Property.Categories, {}, ValueType.Text, ...card.labels]);
  }
  if (card.photo !== null) {
    const type = PHOTO_TYPE_BY_MEDIA_TYPE[card.photo.mediaType] ?? card.photo.mediaType;
    const params = { [Param.Encoding]: 'b', [Param.Type]: type };
    properties.push([Property.Photo, params, ValueType.Binary, card.photo.data.toString('base64')]);
  }
  if (options.revisedAt !== undefined) {
    properties.push([
      Property.Revision,
      {},
      ValueType.DateTime,
      options.revisedAt.toISOString().replace(MILLISECONDS, ''),
    ]);
  }
  return [VCARD, [...properties, ...extra], []];
}

/**
 * Writes one card as vCard 3.0 text.
 *
 * @param card - The card.
 * @param options - What else to say about it.
 * @returns The text, from `BEGIN:VCARD` to `END:VCARD`, with no line break after it.
 */
export function writeVCard(card: Card, options: WriteOptions = {}): string {
  return ICAL.stringify.component(toJCard(card, options), ICAL.design.vcard3);
}

/**
 * Writes several cards as one `.vcf` file.
 *
 * @param cards - The cards, each with what else to say about it.
 * @returns The file's text, or an empty string for no cards.
 */
export function writeVCards(cards: Array<{ card: Card; options?: WriteOptions }>): string {
  const texts = cards.map(({ card, options }) => writeVCard(card, options));
  return texts.length > 0 ? `${texts.join(LINE_BREAK)}${LINE_BREAK}` : '';
}
