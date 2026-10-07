import { describe, expect, it } from 'vitest';
import { buildPersonsCsv, csvCell, type ExportPerson } from '../lib/csv-export';

function person(overrides: Partial<ExportPerson> = {}): ExportPerson {
  return {
    id: '1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    contactInfos: [],
    addresses: [],
    importantDates: [],
    labels: [],
    ...overrides,
  };
}

const rows = (csv: string) => csv.split('\r\n');
const cells = (line: string) => line.split(',');

describe('csvCell', () => {
  it('leaves a plain value alone', () => {
    expect(csvCell('Ada')).toBe('Ada');
  });

  it('quotes values containing a comma, quote or newline', () => {
    expect(csvCell('Lovelace, Ada')).toBe('"Lovelace, Ada"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('buildPersonsCsv', () => {
  it('emits only the fixed columns when nobody has contact info', () => {
    const csv = buildPersonsCsv([person()]);
    expect(rows(csv)[0]).toBe('First Name,Last Name,Birthday,Labels');
    expect(rows(csv)[1]).toBe('Ada,Lovelace,,');
  });

  it('uses CRLF line endings and one row per person', () => {
    const csv = buildPersonsCsv([person(), person({ id: '2', firstName: 'Grace' })]);
    expect(csv).toContain('\r\n');
    expect(rows(csv)).toHaveLength(3);
  });

  it('widens the header to the person with the most entries', () => {
    const csv = buildPersonsCsv([
      person({
        contactInfos: [
          { type: 'email', label: null, value: 'a@example.com', isPrimary: false },
          { type: 'email', label: null, value: 'b@example.com', isPrimary: false },
        ],
      }),
      person({ id: '2', contactInfos: [{ type: 'email', label: null, value: 'c@example.com', isPrimary: false }] }),
    ]);
    const header = rows(csv)[0];
    expect(header).toContain('E-mail 2 - Value');
    expect(header).not.toContain('E-mail 3 - Value');
    // The one-email person still fills the second pair, with blanks.
    expect(cells(rows(csv)[2]).slice(-2)).toEqual(['', '']);
  });

  it('marks the primary entry with a leading asterisk and falls back to a default label', () => {
    const csv = buildPersonsCsv([
      person({
        contactInfos: [
          { type: 'email', label: null, value: 'a@example.com', isPrimary: true },
          { type: 'mobile', label: 'Cell', value: '555', isPrimary: false },
        ],
      }),
    ]);
    const row = rows(csv)[1];
    expect(row).toContain('* Home,a@example.com');
    expect(row).toContain('Cell,555');
  });

  it('treats phone and mobile as one column group', () => {
    const csv = buildPersonsCsv([
      person({
        contactInfos: [
          { type: 'phone', label: null, value: '111', isPrimary: false },
          { type: 'mobile', label: null, value: '222', isPrimary: false },
        ],
      }),
    ]);
    expect(rows(csv)[0]).toContain('Phone 2 - Value');
    expect(rows(csv)[1]).toContain('Phone,111,Mobile,222');
  });

  it('exports the birthday and joins labels with the Google separator', () => {
    const csv = buildPersonsCsv([
      person({
        importantDates: [
          { name: 'Anniversary', date: new Date(2000, 5, 1), recurrence: 'yearly' },
          { name: 'Birthday', date: new Date(1815, 11, 10), recurrence: 'yearly' },
        ],
        labels: [
          { id: 'l1', label: 'Friend', color: '#fff' },
          { id: 'l2', label: 'Work', color: '#000' },
        ],
      }),
    ]);
    expect(rows(csv)[1]).toBe('Ada,Lovelace,1815-12-10,Friend ::: Work');
  });

  it('labels an address by its type when it has no label of its own', () => {
    const csv = buildPersonsCsv([
      person({
        addresses: [{ type: 'home', label: null, line1: '1 Main St', city: 'London', country: 'UK' }],
      }),
    ]);
    expect(rows(csv)[0]).toContain('Address 1 - Street');
    expect(rows(csv)[1]).toContain('Home,1 Main St,London,,,UK');
  });

  it('quotes a value that contains a comma', () => {
    const csv = buildPersonsCsv([person({ lastName: 'Lovelace, Countess' })]);
    expect(rows(csv)[1]).toBe('Ada,"Lovelace, Countess",,');
  });
});
