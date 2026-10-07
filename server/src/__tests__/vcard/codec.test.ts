import { AddressType, ContactKind, ContactType, ImportantDateKind } from '@cubicecho/philotes-db/schema';
import { describe, expect, it } from 'vitest';
import { type Card, emptyCard, VCardSyntaxError } from '../../vcard/card.ts';
import { parseVCards } from '../../vcard/decode.ts';
import { formattedNameOf, writeVCard, writeVCards } from '../../vcard/encode.ts';

/**
 * Builds vCard text from its lines.
 *
 * @param lines - The lines between `BEGIN` and `END`.
 * @returns The card, with the line breaks a vCard uses.
 */
function vcard(...lines: string[]): string {
  return ['BEGIN:VCARD', ...lines, 'END:VCARD'].join('\r\n');
}

/**
 * Reads text that holds exactly one card.
 *
 * @param text - The vCard text.
 * @returns The card.
 */
function parseOne(text: string): Card {
  const cards = parseVCards(text);
  expect(cards).toHaveLength(1);
  return cards[0];
}

/** A card as Apple's Contacts exports it: vCard 3.0, with groups and `X-ABLabel`. */
const APPLE_CARD = vcard(
  'VERSION:3.0',
  'PRODID:-//Apple Inc.//macOS 14.0//EN',
  'N:Lovelace;Ada;Augusta;Lady;PhD',
  'FN:Lady Ada Augusta Lovelace PhD',
  'NICKNAME:Addie',
  'ORG:Analytical Engines;Research',
  'TITLE:Programmer',
  'EMAIL;type=INTERNET;type=HOME;type=pref:Ada@Example.com',
  'TEL;type=CELL;type=VOICE:+1 555 0100',
  'TEL;type=WORK;type=FAX:+1 555 0199',
  'item1.TEL:+1 555 0111',
  'item1.X-ABLabel:Boat',
  'item2.URL:https://ada.example',
  'item2.X-ABLabel:_$!<HomePage>!$_',
  'item3.X-ABRELATEDNAMES:Charles',
  'item3.X-ABLabel:_$!<Friend>!$_',
  'ADR;type=HOME;type=pref:;Flat 2;1 Main St;London;;N1;UK',
  'BDAY;X-APPLE-OMIT-YEAR=1604:1604-12-10',
  'item4.X-ABDATE:2010-05-06',
  'item4.X-ABLabel:Graduation',
  'CATEGORIES:Friends,Book club',
  'NOTE:Met at the\\nlibrary\\, twice',
  'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQ',
  'X-SOCIALPROFILE;type=twitter:https://x.com/ada',
  'X-PHONETIC-FIRST-NAME:Ay-da',
  'UID:abc-123',
  'REV:2020-01-01T00:00:00Z',
);

/** A card as a vCard 4.0 client writes it. */
const V4_CARD = vcard(
  'VERSION:4.0',
  'FN:Grace Hopper',
  'N:Hopper;Grace;;;',
  'EMAIL;PREF=1;TYPE=work:grace@navy.example',
  'TEL;VALUE=uri;TYPE="voice,cell":tel:+1-555-0100',
  'BDAY:--1209',
  'ANNIVERSARY:19400101',
  'PHOTO:data:image/png;base64,iVBORw0KGgo=',
  'IMPP:xmpp:grace@chat.example',
  'UID:urn:uuid:4fbe8971-0bc3-424c-9c26-36c3e1eff6b1',
);

