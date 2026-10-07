import {
  AddressType,
  ContactKind,
  ContactType,
  ImportantDateKind,
  YEARLESS_DATE_YEAR,
} from '@cubicecho/philotes-db/schema';
import ICAL from 'ical.js';
import {
  ANNIVERSARY_NAME,
  BIRTHDAY_NAME,
  type Card,
  type CardDate,
  type CardPhoto,
  emptyCard,
  type JCard,
  type JCardProperty,
  Param,
  Property,
  TypeWord,
  ValueType,
  VCardSyntaxError,
} from './card.ts';

// vCard text to cards. ical.js does the parsing (line folding, escaping, vCard 3.0 and 4.0); this
// file decides what each property means to Philotes. A property with no meaning here is kept in
// `extra` exactly as parsed, so the encoder can send it back.

const VCARD = 'vcard';
const DATA_URI = /^data:([^;,]+);base64,(.*)$/s;
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
/** A date with no year, as vCard 4.0 writes it: `--03-04` or `--0304`. */
const YEARLESS_DATE = /^--(\d{2})-?(\d{2})$/;
/** Apple wraps its built-in labels: `_$!<Other>!$_`. */
const APPLE_LABEL = /^_\$!<(.*)>!\$_$/;
const TEL_SCHEME = /^tel:/i;
const IM_SCHEME = /^im:/i;
const LIST_SEPARATOR = ', ';

/** The properties the decoder drops: each is worked out again when the card is written. */
const REGENERATED = new Set<string>([Property.Version, Property.ProductId, Property.Revision, Property.FormattedName]);

/** The kind a `TYPE` word names. */
const KIND_BY_TYPE_WORD: Readonly<Record<string, ContactKind>> = {
  [TypeWord.Home]: ContactKind.Home,
  [TypeWord.Work]: ContactKind.Work,
  [TypeWord.Mobile]: ContactKind.Mobile,
  [TypeWord.Other]: ContactKind.Other,
};

/** The address type a `TYPE` word names. */
const ADDRESS_TYPE_BY_TYPE_WORD: Readonly<Record<string, AddressType>> = {
  [TypeWord.Home]: AddressType.Home,
  [TypeWord.Work]: AddressType.Work,
};

/** The contact type a social profile's `TYPE` names. Any other profile is kept in `extra`. */
const SOCIAL_TYPES: Readonly<Record<string, ContactType>> = {
  linkedin: ContactType.Linkedin,
  twitter: ContactType.Twitter,
  instagram: ContactType.Instagram,
};

/** The image types a `TYPE` parameter names by their short word. */
const MEDIA_TYPE_BY_WORD: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** What a date property is, and what it is called when the card does not say. */
const DATE_PROPERTIES: Readonly<Record<string, { kind: ImportantDateKind; name: string }>> = {
  [Property.Birthday]: { kind: ImportantDateKind.Birthday, name: BIRTHDAY_NAME },
  [Property.Anniversary]: { kind: ImportantDateKind.Anniversary, name: ANNIVERSARY_NAME },
  [Property.LegacyAnniversary]: { kind: ImportantDateKind.Anniversary, name: ANNIVERSARY_NAME },
  [Property.NamedDate]: { kind: ImportantDateKind.Other, name: 'Date' },
};

/**
 * Reads a value as text.
 *
 * @param value - One jCard value: a string, or a list where a component holds several.
 * @returns The trimmed text, a list joined with spaces, or null when there is none.
 */
