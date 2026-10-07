// Parses a Google Contacts CSV export into the shape `importGoogleContacts`
// inserts. Pure — no database, no GraphQL — so it can be tested directly.

import { parseCsvRfc4180 } from './csv.ts';
import {
  NOISE_LABELS,
  normalizeHyphens,
  parseBirthday,
  stripDefaultMarker,
  stripGoogleDuplicate,
  VALUE_SEPARATOR,
} from './google-cells.ts';

/** One contact read from a row of a Google Contacts CSV export. */
export interface ParsedContact {
  /** The empty string when the row has none, as is every name and work field below. */
  firstName: string;
  lastName: string;
  namePrefix: string;
  middleName: string;
  nameSuffix: string;
  nickname: string;
  organization: string;
  jobTitle: string;
  department: string;
  /** The row's notes. */
  about: string;
  /** The first of `emails`, or null when the row has none. */
  email: string | null;
  emails: Array<{ label: string; value: string }>;
  phones: Array<{ label: string; value: string }>;
  websites: Array<{ label: string; value: string }>;
  addresses: Array<{
    label: string;
    line1: string;
    /** The empty string when the row has no second line. */
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  /** As `YYYY-MM-DD`, or null when the row has none. */
  birthday: string | null;
  /** false when the row gave the birthday's month and day only. The year in `birthday` is then a placeholder. */
  birthdayHasYear: boolean;
  /** In the case the file gave them, each once whatever its case, without Google's own "my contacts" group. */
  labels: string[];
}

/**
 * Parses a Google Contacts CSV export into contacts. The first row is the header. A blank row, and a row
 * with no name, nickname or organization, is left out.
 *
 * @param csvText - The export file's text.
 * @returns The contacts, and how many rows were left out for having nothing to call them by. A blank row is not counted.
 */
export function parseGoogleContactsCsv(csvText: string): {
  contacts: ParsedContact[];
  skippedCount: number;
} {
  const rows = parseCsvRfc4180(csvText);

  // The first row is the header, so a file with fewer than two holds no contact.
  const hasNoContactRows = rows.length < 2;
  if (hasNoContactRows) {
    return { contacts: [], skippedCount: 0 };
  }

  // Build header→index map with normalized headers
  const rawHeaders = rows[0];
  const headerIndex = new Map<string, number>();
  for (let i = 0; i < rawHeaders.length; i++) {
    let h = rawHeaders[i].trim();
    // BOM may survive into first header even after stripping from file start
    if (i === 0) {
      h = h.replace(/^\uFEFF/, '');
    }
    h = normalizeHyphens(h);
    headerIndex.set(h, i);
  }

  const col = (row: string[], name: string): string => {
    const idx = headerIndex.get(name);
    if (idx === undefined) {
      return '';
    }
    return stripGoogleDuplicate((row[idx] ?? '').trim());
  };

  const hasCol = (name: string): boolean => headerIndex.has(name);

  const contacts: ParsedContact[] = [];
  let skippedCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // Skip entirely empty rows
    const isBlankRow = row.every((cell) => cell.trim() === '');
    if (isBlankRow) {
      continue;
    }

    const firstName = col(row, 'First Name');
    const lastName = col(row, 'Last Name');
    const fullName = col(row, 'Name');

    const nickname = col(row, 'Nickname');
    const organization = col(row, 'Organization Name');

    // Resolve names with fallback to Name column
    const nameParts = fullName.split(' ').filter(Boolean);
    const resolvedFirstName = firstName || nameParts[0] || '';
    const resolvedLastName = lastName || nameParts.slice(1).join(' ');

    // Skip a contact with nothing to call it by
    const isUnnamed = [resolvedFirstName, resolvedLastName, nickname, organization].every((part) => part === '');
    if (isUnnamed) {
      skippedCount++;
      continue;
    }

    // Collect emails — stop when the value column doesn't exist
    const rawEmails: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `E-mail ${n} - Value`;
      const isPastLastColumn = hasCol(valueKey) === false;
      if (isPastLastColumn) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `E-mail ${n} - Label`);
      const label = stripDefaultMarker(rawLabel);
      if (value) {
        rawEmails.push({ label, value });
      }
    }

    // Deduplicate emails by value (keep first occurrence)
    const seenEmailValues = new Set<string>();
    const emails = rawEmails.filter((e) => {
      if (seenEmailValues.has(e.value)) {
        return false;
      }
      seenEmailValues.add(e.value);
      return true;
    });

    // Collect phones
    const phones: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `Phone ${n} - Value`;
      const isPastLastColumn = hasCol(valueKey) === false;
      if (isPastLastColumn) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `Phone ${n} - Label`);
      const label = stripDefaultMarker(rawLabel);
      if (value) {
        phones.push({ label, value });
      }
    }

    // Collect websites
    const websites: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `Website ${n} - Value`;
      const isPastLastColumn = hasCol(valueKey) === false;
      if (isPastLastColumn) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `Website ${n} - Label`);
      const label = stripDefaultMarker(rawLabel);
      if (value) {
        websites.push({ label, value });
      }
    }

    // Collect addresses — stop when the street column doesn't exist
    const addressList: ParsedContact['addresses'] = [];
    for (let n = 1; ; n++) {
      const streetKey = `Address ${n} - Street`;
      const isPastLastColumn = hasCol(streetKey) === false;
      if (isPastLastColumn) {
        break;
      }

      const line1 = col(row, streetKey);
      if (!line1) {
        continue;
      }

      const rawLabel = col(row, `Address ${n} - Label`);
      const label = stripDefaultMarker(rawLabel);

      addressList.push({
        label,
        line1,
        line2: col(row, `Address ${n} - Extended Address`),
        city: col(row, `Address ${n} - City`),
        state: col(row, `Address ${n} - Region`),
        postalCode: col(row, `Address ${n} - Postal Code`),
        country: col(row, `Address ${n} - Country`),
      });
    }

    // Parse birthday
    const birthday = parseBirthday(col(row, 'Birthday'));

    // Parse labels — split on " ::: ", strip "* " prefix, dedupe whatever the case
    const rawLabelsCell = col(row, 'Labels');
    const parsedLabels: string[] = [];
    if (rawLabelsCell) {
      // rawLabelsCell already had ::: stripping applied by col(), but Labels
      // intentionally contains multiple values separated by " ::: " — re-read raw
      const rawLabelsCellIdx = headerIndex.get('Labels');
      const rawLabelsCellValue = rawLabelsCellIdx !== undefined ? (row[rawLabelsCellIdx] ?? '').trim() : '';
      const labelParts = rawLabelsCellValue
        .split(VALUE_SEPARATOR)
        .map((s) => s.trim())
        .filter(Boolean);

      const seenLabels = new Set<string>();
      for (const part of labelParts) {
        const stripped = stripDefaultMarker(part);
        const lower = stripped.toLowerCase();
        // Exclude "my contacts" / "mycontacts" noise labels
        const isNoiseLabel = NOISE_LABELS.has(lower);
        if (isNoiseLabel) {
          continue;
        }
        if (seenLabels.has(lower)) {
          continue;
        }
        seenLabels.add(lower);
        parsedLabels.push(stripped);
      }
    }

    contacts.push({
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      namePrefix: col(row, 'Name Prefix'),
      middleName: col(row, 'Middle Name'),
      nameSuffix: col(row, 'Name Suffix'),
      nickname,
      organization,
      jobTitle: col(row, 'Organization Title'),
      department: col(row, 'Organization Department'),
      about: col(row, 'Notes'),
      email: emails[0]?.value ?? null,
      emails,
      phones,
      websites,
      addresses: addressList,
      birthday: birthday?.date ?? null,
      birthdayHasYear: birthday?.hasYear ?? true,
      labels: parsedLabels,
    });
  }

  return { contacts, skippedCount };
}
