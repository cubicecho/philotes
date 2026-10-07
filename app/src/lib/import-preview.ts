/** A rough look at a contacts file, read without parsing it properly. The server does the real reading. */
export interface FilePreview {
  /** About how many contacts the file holds. */
  contactCount: number;
  /** The first few names. */
  names: string[];
}

const UNKNOWN_NAME = '(unknown)';
const LINE_BREAK = /\r?\n|\r/;
const SURROUNDING_QUOTES = /^"|"$/g;
const VCARD_START = /^BEGIN:VCARD\s*$/i;
/** A vCard's formatted name line, with or without a group and parameters: `FN:`, `item1.FN;CHARSET=UTF-8:`. */
const VCARD_NAME = /^(?:[\w-]+\.)?FN(?:;[^:]*)?:(.*)$/i;
/** A backslash escape in a vCard value: `\,` `\;` `\\`. */
const VCARD_ESCAPE = /\\([,;\\])/g;

/**
 * Reads one cell of a CSV line, best-effort: no quoted commas.
 *
 * @param cell - The text between two commas.
 * @returns The cell without its surrounding quotes.
 */
function unquote(cell: string): string {
  return cell.replace(SURROUNDING_QUOTES, '').trim();
}

/**
 * Previews a Google Contacts CSV: one contact per line after the header, named by its first two cells.
 *
 * @param text - The file's text.
 * @param nameCount - How many names to read.
 * @returns The count and the first names.
 */
export function previewGoogleCsv(text: string, nameCount: number): FilePreview {
  const lines = text.split(LINE_BREAK).filter((line) => line.trim().length > 0);
  const rows = lines.slice(1);
  const names = rows.slice(0, nameCount).map((line) => {
    const [first = '', last = ''] = line.split(',');
    return [unquote(first), unquote(last)].filter(Boolean).join(' ') || UNKNOWN_NAME;
  });
  return { contactCount: rows.length, names };
}

/**
 * Previews a vCard file: one contact per `BEGIN:VCARD`, named by its `FN` line.
 *
 * @param text - The file's text.
 * @param nameCount - How many names to read.
 * @returns The count and the first names.
 */
export function previewVCards(text: string, nameCount: number): FilePreview {
  const lines = text.split(LINE_BREAK);
  const contactCount = lines.filter((line) => VCARD_START.test(line)).length;
  const names: string[] = [];
  for (const line of lines) {
    if (names.length >= nameCount) {
      break;
    }
    const name = VCARD_NAME.exec(line)?.[1]?.replace(VCARD_ESCAPE, '$1').trim();
    if (name) {
      names.push(name);
    }
  }
  return { contactCount, names };
}