function textOf(value: unknown): string | null {
  const parts = Array.isArray(value) ? value : [value];
  const text = parts
    .filter((part) => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  return text || null;
}

/**
 * Reads the components of a structured value, such as a name or an address.
 *
 * @param property - The property.
 * @returns Each component as text, or null where it is empty.
 */
function componentsOf(property: JCardProperty): Array<string | null> {
  const [, , , value] = property;
  const components: unknown[] = Array.isArray(value) ? value : [value];
  return components.map(textOf);
}

/**
 * Reads the words of a property's `TYPE` parameter, with `pref` added for a 4.0 `PREF`.
 *
 * @param property - The property.
 * @returns The words, lower-cased.
 */
function typeWordsOf(property: JCardProperty): string[] {
  const [, params] = property;
  const words = [params[Param.Type] ?? []].flat().flatMap((word) => word.toLowerCase().split(','));
  const isPreferred = params[Param.Preference] !== undefined;
  return isPreferred ? [...words, TypeWord.Preferred] : words;
}

/**
 * Reads a property's group, which ties it to the label of the same group.
 *
 * @param property - The property.
 * @returns The group, lower-cased, or null when it has none.
 */
function groupOf(property: JCardProperty): string | null {
  const group = property[1][Param.Group];
  return typeof group === 'string' ? group.toLowerCase() : null;
}

/**
 * Reads a date property's day.
 *
 * @param property - A birthday, an anniversary or a named date.
 * @returns The day and whether its year is known, or null when the value is not a day (free text, or
 * a year and month alone).
 */
function dayOf(property: JCardProperty): Pick<CardDate, 'date' | 'hasYear'> | null {
  const value = textOf(property[3]) ?? '';
  const yearless = YEARLESS_DATE.exec(value);
  if (yearless) {
    return { date: `${YEARLESS_DATE_YEAR}-${yearless[1]}-${yearless[2]}`, hasYear: false };
  }
  const full = FULL_DATE.exec(value);
  if (!full) {
    return null;
  }
  const [date, year] = full;
  const isYearOmitted = property[1][Param.OmitYear] !== undefined || Number(year) === YEARLESS_DATE_YEAR;
  if (isYearOmitted) {
    return { date: `${YEARLESS_DATE_YEAR}${date.slice(year.length)}`, hasYear: false };
  }
  return { date, hasYear: true };
}

/**
 * Reads a picture that the card holds itself.
 *
 * @param property - The photo property.
 * @returns The picture, or null when the card only links to one or its type is not an image's.
 */
function photoOf(property: JCardProperty): CardPhoto | null {
  const [, params, type, value] = property;
  if (typeof value !== 'string') {
    return null;
  }
  const embedded = DATA_URI.exec(value);
  if (embedded) {
    return { mediaType: embedded[1].toLowerCase(), data: Buffer.from(embedded[2], 'base64') };
  }
  const isBinary = type === ValueType.Binary || params[Param.Encoding] !== undefined;
  if (isBinary === false) {
    return null;
  }
  const [word = ''] = typeWordsOf(property);
  const mediaType = MEDIA_TYPE_BY_WORD[word] ?? (word.includes('/') ? word : null);
  return mediaType === null ? null : { mediaType, data: Buffer.from(value, 'base64') };
}

/** What the decoder knows while it reads one card. */
interface Reading {
  card: Card;
  /** The label each group gives its property, by group. */
  labels: Map<string, string>;
  /** The properties kept as they are. */
  extra: JCardProperty[];
  /** What `FN` says, used when the card has no structured name. */
  formattedName: string | null;
}

/**
 * Reads the label a property's group gives it.
 *
 * @param reading - The card being read.
 * @param property - The property.
 * @returns The label, or null when the group has none.
 */
function labelOf(reading: Reading, property: JCardProperty): string | null {
  const group = groupOf(property);
  return group === null ? null : (reading.labels.get(group) ?? null);
}

/**
 * Adds a way to reach the person.
 *
 * @param reading - The card being read.
 * @param property - The property it came from.
 * @param type - What kind of detail it is.
 * @param value - The address, number or handle.
 * @param fallbackLabel - The label when the property's group gives none.
 * @returns True, or false when there is no value to keep.
 */
function addContactInfo(
  reading: Reading,
  property: JCardProperty,
  type: ContactType,
  value: string | null,
  fallbackLabel: string | null = null,
): boolean {
  if (value === null) {
    return false;
  }
  const words = typeWordsOf(property);
  const kindWord = words.find((word) => Object.hasOwn(KIND_BY_TYPE_WORD, word));
  reading.card.contactInfos.push({
    type,
    value,
    kind: kindWord === undefined ? null : KIND_BY_TYPE_WORD[kindWord],
    label: labelOf(reading, property) ?? fallbackLabel,
    isPrimary: words.includes(TypeWord.Preferred),
  });
  return true;
}

/**
 * Adds a postal address.
 *
 * @param reading - The card being read.
 * @param property - The `ADR` property.
 * @returns True, or false when every part is empty.
 */
function addAddress(reading: Reading, property: JCardProperty): boolean {
  const [poBox, extended, street, city, state, postalCode, country] = componentsOf(property);
  // Philotes needs a first line. A card with no street still names a place by one of the others.
  const line1 = street ?? poBox ?? extended ?? city ?? state ?? postalCode ?? country ?? null;
  if (line1 === null) {
    return false;
  }
  const words = typeWordsOf(property);
  const typeWord = words.find((word) => Object.hasOwn(ADDRESS_TYPE_BY_TYPE_WORD, word));
  reading.card.addresses.push({
    type: typeWord === undefined ? AddressType.Other : ADDRESS_TYPE_BY_TYPE_WORD[typeWord],
    label: labelOf(reading, property),
    line1,
    line2: street === null ? null : (extended ?? null),
    city: line1 === city ? null : (city ?? null),
    state: line1 === state ? null : (state ?? null),
    postalCode: line1 === postalCode ? null : (postalCode ?? null),
    country: line1 === country ? null : (country ?? null),
    isPrimary: words.includes(TypeWord.Preferred),
  });
  return true;
}

/**
 * Adds a birthday, an anniversary or a named date.
 *
 * @param reading - The card being read.
 * @param property - The date property.
 * @returns True, or false when its value is not a day.
 */
function addDate(reading: Reading, property: JCardProperty): boolean {
  const day = dayOf(property);
  if (day === null) {
    return false;
  }
  const { kind, name } = DATE_PROPERTIES[property[0]];
  const label = kind === ImportantDateKind.Other ? labelOf(reading, property) : null;
  reading.card.dates.push({ kind, name: label ?? name, ...day });
  return true;
}

/**
 * Adds the name parts of `N`.
 *
 * @param reading - The card being read.
 * @param property - The `N` property.
 * @returns True.
 */
function addName(reading: Reading, property: JCardProperty): boolean {
  const [lastName = null, firstName = null, middleName = null, namePrefix = null, nameSuffix = null] =
    componentsOf(property);
  Object.assign(reading.card, { lastName, firstName, middleName, namePrefix, nameSuffix });
  return true;
}

/**
 * Adds the organization and, when `ORG` has further parts, the department.
 *
 * @param reading - The card being read.
 * @param property - The `ORG` property.
 * @returns True.
 */
function addOrganization(reading: Reading, property: JCardProperty): boolean {
  const [organization = null, ...units] = componentsOf(property);
  reading.card.organization = organization;
  reading.card.department = units.filter(Boolean).join(LIST_SEPARATOR) || null;
  return true;
}

/**
 * Adds the card's categories as label names, each once whatever its case.
 *
 * @param reading - The card being read.
 * @param property - The `CATEGORIES` property.
 * @returns True.
 */
function addLabels(reading: Reading, property: JCardProperty): boolean {
  const [, , , ...values] = property;
  for (const value of values) {
    const name = textOf(value);
    const isNew = name !== null && reading.card.labels.every((known) => known.toLowerCase() !== name.toLowerCase());
    if (name !== null && isNew) {
      reading.card.labels.push(name);
    }
  }
  return true;
}

/**
 * Adds a social profile Philotes has a type for.
 *
 * @param reading - The card being read.
 * @param property - The `X-SOCIALPROFILE` property.
 * @returns True, or false for a network Philotes does not name.
 */
function addSocialProfile(reading: Reading, property: JCardProperty): boolean {
  const network = typeWordsOf(property).find((word) => Object.hasOwn(SOCIAL_TYPES, word));
  if (network === undefined) {
    return false;
  }
  return addContactInfo(reading, property, SOCIAL_TYPES[network], textOf(property[3]));
}

/**
 * Adds the picture, when the card holds one itself. The first one wins.
 *
 * @param reading - The card being read.
 * @param property - The `PHOTO` property.
 * @returns True, or false for a second picture or a link to one.
 */
function addPhoto(reading: Reading, property: JCardProperty): boolean {
  const photo = reading.card.photo === null ? photoOf(property) : null;
  if (photo === null) {
    return false;
  }
  reading.card.photo = photo;
  return true;
}

/**
 * Reads each of a text property's values, joined into one line.
 *
 * @param property - The property.
 * @returns The text, or null when it is empty.
 */
function joinedTextOf(property: JCardProperty): string | null {
  const [, , , ...values] = property;
  return values.map(textOf).filter(Boolean).join(LIST_SEPARATOR) || null;
}

/**
 * Reads a phone number, without the `tel:` a 4.0 card may put in front.
 *
 * @param property - The `TEL` property.
 * @returns The number, or null when it is empty.
 */
function phoneOf(property: JCardProperty): string | null {
  return textOf(property[3])?.replace(TEL_SCHEME, '') || null;
}

/**
 * What to do with each property the decoder understands. A reader returns false to leave the property
 * in `extra` after all.
 */
const READERS: Readonly<Record<string, (reading: Reading, property: JCardProperty) => boolean>> = {
  [Property.Name]: addName,
  [Property.Organization]: addOrganization,
  [Property.Categories]: addLabels,
  [Property.Address]: addAddress,
  [Property.Birthday]: addDate,
  [Property.Anniversary]: addDate,
  [Property.LegacyAnniversary]: addDate,
  [Property.NamedDate]: addDate,
  [Property.Photo]: addPhoto,
  [Property.SocialProfile]: addSocialProfile,
  [Property.Uid]: (reading, property) => {
    reading.card.uid = textOf(property[3]);
    return true;
  },
  [Property.Nickname]: (reading, property) => {
    reading.card.nickname = joinedTextOf(property);
    return true;
  },
  [Property.Title]: (reading, property) => {
    reading.card.jobTitle = textOf(property[3]);
    return true;
  },
  [Property.Note]: (reading, property) => {
    const note = typeof property[3] === 'string' ? property[3] : null;
    reading.card.about = [reading.card.about, note].filter(Boolean).join('\n\n') || null;
    return true;
  },
  [Property.Email]: (reading, property) => addContactInfo(reading, property, ContactType.Email, textOf(property[3])),
  [Property.Phone]: (reading, property) => {
    const isFax = typeWordsOf(property).includes(TypeWord.Fax);
    return addContactInfo(reading, property, isFax ? ContactType.Fax : ContactType.Phone, phoneOf(property));
  },
  [Property.Url]: (reading, property) => addContactInfo(reading, property, ContactType.Website, textOf(property[3])),
  [Property.Messaging]: (reading, property) => {
    const service = property[1]['x-service-type'];
    const value = textOf(property[3])?.replace(IM_SCHEME, '') ?? null;
    return addContactInfo(reading, property, ContactType.Im, value, typeof service === 'string' ? service : null);
  },
  [Property.OtherContact]: (reading, property) =>
    addContactInfo(reading, property, ContactType.Other, textOf(property[3])),
};

/**
 * Reads one parsed card.
 *
 * @param jCard - The card as ical.js parsed it.
 * @returns What it says about the person.
 */
function readCard(jCard: JCard): Card {
  const [, properties] = jCard;
  const reading: Reading = { card: emptyCard(), labels: new Map(), extra: [], formattedName: null };

  // Labels first: a property is read with the label its group gives it, wherever that label sits.
  const groupLabels = properties.filter(([name]) => name === Property.GroupLabel);
  for (const property of groupLabels) {
    const group = groupOf(property);
    const label = textOf(property[3]);
    if (group !== null && label !== null) {
      reading.labels.set(group, APPLE_LABEL.exec(label)?.[1] ?? label);
    }
  }

  const readGroups = new Set<string>();
  for (const property of properties) {
    const [name] = property;
    if (name === Property.FormattedName) {
      reading.formattedName = textOf(property[3]);
    }
    const isLabel = name === Property.GroupLabel;
    if (REGENERATED.has(name) || isLabel) {
      continue;
    }
    const wasRead = READERS[name]?.(reading, property) ?? false;
    const group = groupOf(property);
    if (wasRead && group !== null) {
      readGroups.add(group);
    }
    if (wasRead === false) {
      reading.extra.push(property);
    }
  }

  // A label goes with its property: read with it, or kept beside it.
  const keptLabels = groupLabels.filter((property) => readGroups.has(groupOf(property) ?? '') === false);
  const extra = [...reading.extra, ...keptLabels];
  const { card } = reading;
  card.extra = extra.length > 0 ? JSON.stringify(extra) : null;

  // A card with no structured name is still called something. An organization's card repeats the
  // organization there, which is not a person's name.
  const isUnnamed = [card.firstName, card.lastName, card.nickname].every((part) => part === null);
  const isOwnName = reading.formattedName !== null && reading.formattedName !== card.organization;
  if (isUnnamed && isOwnName) {
    card.firstName = reading.formattedName;
  }
  return card;
}

/**
 * Says whether a parsed value is one component, rather than a list of them.
 *
 * @param parsed - What ical.js returned.
 * @returns True for a single component.
 */
function isComponent(parsed: unknown[]): boolean {
  return typeof parsed[0] === 'string';
}

/**
 * Reads the cards in vCard text: one card or many, in vCard 3.0 or 4.0.
 *
 * @param text - The text of a `.vcf` file or of one card.
 * @returns What each card says, in the file's order.
 * @throws VCardSyntaxError when the text cannot be parsed, or holds something that is not a vCard.
 */
export function parseVCards(text: string): Card[] {
  let parsed: unknown[];
  try {
    parsed = ICAL.parse(text);
  } catch (error) {
    throw new VCardSyntaxError('That is not a vCard file.', { cause: error });
  }
  const components = isComponent(parsed) ? [parsed] : parsed;
  const cards = components.filter((component): component is JCard => Array.isArray(component));
  const hasCards = cards.length > 0 && cards.length === components.length;
  const isAllCards = hasCards && cards.every(([name]) => name === VCARD);
  if (isAllCards === false) {
    throw new VCardSyntaxError('That is not a vCard file.');
  }
  return cards.map(readCard);
}
