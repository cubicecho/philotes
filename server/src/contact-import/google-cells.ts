// How Google Contacts writes the cells of its CSV export, and how each is read back to a plain value.

/** What Google puts between the values of a cell that holds several. */
export const VALUE_SEPARATOR = ' ::: ';
/** What Google puts in front of the label of an entry it marks as the default. */
const DEFAULT_LABEL_PREFIX = '* ';
/** Google's own "everyone" groups, which say nothing about a contact. */
export const NOISE_LABELS = new Set(['my contacts', 'mycontacts']);

/**
 * Keeps the first value of a cell Google wrote as "val ::: val".
 *
 * @param s - The cell's text.
 * @returns The first value, or the whole cell when it holds one. Trimmed either way.
 */
export function stripGoogleDuplicate(s: string): string {
  const idx = s.indexOf(VALUE_SEPARATOR);
  const hasSeveralValues = idx !== -1;
  return hasSeveralValues ? s.slice(0, idx).trim() : s.trim();
}

/**
 * Drops the "* " Google puts in front of a default entry's label.
 *
 * @param label - The label as exported.
 * @returns The label without the marker.
 */
export function stripDefaultMarker(label: string): string {
  const isDefault = label.startsWith(DEFAULT_LABEL_PREFIX);
  return isDefault ? label.slice(DEFAULT_LABEL_PREFIX.length) : label;
}

/**
 * Turns the Unicode hyphens U+2010 to U+2013 into the ASCII hyphen-minus.
 *
 * @param s - Text that may hold them, here a column header.
 * @returns The text with ASCII hyphens.
 */
export function normalizeHyphens(s: string): string {
  return s.replace(/[\u2010\u2011\u2012\u2013]/g, '-');
}

/**
 * Reads a birthday from a Google CSV cell.
 *
 * @param raw - The cell's text.
 * @returns The date as `YYYY-MM-DD`. null when the cell is empty, gives no year (`--MM-DD` or `0000-MM-DD`), or
 * is in any other form.
 */
export function parseBirthday(raw: string): string | null {
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
