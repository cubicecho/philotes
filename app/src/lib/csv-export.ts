// Google Contacts-compatible CSV export.
//
// The shapes below are what the exporter reads, not the GraphQL schema — the
// `ExportPersons` query in `components/settings/export-people-card.tsx` must
// select every field named here. Dates arrive as `Date` objects: the Apollo
// cache's scalar policies turn the wire strings into them.

import { localIsoDate } from '@/lib/local-date';

export interface ExportContactInfo {
  type: string;
  label: string | null;
  value: string;
  isPrimary: boolean;
}

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

export interface ExportImportantDate {
  name: string;
  /** Local midnight of the calendar day. */
  date: Date;
  recurrence?: string | null;
}

export interface ExportLabel {
  id: string;
  label: string;
  color: string;
}

export interface ExportPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  contactInfos: ExportContactInfo[];
  addresses: ExportAddress[];
  importantDates: ExportImportantDate[];
  labels: ExportLabel[];
}

export function csvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function contactInfoLabel(entry: ExportContactInfo, defaultLabel: string): string {
  const base = entry.label || defaultLabel;
  return entry.isPrimary ? `* ${base}` : base;
}

export function buildPersonsCsv(persons: ExportPerson[]): string {
  // 1. Calculate max counts across all persons
  const maxEmails = Math.max(0, ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'email').length));
  const maxPhones = Math.max(
    0,
    ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'phone' || c.type === 'mobile').length),
  );
  const maxWebsites = Math.max(0, ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'website').length));
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
    const emails = person.contactInfos.filter((c) => c.type === 'email');
    for (let n = 0; n < maxEmails; n++) {
      const entry = emails[n];
      cells.push(entry ? contactInfoLabel(entry, 'Home') : '', entry?.value ?? '');
    }

    // Phones
    const phones = person.contactInfos.filter((c) => c.type === 'phone' || c.type === 'mobile');
    for (let n = 0; n < maxPhones; n++) {
      const entry = phones[n];
      const defaultLabel = entry?.type === 'mobile' ? 'Mobile' : 'Phone';
      cells.push(entry ? contactInfoLabel(entry, defaultLabel) : '', entry?.value ?? '');
    }

    // Websites
    const websites = person.contactInfos.filter((c) => c.type === 'website');
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
