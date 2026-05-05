import type { DB } from '@philotes/db';
import { schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../routes/graphql.ts';
import { requireAuth } from './auth.ts';

// ── CSV parsing utilities ────────────────────────────────────────────────────

interface ParsedContact {
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
  if (!raw) return null;

  // --MM-DD format (no year)
  if (raw.startsWith('--')) return null;

  // 0000-MM-DD format (no year)
  if (raw.startsWith('0000-')) return null;

  // YYYY-MM-DD — validate and return as-is
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  if (year === 0) return null;

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
    if (i === 0) h = h.replace(/^\uFEFF/, '');
    h = normalizeHyphens(h);
    headerIndex.set(h, i);
  }

  const col = (row: string[], name: string): string => {
    const idx = headerIndex.get(name);
    if (idx === undefined) return '';
    return stripGoogleDuplicate((row[idx] ?? '').trim());
  };

  const hasCol = (name: string): boolean => headerIndex.has(name);

  const contacts: ParsedContact[] = [];
  let skippedCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // Skip entirely empty rows
    if (row.every((cell) => cell.trim() === '')) continue;

    const firstName = col(row, 'First Name');
    const lastName = col(row, 'Last Name');
    const fullName = col(row, 'Name');

    // Skip contacts with no name data
    if (!firstName && !lastName && !fullName) continue;

    // Resolve names with fallback to Name column
    const nameParts = fullName.split(' ').filter(Boolean);
    const resolvedFirstName = firstName || nameParts[0] || '';
    const resolvedLastName = lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    if (!resolvedFirstName && !resolvedLastName) continue;

    // Collect emails — stop when the value column doesn't exist
    const rawEmails: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `E-mail ${n} - Value`;
      if (!hasCol(valueKey)) break;
      const value = col(row, valueKey);
      const rawLabel = col(row, `E-mail ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
      if (value) rawEmails.push({ label, value });
    }

    // Deduplicate emails by value (keep first occurrence)
    const seenEmailValues = new Set<string>();
    const emails = rawEmails.filter((e) => {
      if (seenEmailValues.has(e.value)) return false;
      seenEmailValues.add(e.value);
      return true;
    });

    // Collect phones
    const phones: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `Phone ${n} - Value`;
      if (!hasCol(valueKey)) break;
      const value = col(row, valueKey);
      const rawLabel = col(row, `Phone ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
      if (value) phones.push({ label, value });
    }

    // Collect websites
    const websites: Array<{ label: string; value: string }> = [];
    for (let n = 1; ; n++) {
      const valueKey = `Website ${n} - Value`;
      if (!hasCol(valueKey)) break;
      const value = col(row, valueKey);
      const rawLabel = col(row, `Website ${n} - Label`);
      const label = rawLabel.startsWith('* ') ? rawLabel.slice(2) : rawLabel;
      if (value) websites.push({ label, value });
    }

    // Collect addresses — stop when the street column doesn't exist
    const addressList: ParsedContact['addresses'] = [];
    for (let n = 1; ; n++) {
      const streetKey = `Address ${n} - Street`;
      if (!hasCol(streetKey)) break;

      const line1 = col(row, streetKey);
      if (!line1) continue;

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
        if (lower === 'my contacts' || lower === 'mycontacts') continue;
        if (seenLabels.has(lower)) continue;
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

// ── Error utilities ──────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
  return (
    msg.includes('unique') || msg.includes('duplicate') || causeMsg.includes('unique') || causeMsg.includes('duplicate')
  );
}

// ── GraphQL extension ────────────────────────────────────────────────────────

const IMPORT_CONTACTS_SDL = parse(`
  type ImportContactsResult {
    imported: Int!
    merged: Int!
    skipped: Int!
    errors: [String!]!
  }

  extend type Mutation {
    importGoogleContacts(csv: String!): ImportContactsResult!
  }
`);

interface ImportGoogleContactsArgs {
  csv: string;
}

interface ImportContactsResult {
  imported: number;
  merged: number;
  skipped: number;
  errors: string[];
}

export function applyImportContactsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, IMPORT_CONTACTS_SDL);

  const mutationType = extendedSchema.getType('Mutation') as GraphQLObjectType;

  mutationType.getFields().importGoogleContacts.resolve = async (
    _parent: unknown,
    args: ImportGoogleContactsArgs,
    context: Context,
  ): Promise<ImportContactsResult> => {
    const userId = requireAuth(context);
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const db = context.db as any;

    // ── Step 1: Parse CSV ─────────────────────────────────────────────────
    const { contacts, skippedCount } = parseGoogleContactsCsv(args.csv);

    // ── Step 2: Upsert Labels (user-scoped) ──────────────────────────────
    const allLabelNames = new Set<string>();
    for (const contact of contacts) {
      for (const name of contact.labels) {
        allLabelNames.add(name);
      }
    }

    const labelNameToId = new Map<string, string>();

    if (allLabelNames.size > 0) {
      const existingLabels: Array<{ id: string; label: string }> = await db
        .select({ id: dbSchema.labels.id, label: dbSchema.labels.label })
        .from(dbSchema.labels)
        .where(eq(dbSchema.labels.userId, userId));

      for (const row of existingLabels) {
        labelNameToId.set(row.label.toLowerCase(), row.id);
      }

      // Insert any labels not already in the DB (user-scoped)
      for (const name of allLabelNames) {
        if (labelNameToId.has(name)) continue;

        const [inserted] = await db
          .insert(dbSchema.labels)
          .values({ label: name, color: '#6b7280', userId })
          .returning({ id: dbSchema.labels.id });

        if (inserted) {
          labelNameToId.set(name, inserted.id);
        }
      }
    }

    // ── Step 3 & 4: Insert persons and related data ───────────────────────
    let importedCount = 0;
    let mergedCount = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      let personId: string;

      try {
        const [inserted] = await db
          .insert(dbSchema.persons)
          .values({
            firstName: contact.firstName,
            lastName: contact.lastName || contact.firstName,
            email: contact.email,
          })
          .returning({ id: dbSchema.persons.id });

        if (!inserted) {
          errors.push(`Failed to insert ${contact.firstName} ${contact.lastName}: no row returned`);
          continue;
        }

        personId = inserted.id;
        importedCount++;
      } catch (err: unknown) {
        if (!isUniqueViolation(err)) {
          errors.push(`Failed to import ${contact.firstName} ${contact.lastName}: ${errorMessage(err)}`);
          continue;
        }

        // Duplicate email — fetch the existing person's ID and merge their data.
        // This branch is only reachable when contact.email is non-null (null emails
        // never trigger a unique constraint violation in Postgres).
        const [existing] = await db
          .select({ id: dbSchema.persons.id })
          .from(dbSchema.persons)
          .where(eq(dbSchema.persons.email, contact.email!));

        if (!existing) {
          errors.push(`Could not find existing person for email ${contact.email}`);
          continue;
        }

        personId = existing.id;
        mergedCount++;
      }

      // Ensure user_persons link exists (idempotent)
      await db
        .insert(dbSchema.userPersons)
        .values({ userId, personId })
        .onConflictDoNothing();

      // ── Step 4: Insert related data in parallel ──────────────────────
      // Each helper is isolated with .catch() so a failure in one (e.g. a
      // duplicate address) does not roll back an otherwise-successful import.
      await Promise.all([
        insertContactInfos(db, personId, userId, contact).catch((err: unknown) => {
          errors.push(`contactInfos failure for ${contact.firstName} ${contact.lastName}: ${errorMessage(err)}`);
        }),
        insertAddresses(db, personId, userId, contact).catch((err: unknown) => {
          errors.push(`addresses failure for ${contact.firstName} ${contact.lastName}: ${errorMessage(err)}`);
        }),
        insertBirthday(db, personId, userId, contact).catch((err: unknown) => {
          errors.push(`birthday failure for ${contact.firstName} ${contact.lastName}: ${errorMessage(err)}`);
        }),
        insertPersonLabels(db, personId, userId, contact.labels, labelNameToId).catch((err: unknown) => {
          errors.push(`personLabels failure for ${contact.firstName} ${contact.lastName}: ${errorMessage(err)}`);
        }),
      ]);
    }

    return {
      imported: importedCount,
      merged: mergedCount,
      skipped: skippedCount,
      errors,
    };
  };

  return extendedSchema;
}