describe('reading a vCard', () => {
  it('reads the parts of a name, the organization and the note', () => {
    const card = parseOne(APPLE_CARD);

    expect(card).toMatchObject({
      uid: 'abc-123',
      namePrefix: 'Lady',
      firstName: 'Ada',
      middleName: 'Augusta',
      lastName: 'Lovelace',
      nameSuffix: 'PhD',
      nickname: 'Addie',
      organization: 'Analytical Engines',
      department: 'Research',
      jobTitle: 'Programmer',
      about: 'Met at the\nlibrary, twice',
    });
  });

  it('reads each way to reach the person with its kind, label and preference', () => {
    const card = parseOne(APPLE_CARD);

    expect(card.contactInfos).toEqual([
      { type: ContactType.Email, value: 'Ada@Example.com', kind: ContactKind.Home, label: null, isPrimary: true },
      { type: ContactType.Phone, value: '+1 555 0100', kind: ContactKind.Mobile, label: null, isPrimary: false },
      { type: ContactType.Fax, value: '+1 555 0199', kind: ContactKind.Work, label: null, isPrimary: false },
      { type: ContactType.Phone, value: '+1 555 0111', kind: null, label: 'Boat', isPrimary: false },
      { type: ContactType.Website, value: 'https://ada.example', kind: null, label: 'HomePage', isPrimary: false },
      { type: ContactType.Twitter, value: 'https://x.com/ada', kind: null, label: null, isPrimary: false },
    ]);
  });

  it('reads an address', () => {
    const card = parseOne(APPLE_CARD);

    expect(card.addresses).toEqual([
      {
        type: AddressType.Home,
        label: null,
        line1: '1 Main St',
        line2: 'Flat 2',
        city: 'London',
        state: null,
        postalCode: 'N1',
        country: 'UK',
        isPrimary: true,
      },
    ]);
  });

  it('uses another part as the first line of an address with no street', () => {
    const card = parseOne(vcard('VERSION:3.0', 'FN:Ada', 'ADR:;;;Paris;;;France', 'ADR:;;;;;;'));

    expect(card.addresses).toHaveLength(1);
    expect(card.addresses[0]).toMatchObject({ line1: 'Paris', city: null, country: 'France', type: AddressType.Other });
  });

  it('reads a birthday without a year, and a named date', () => {
    const card = parseOne(APPLE_CARD);

    expect(card.dates).toEqual([
      { kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1604-12-10', hasYear: false },
      { kind: ImportantDateKind.Other, name: 'Graduation', date: '2010-05-06', hasYear: true },
    ]);
  });

  it.each([
    ['a full date', 'BDAY:1815-12-10', { date: '1815-12-10', hasYear: true }],
    ['a date without dashes', 'BDAY:18151210', { date: '1815-12-10', hasYear: true }],
    ['a date with a time', 'BDAY:1815-12-10T00:00:00Z', { date: '1815-12-10', hasYear: true }],
    ['a 4.0 date with no year', 'BDAY:--1210', { date: '1604-12-10', hasYear: false }],
    ['the placeholder year alone', 'BDAY:1604-12-10', { date: '1604-12-10', hasYear: false }],
  ])('reads %s as a birthday', (_name, line, expected) => {
    const version = line.includes('--') ? '4.0' : '3.0';

    const card = parseOne(vcard(`VERSION:${version}`, 'FN:Ada', line));

    expect(card.dates).toEqual([{ kind: ImportantDateKind.Birthday, name: 'Birthday', ...expected }]);
  });

  it('keeps a birthday that is not a day as it was sent', () => {
    const card = parseOne(vcard('VERSION:4.0', 'FN:Ada', 'BDAY;VALUE=text:circa 1800'));

    expect(card.dates).toEqual([]);
    expect(card.extra).toContain('circa 1800');
  });

  it('reads categories as labels, each once whatever its case', () => {
    const card = parseOne(vcard('VERSION:3.0', 'FN:Ada', 'CATEGORIES:Friends,Book club', 'CATEGORIES:friends'));

    expect(card.labels).toEqual(['Friends', 'Book club']);
  });

  it('reads a picture held in the card, in either version', () => {
    const jpeg = parseOne(APPLE_CARD).photo;
    const png = parseOne(V4_CARD).photo;

    expect(jpeg?.mediaType).toBe('image/jpeg');
    expect(jpeg?.data.toString('base64')).toBe('/9j/4AAQ');
    expect(png?.mediaType).toBe('image/png');
    expect(png?.data.toString('base64')).toBe('iVBORw0KGgo=');
  });

  it('keeps a link to a picture as it was sent', () => {
    const card = parseOne(vcard('VERSION:4.0', 'FN:Ada', 'PHOTO:https://example.com/ada.jpg'));

    expect(card.photo).toBeNull();
    expect(card.extra).toContain('https://example.com/ada.jpg');
  });

  it('reads a vCard 4.0 card', () => {
    const card = parseOne(V4_CARD);

    expect(card).toMatchObject({ firstName: 'Grace', lastName: 'Hopper' });
    expect(card.contactInfos).toEqual([
      { type: ContactType.Email, value: 'grace@navy.example', kind: ContactKind.Work, label: null, isPrimary: true },
      { type: ContactType.Phone, value: '+1-555-0100', kind: ContactKind.Mobile, label: null, isPrimary: false },
      { type: ContactType.Im, value: 'xmpp:grace@chat.example', kind: null, label: null, isPrimary: false },
    ]);
    expect(card.dates).toEqual([
      { kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1604-12-09', hasYear: false },
      { kind: ImportantDateKind.Anniversary, name: 'Anniversary', date: '1940-01-01', hasYear: true },
    ]);
  });

  it('keeps what it has no field for, with the label that goes with it', () => {
    const card = parseOne(APPLE_CARD);

    const extra: unknown[][] = JSON.parse(card.extra ?? '[]');
    expect(extra.map(([name]) => name)).toEqual(['x-abrelatednames', 'x-phonetic-first-name', 'x-ablabel']);
    expect(card.extra).not.toContain('Boat');
  });

  it('calls a person by the formatted name when the card has no name parts', () => {
    const card = parseOne(vcard('VERSION:3.0', 'FN:Ada Lovelace', 'TEL:+1 555 0100'));

    expect(card.firstName).toBe('Ada Lovelace');
  });

  it("does not take an organization's card for a person of that name", () => {
    const card = parseOne(vcard('VERSION:3.0', 'FN:Analytical Engines', 'ORG:Analytical Engines', 'N:;;;;'));

    expect(card).toMatchObject({ firstName: null, organization: 'Analytical Engines' });
  });

  it('reads every card in a file', () => {
    const cards = parseVCards(`${APPLE_CARD}\r\n${V4_CARD}\r\n`);

    expect(cards.map((card) => card.firstName)).toEqual(['Ada', 'Grace']);
  });

  it('reads a file with bare line feeds and folded lines', () => {
    const card = parseOne('BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nNOTE:one two\n  three\nEND:VCARD\n');

    expect(card.about).toBe('one two three');
  });

  it.each([
    ['text that is not a vCard', 'First Name,Last Name\nAda,Lovelace'],
    ['an empty file', ''],
    ['a calendar', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR'],
  ])('refuses %s', (_name, text) => {
    expect(() => parseVCards(text)).toThrow(VCardSyntaxError);
  });
});

describe('writing a vCard', () => {
  const card: Card = {
    ...emptyCard(),
    uid: 'abc-123',
    firstName: 'Ada',
    lastName: 'Lovelace',
    organization: 'Analytical; Engines',
    about: 'One, two\nthree',
    contactInfos: [
      { type: ContactType.Email, value: 'ada@example.com', kind: ContactKind.Home, label: null, isPrimary: true },
      { type: ContactType.Phone, value: '+1 555 0100', kind: ContactKind.Mobile, label: 'Boat', isPrimary: false },
      { type: ContactType.Fax, value: '+1 555 0199', kind: ContactKind.Work, label: null, isPrimary: false },
      { type: ContactType.Linkedin, value: 'https://linkedin.com/in/ada', kind: null, label: null, isPrimary: false },
      { type: ContactType.Other, value: 'ada#1815', kind: null, label: 'Discord', isPrimary: false },
    ],
    dates: [
      { kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1604-12-10', hasYear: false },
      { kind: ImportantDateKind.Anniversary, name: 'Anniversary', date: '2001-02-03', hasYear: true },
      { kind: ImportantDateKind.Other, name: 'Graduation', date: '2010-05-06', hasYear: true },
    ],
    labels: ['Friends', 'Book, club'],
    photo: { mediaType: 'image/png', data: Buffer.from('picture') },
  };

  it('writes vCard 3.0 with the properties a phone reads', () => {
    const lines = writeVCard(card, { revisedAt: new Date('2026-10-07T12:00:00.000Z') }).split('\r\n');

    expect(lines).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'PRODID:-//Philotes//Philotes//EN',
      'UID:abc-123',
      'FN:Ada Lovelace',
      'N:Lovelace;Ada;;;',
      'ORG:Analytical\\; Engines',
      'NOTE:One\\, two\\nthree',
      'EMAIL;TYPE=INTERNET,HOME,PREF:ada@example.com',
      'PHILOTES1.TEL;TYPE=CELL:+1 555 0100',
      'PHILOTES1.X-ABLABEL:Boat',
      'TEL;TYPE=FAX,WORK:+1 555 0199',
      'X-SOCIALPROFILE;TYPE=LINKEDIN:https://linkedin.com/in/ada',
      'PHILOTES2.X-PHILOTES-CONTACT:ada#1815',
      'PHILOTES2.X-ABLABEL:Discord',
      'BDAY;X-APPLE-OMIT-YEAR=1604;VALUE=DATE:16041210',
      'ANNIVERSARY:2001-02-03',
      'PHILOTES3.X-ABDATE:2010-05-06',
      'PHILOTES3.X-ABLABEL:Graduation',
      'CATEGORIES:Friends,Book\\, club',
      `PHOTO;ENCODING=b;TYPE=PNG:${Buffer.from('picture').toString('base64')}`,
      'REV:20261007T120000Z',
      'END:VCARD',
    ]);
  });

  it('reads back what it wrote', () => {
    expect(parseOne(writeVCard(card))).toEqual(card);
  });

  it.each([
    ['an Apple 3.0 card', APPLE_CARD],
    ['a 4.0 card', V4_CARD],
  ])('gives %s back with nothing lost', (_name, text) => {
    const read = parseOne(text);

    expect(parseOne(writeVCard(read))).toEqual(read);
  });

  it('sends back what it has no field for, without reusing its group names', () => {
    const read = parseOne(
      vcard('VERSION:3.0', 'FN:Ada', 'philotes1.X-ABRELATEDNAMES:Charles', 'philotes1.X-ABLabel:Friend', 'item1.TEL:1'),
    );
    const text = writeVCard({ ...read, contactInfos: [{ ...read.contactInfos[0], label: 'Boat' }] });

    expect(text).toContain('PHILOTES1.X-ABRELATEDNAMES:Charles');
    expect(text).toContain('PHILOTES2.TEL:1');
    expect(text).toContain('PHILOTES2.X-ABLABEL:Boat');
  });

  it('folds a long line, and reads it back whole', () => {
    const long = { ...emptyCard(), firstName: 'Ada', about: 'word '.repeat(100).trim() };

    const text = writeVCard(long);

    const noteLines = text.split('\r\n').filter((line) => line.startsWith('NOTE') || line.startsWith(' '));
    expect(noteLines.length).toBeGreaterThan(1);
    expect(parseOne(text).about).toBe(long.about);
  });

  it.each([
    ['the name', { firstName: 'Ada', lastName: 'Lovelace', nickname: 'Addie' }, 'Ada Lovelace'],
    ['the nickname', { nickname: 'Addie', organization: 'Engines' }, 'Addie'],
    ['the organization', { organization: 'Engines' }, 'Engines'],
    ['nothing', {}, ''],
  ])('calls a person by %s', (_name, fields, expected) => {
    expect(formattedNameOf({ ...emptyCard(), ...fields })).toBe(expected);
  });

  it('writes several cards as one file', () => {
    const text = writeVCards([{ card }, { card: { ...emptyCard(), firstName: 'Grace' } }]);

    expect(parseVCards(text).map((read) => read.firstName)).toEqual(['Ada', 'Grace']);
    expect(writeVCards([])).toBe('');
  });
});
