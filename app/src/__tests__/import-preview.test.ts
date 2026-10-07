import { describe, expect, it } from 'vitest';
import { previewGoogleCsv, previewVCards } from '@/lib/import-preview';

describe('the preview of a Google Contacts CSV', () => {
  it('counts the lines after the header and names the first of them', () => {
    const csv = ['First Name,Last Name,E-mail 1 - Value', 'Ada,Lovelace,ada@example.com', '"Grace","Hopper",', ''].join(
      '\r\n',
    );

    expect(previewGoogleCsv(csv, 5)).toEqual({ contactCount: 2, names: ['Ada Lovelace', 'Grace Hopper'] });
  });

  it('names no more contacts than it is asked for', () => {
    const csv = ['First Name,Last Name', 'Ada,Lovelace', 'Grace,Hopper', 'Linus,Torvalds'].join('\n');

    expect(previewGoogleCsv(csv, 2)).toEqual({ contactCount: 3, names: ['Ada Lovelace', 'Grace Hopper'] });
  });

  it('says so when a line has no name', () => {
    expect(previewGoogleCsv('First Name,Last Name\n,,someone@example.com', 5).names).toEqual(['(unknown)']);
  });

  it('finds nobody in a file that is only a header', () => {
    expect(previewGoogleCsv('First Name,Last Name\n', 5)).toEqual({ contactCount: 0, names: [] });
  });
});

describe('the preview of a vCard file', () => {
  it('counts the cards and reads each formatted name', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Ada Lovelace',
      'END:VCARD',
      'begin:vcard',
      'VERSION:4.0',
      'item1.FN;CHARSET=UTF-8:Hopper\\, Grace',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(previewVCards(vcf, 5)).toEqual({ contactCount: 2, names: ['Ada Lovelace', 'Hopper, Grace'] });
  });

  it('counts a card that has no formatted name without naming it', () => {
    const vcf = ['BEGIN:VCARD', 'TEL:555-0100', 'END:VCARD'].join('\n');

    expect(previewVCards(vcf, 5)).toEqual({ contactCount: 1, names: [] });
  });

  it('names no more contacts than it is asked for', () => {
    const card = (name: string) => ['BEGIN:VCARD', `FN:${name}`, 'END:VCARD'].join('\n');

    const preview = previewVCards([card('Ada'), card('Grace'), card('Linus')].join('\n'), 2);

    expect(preview).toEqual({ contactCount: 3, names: ['Ada', 'Grace'] });
  });

  it('finds nobody in a file that is not a vCard', () => {
    expect(previewVCards('First Name,Last Name\nAda,Lovelace', 5)).toEqual({ contactCount: 0, names: [] });
  });
});
