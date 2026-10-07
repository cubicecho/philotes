import { schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import { requireAuth } from '../auth/resolvers.ts';
import type { Context } from '../graphql/handler.ts';
import { type ParsedContact, parseGoogleContactsCsv } from './google-contacts-csv.ts';

// ── Error utilities ──────────────────────────────────────────────────────────

/**
 * Records a failed step for the caller and logs why. The database's own message names tables,
 * columns and constraints, so it goes to the log and never into the response.
 *
 * @param errors - The messages returned to the caller.
 * @param summary - What failed, in words that are safe to show.
 * @param err - What was thrown.
 * @returns Nothing.
 */
function reportFailure(errors: string[], summary: string, err: unknown): void {
  console.error(`[import] ${summary}`, err);
  errors.push(summary);
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
        if (labelNameToId.has(name)) {
          continue;
        }

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
        // A null email never trips the unique constraint, so a duplicate always has one.
        const { email } = contact;
        const isOtherFailure = isUniqueViolation(err) === false || email === null;
        if (isOtherFailure) {
          reportFailure(errors, `Failed to import ${contact.firstName} ${contact.lastName}`, err);
          continue;
        }

        // Duplicate email — fetch the existing person's ID and merge their data.
        const [existing] = await db
          .select({ id: dbSchema.persons.id })
          .from(dbSchema.persons)
          .where(eq(dbSchema.persons.email, email));

        if (!existing) {
          errors.push(`Could not find existing person for email ${contact.email}`);
          continue;
        }

        personId = existing.id;
        mergedCount++;
      }

      // Ensure user_persons link exists (idempotent)
      await db.insert(dbSchema.userPersons).values({ userId, personId }).onConflictDoNothing();

      // ── Step 4: Insert related data in parallel ──────────────────────
      // Each helper is isolated with .catch() so a failure in one (e.g. a
      // duplicate address) does not roll back an otherwise-successful import.
      await Promise.all([
        insertContactInfos(db, personId, userId, contact).catch((err: unknown) => {
          reportFailure(errors, `Failed to import contact details for ${contact.firstName} ${contact.lastName}`, err);
        }),
        insertAddresses(db, personId, userId, contact).catch((err: unknown) => {
          reportFailure(errors, `Failed to import addresses for ${contact.firstName} ${contact.lastName}`, err);
        }),
        insertBirthday(db, personId, userId, contact).catch((err: unknown) => {
          reportFailure(errors, `Failed to import birthday for ${contact.firstName} ${contact.lastName}`, err);
        }),
        insertPersonLabels(db, personId, userId, contact.labels, labelNameToId).catch((err: unknown) => {
          reportFailure(errors, `Failed to import labels for ${contact.firstName} ${contact.lastName}`, err);
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

  if (rows.length === 0) {
    return;
  }

  // Pre-filter: skip any incoming entries this user already has for this person
  const existingInfos: Array<{ value: string }> = await db
    .select({ value: dbSchema.contactInfos.value })
    .from(dbSchema.contactInfos)
    .where(and(eq(dbSchema.contactInfos.personId, personId), eq(dbSchema.contactInfos.userId, userId)));
  const existingValues = new Set(existingInfos.map((r: { value: string }) => r.value));

  const newRows = rows.filter((r) => existingValues.has(r.value) === false);
  if (newRows.length === 0) {
    return;
  }

  await db.insert(dbSchema.contactInfos).values(newRows);
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
async function insertAddresses(db: any, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (contact.addresses.length === 0) {
    return;
  }

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

  // Pre-filter: skip any incoming addresses this user already has for this person
  const existingAddrs: Array<{ line1: string }> = await db
    .select({ line1: dbSchema.addresses.line1 })
    .from(dbSchema.addresses)
    .where(and(eq(dbSchema.addresses.personId, personId), eq(dbSchema.addresses.userId, userId)));
  const existingLine1s = new Set(existingAddrs.map((r: { line1: string }) => r.line1));

  const newRows = rows.filter((r) => existingLine1s.has(r.line1) === false);
  if (newRows.length === 0) {
    return;
  }

  await db.insert(dbSchema.addresses).values(newRows);
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
async function insertBirthday(db: any, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (!contact.birthday) {
    return;
  }

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

  if (existing.length > 0) {
    return;
  }

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
  if (labelNames.length === 0) {
    return;
  }

  const rows: Array<{ personId: string; labelId: string; userId: string }> = [];
  for (const name of labelNames) {
    const labelId = labelNameToId.get(name);
    if (!labelId) {
      continue;
    }
    rows.push({ personId, labelId, userId });
  }

  if (rows.length === 0) {
    return;
  }

  // Batch insert; .onConflictDoNothing() handles duplicate (personId, labelId) pairs
  // that can arise when a contact is re-imported or two rows share a label.
  await db.insert(dbSchema.personLabels).values(rows).onConflictDoNothing();
}