// ── Related data inserters ───────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
async function insertContactInfos(db: any, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  const rows: Array<{
    personId: string;
    userId: string;
    type: 'email' | 'phone' | 'mobile' | 'linkedin' | 'twitter' | 'instagram' | 'website' | 'other';
    value: string;
    label: string | undefined;
    isPrimary: boolean;
  }> = [];

  for (let i = 0; i < contact.emails.length; i++) {
    const e = contact.emails[i];
    rows.push({
      personId,
      userId,
      type: 'email',
      value: e.value,
      label: e.label || undefined,
      isPrimary: i === 0,
    });
  }

  for (const p of contact.phones) {
    const lower = p.label.toLowerCase();
    const type: 'phone' | 'mobile' = lower.includes('mobile') ? 'mobile' : 'phone';
    rows.push({
      personId,
      userId,
      type,
      value: p.value,
      label: p.label || undefined,
      isPrimary: false,
    });
  }

  for (const w of contact.websites) {
    rows.push({
      personId,
      userId,
      type: 'website',
      value: w.value,
      label: w.label || undefined,
      isPrimary: false,
    });
  }

  if (rows.length === 0) return;

  // Pre-filter: skip any incoming entries whose value already exists for this person
  const existingInfos: Array<{ value: string }> = await db
    .select({ value: dbSchema.contactInfos.value })
    .from(dbSchema.contactInfos)
    .where(eq(dbSchema.contactInfos.personId, personId));
  const existingValues = new Set(existingInfos.map((r: { value: string }) => r.value));

  const newRows = rows.filter((r) => !existingValues.has(r.value));
  if (newRows.length === 0) return;

  await db.insert(dbSchema.contactInfos).values(newRows);
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
async function insertAddresses(db: any, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (contact.addresses.length === 0) return;

  const rows = contact.addresses.map((addr) => {
    const lower = addr.label.toLowerCase();
    const type: 'home' | 'work' | 'other' = lower.includes('home') ? 'home' : lower.includes('work') ? 'work' : 'other';

    return {
      personId,
      userId,
      type,
      label: addr.label || undefined,
      line1: addr.line1,
      city: addr.city || undefined,
      state: addr.state || undefined,
      postalCode: addr.postalCode || undefined,
      country: addr.country || undefined,
    };
  });

  // Pre-filter: skip any incoming addresses whose line1 already exists for this person
  const existingAddrs: Array<{ line1: string }> = await db
    .select({ line1: dbSchema.addresses.line1 })
    .from(dbSchema.addresses)
    .where(eq(dbSchema.addresses.personId, personId));
  const existingLine1s = new Set(existingAddrs.map((r: { line1: string }) => r.line1));

  const newRows = rows.filter((r) => !existingLine1s.has(r.line1));
  if (newRows.length === 0) return;

  await db.insert(dbSchema.addresses).values(newRows);
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
async function insertBirthday(db: any, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (!contact.birthday) return;

  // DB wins — skip if a Birthday already exists for this person+user
  const existing: Array<{ id: string }> = await db
    .select({ id: dbSchema.importantDates.id })
    .from(dbSchema.importantDates)
    .where(
      and(
        eq(dbSchema.importantDates.personId, personId),
        eq(dbSchema.importantDates.userId, userId),
        eq(dbSchema.importantDates.name, 'Birthday'),
      ),
    );

  if (existing.length > 0) return;

  await db.insert(dbSchema.importantDates).values({
    personId,
    userId,
    name: 'Birthday',
    date: contact.birthday,
    recurrence: 'yearly',
  });
}

async function insertPersonLabels(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
  db: any,
  personId: string,
  userId: string,
  labelNames: string[],
  labelNameToId: Map<string, string>,
): Promise<void> {
  if (labelNames.length === 0) return;

  const rows: Array<{ personId: string; labelId: string; userId: string }> = [];
  for (const name of labelNames) {
    const labelId = labelNameToId.get(name);
    if (!labelId) continue;
    rows.push({ personId, labelId, userId });
  }

  if (rows.length === 0) return;

  // Batch insert; .onConflictDoNothing() handles duplicate (personId, labelId) pairs
  // that can arise when a contact is re-imported or two rows share a label.
  await db.insert(dbSchema.personLabels).values(rows).onConflictDoNothing();
}
