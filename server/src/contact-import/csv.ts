// Reads CSV text into rows of cells. It knows nothing of what the columns mean.

/** The byte order mark a spreadsheet export may start with. */
const BYTE_ORDER_MARK = '\uFEFF';

/**
 * Parses RFC 4180 CSV: a leading byte order mark, quoted fields, doubled quotes and every line ending.
 *
 * @param input - The file's text.
 * @returns The rows, each a list of cells.
 */
export function parseCsvRfc4180(input: string): string[][] {
  // Strip BOM from start of file
  const hasByteOrderMark = input.startsWith(BYTE_ORDER_MARK);
  const text = hasByteOrderMark ? input.slice(BYTE_ORDER_MARK.length) : input;

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
      const isCrlf = ch === '\r' && text[i + 1] === '\n';
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (isCrlf) {
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
  const hasTrailingRow = field !== '' || row.length > 0;
  if (hasTrailingRow) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
