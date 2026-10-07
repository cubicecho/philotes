// Google Contacts-compatible CSV export. The `ExportPersons` query in export-people-card.tsx must select
// every field these shapes name. Dates arrive as `Date` objects, made by the Apollo cache's scalar policies.

import { ContactTypeEnum } from '@/__generated__/graphql';
import { localIsoDate } from '@/lib/local-date';

/** One way to reach a person, as the CSV export reads it. */
export interface ExportContactInfo {
  type: string;
  label: string | null;
  value: string;
  isPrimary: boolean;
}

/** A postal address, as the CSV export reads it. */
export interface ExportAddress {
  type: string;
  label: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/** An important date, as the CSV export reads it. */
export interface ExportImportantDate {
  name: string;
  /** Local midnight of the calendar day. */
  date: Date;
  recurrence?: string | null;
}

/** A label on an exported person. */
export interface ExportLabel {
  id: string;
  label: string;
  color: string;
}

/** A person with everything the CSV export reads about them. */
export interface ExportPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
  contactInfos: ExportContactInfo[];
  addresses: ExportAddress[];
  importantDates: ExportImportantDate[];
  labels: ExportLabel[];
}

/** The contact types that fill the CSV's phone columns. */
const PHONE_TYPES: ReadonlySet<string> = new Set([ContactTypeEnum.Phone, ContactTypeEnum.Mobile]);

/**
 * Writes one CSV cell, quoting it when it holds a quote, a comma or a line break.
 *
 * @param value - The cell's text.
 * @returns The text as it goes in the file, with inner quotes doubled when quoted.
 */
export function csvCell(value: string): string {
  const needsQuoting = value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r');
  if (needsQuoting) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Writes one CSV row.
 *
 * @param cells - The row's values, in column order.
 * @returns The cells, each quoted as needed, joined by commas.
 */
function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * Capitalises the first letter of a word.
 *
 * @param str - The word.
 * @returns The word with its first letter in upper case and the rest untouched.
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Picks the label a contact detail gets in the CSV.
 *
 * @param entry - The contact detail.
 * @param defaultLabel - The label for an entry that has none of its own.
 * @returns The label, with a leading `* ` when the entry is primary.
 */
function contactInfoLabel(entry: ExportContactInfo, defaultLabel: string): string {
  const base = entry.label || defaultLabel;
  return entry.isPrimary ? `* ${base}` : base;
}

/**
 * Lists a person's e-mail addresses for the CSV.
 *
 * @param person - The person.
 * @returns The addresses in column order.
 */
function personEmails(person: ExportPerson): ExportContactInfo[] {
  return person.contactInfos.filter((c) => c.type === ContactTypeEnum.Email);
}

/**
 * Builds a CSV of people in the columns Google Contacts imports. There are as many e-mail, phone,
 * website and address column groups as the person with the most of each needs.
 *
 * @param persons - The people to write, one row each.
 * @returns The file's text: a header row and the rows, with CRLF line endings.
 */
export function buildPersonsCsv(persons: ExportPerson[]): string {
  // 1. Calculate max counts across all persons
  const maxEmails = Math.max(0, ...persons.map((p) => personEmails(p).length));
  const maxPhones = Math.max(0, ...persons.map((p) => p.contactInfos.filter((c) => PHONE_TYPES.has(c.type)).length));
  const maxWebsites = Math.max(
    0,
    ...persons.map((p) => p.contactInfos.filter((c) => c.type === ContactTypeEnum.Website).length),
  );
  const maxAddresses = Math.max(0, ...persons.map((p) => p.addresses.length));

  // 2. Build header row
  const headers: string[] = ['First Name', 'Last Name', 'Birthday', 'Labels'];
  for (let n = 1; n <= maxEmails; n++) {
    headers.push(`E-mail ${n} - Label`, `E-mail ${n} - Value`);
  }
  for (let n = 1; n <= maxPhones; n++) {
    headers.push(`Phone ${n} - Label`, `Phone ${n} - Value`);
  }
  for (let n = 1; n <= maxWebsites; n++) {
    headers.push(`Website ${n} - Label`, `Website ${n} - Value`);
  }
  for (let n = 1; n <= maxAddresses; n++) {
    headers.push(
      `Address ${n} - Label`,
      `Address ${n} - Street`,
      `Address ${n} - Extended Address`,
      `Address ${n} - City`,
      `Address ${n} - Region`,
      `Address ${n} - Postal Code`,
      `Address ${n} - Country`,
    );
  }

  // 3. Build data rows
  const rows = persons.map((person) => {
    const birthdayDate = person.importantDates.find((d) => d.name === 'Birthday')?.date;
    const birthday = birthdayDate ? localIsoDate(birthdayDate) : '';
    const labelsStr = person.labels.map((l) => l.label).join(' ::: ');

    const cells: string[] = [person.firstName, person.lastName ?? '', birthday, labelsStr];

    // Emails
    const emails = personEmails(person);
    for (let n = 0; n < maxEmails; n++) {
      const entry = emails[n];
      cells.push(entry ? contactInfoLabel(entry, 'Home') : '', entry?.value ?? '');
    }

    // Phones
    const phones = person.contactInfos.filter((c) => PHONE_TYPES.has(c.type));
    for (let n = 0; n < maxPhones; n++) {
      const entry = phones[n];
      const defaultLabel = entry?.type === ContactTypeEnum.Mobile ? 'Mobile' : 'Phone';
      cells.push(entry ? contactInfoLabel(entry, defaultLabel) : '', entry?.value ?? '');
    }

    // Websites
    const websites = person.contactInfos.filter((c) => c.type === ContactTypeEnum.Website);
    for (let n = 0; n < maxWebsites; n++) {
      const entry = websites[n];
      cells.push(entry ? contactInfoLabel(entry, 'Website') : '', entry?.value ?? '');
    }

    // Addresses
    for (let n = 0; n < maxAddresses; n++) {
      const addr = person.addresses[n];
      const typeLabel = addr?.label ?? (addr ? capitalizeFirst(addr.type) : '');
      cells.push(
        typeLabel,
        addr?.line1 ?? '',
        addr?.line2 ?? '',
        addr?.city ?? '',
        addr?.state ?? '',
        addr?.postalCode ?? '',
        addr?.country ?? '',
      );
    }

    return cells;
  });

  // 4. Assemble with RFC 4180 CRLF line endings
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return lines.join('\r\n');
}
