// Parses a Google Contacts CSV export into the shape `importGoogleContacts`
// inserts. Pure — no database, no GraphQL — so it can be tested directly.

export interface ParsedContact {
  firstName: string;
  lastName: string;
  email: string | null;
  emails: Array<{ label: string; value: string }>;
  phones: Array<{ label: string; value: string }>;
  websites: Array<{ label: string; value: string }>;
  addresses: Array<{
    label: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  birthday: string | null;
  labels: string[];
}

/** Google CSV sometimes encodes values as "val ::: val" — take only the first part. */
function stripGoogleDuplicate(s: string): string {
  const idx = s.indexOf(' ::: ');
  return idx !== -1 ? s.slice(0, idx).trim() : s.trim();
}

/** Normalize Unicode hyphen variants (U+2010–U+2013) to ASCII hyphen-minus. */
function normalizeHyphens(s: string): string {
  return s.replace(/[\u2010\u2011\u2012\u2013]/g, '-');
}

/** Full RFC 4180 CSV parser. Handles BOM, quoted fields, escaped quotes, all line endings. */
function parseCsvRfc4180(input: string): string[][] {
  // Strip BOM from start of file
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // "" inside quotes → literal quote character
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush trailing row/field
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a birthday string from Google CSV format into an ISO date string.
 * Returns null when no year is known (--MM-DD or 0000-MM-DD) or when empty.
 */
function parseBirthday(raw: string): string | null {
  if (!raw) {
    return null;
  }

  // --MM-DD format (no year)
  if (raw.startsWith('--')) {
    return null;
  }

  // 0000-MM-DD format (no year)
  if (raw.startsWith('0000-')) {
    return null;
  }

  // YYYY-MM-DD — validate and return as-is
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  if (year === 0) {
    return null;
  }

  return raw;
}

/** Parse a Google Contacts CSV export into typed contacts. */
export function parseGoogleContactsCsv(csvText: string): {
  contacts: ParsedContact[];
  skippedCount: number;
} {
  const rows = parseCsvRfc4180(csvText);

  if (rows.length < 2) {
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
  const skippedCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // Skip entirely empty rows
    if (row.every((cell) => cell.trim() === '')) {
      continue;
    }

    const firstName = col(row, 'First Name');
    const lastName = col(row, 'Last Name');
    const fullName = col(row, 'Name');

    // Skip contacts with no name data
    if (!firstName && !lastName && !fullName) {
      continue;
    }

    // Resolve names with fallback to Name column
    const nameParts = fullName.split(' ').filter(Boolean);
    const resolvedFirstName = firstName || nameParts[0] || '';
    const resolvedLastName = lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    if (!resolvedFirstName && !resolvedLastName) {
      continue;
    }

    // Collect emails — stop when the value column doesn't exist
    const rawEmails: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `E-mail ${n} - Value`;
      if (!hasCol(valueKey)) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `E-mail ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
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
      if (!hasCol(valueKey)) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `Phone ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
      if (value) {
        phones.push({ label, value });
      }
    }

    // Collect websites
    const websites: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `Website ${n} - Value`;
      if (!hasCol(valueKey)) {
        break;
      }
      const value = col(row, valueKey);
      const rawLabel = col(row, `Website ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
      if (value) {
        websites.push({ label, value });
      }
    }

    // Collect addresses — stop when the street column doesn't exist
    const addressList: ParsedContact['addresses'] = [];
    for (let n = 1; ; n++) {
      const streetKey = `Address ${n} - Street`;
      if (!hasCol(streetKey)) {
        break;
      }

      const line1 = col(row, streetKey);
      if (!line1) {
        continue;
      }

      const rawLabel = col(row, `Address ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;

      addressList.push({
        label,
        line1,
        city: col(row, `Address ${n} - City`),
        state: col(row, `Address ${n} - Region`),
        postalCode: col(row, `Address ${n} - Postal Code`),
        country: col(row, `Address ${n} - Country`),
      });
    }

    // Parse birthday
    const birthday = parseBirthday(col(row, 'Birthday'));

    // Parse labels — split on " ::: ", strip "* " prefix, lowercase, dedupe
    const rawLabelsCell = col(row, 'Labels');
    const parsedLabels: string[] = [];
    if (rawLabelsCell) {
      // rawLabelsCell already had ::: stripping applied by col(), but Labels
      // intentionally contains multiple values separated by " ::: " — re-read raw
      const rawLabelsCellIdx = headerIndex.get('Labels');
      const rawLabelsCellValue = rawLabelsCellIdx !== undefined ? (row[rawLabelsCellIdx] ?? '').trim() : '';
      const labelParts = rawLabelsCellValue
        .split(' ::: ')
        .map((s) => s.trim())
        .filter(Boolean);

      const seenLabels = new Set<string>();
      for (const part of labelParts) {
        const stripped = part.startsWith('* ') ? part.slice(2) : part;
        const lower = stripped.toLowerCase();
        // Exclude "my contacts" / "mycontacts" noise labels
        if (lower === 'my contacts' || lower === 'mycontacts') {
          continue;
        }
        if (seenLabels.has(lower)) {
          continue;
        }
        seenLabels.add(lower);
        parsedLabels.push(lower);
      }
    }

    contacts.push({
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: emails[0]?.value ?? null,
      emails,
      phones,
      websites,
      addresses: addressList,
      birthday,
      labels: parsedLabels,
    });
  }

  return { contacts, skippedCount };
}
