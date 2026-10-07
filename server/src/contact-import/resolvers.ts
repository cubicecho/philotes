import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { errorMessage, requireAuth } from '../core/errors.ts';
import { objectType } from '../graphql/object-type.ts';
import { type ParsedContact, parseGoogleContactsCsv } from './google-contacts-csv.ts';

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
  const msg = errorMessage(err);
  const cause = err instanceof Error ? err.cause : undefined;
  const causeMsg = cause instanceof Error ? cause.message : '';
  return (
    msg.includes('unique') || msg.includes('duplicate') || causeMsg.includes('unique') || causeMsg.includes('duplicate')
  );
}

const { AddressType, ContactType, Recurrence } = dbSchema;

/** A phone whose Google label holds this word is a mobile. */
const MOBILE_LABEL_WORD = 'mobile';

/** The address type a Google label names, by the word it holds. The first match wins. */
const ADDRESS_LABEL_WORDS = [
  { word: 'home', type: AddressType.Home },
  { word: 'work', type: AddressType.Work },
] as const;

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

  const mutationType = objectType(extendedSchema, 'Mutation');

  mutationType.getFields().importGoogleContacts.resolve = async (
    _parent: unknown,
    args: ImportGoogleContactsArgs,
    context: Context,
  ): Promise<ImportContactsResult> => {
    const userId = requireAuth(context);
    const { db } = context;

    // Step 1: Parse CSV
    const { contacts, skippedCount } = parseGoogleContactsCsv(args.csv);

    // Step 2: Upsert Labels (user-scoped)
    const allLabelNames = new Set<string>();
    for (const contact of contacts) {
      for (const name of contact.labels) {
        allLabelNames.add(name);
      }
    }

    const labelNameToId = new Map<string, string>();

    if (allLabelNames.size > 0) {
      const existingLabels = await db
        .select({ id: dbSchema.labels.id, label: dbSchema.labels.label })
        .from(dbSchema.labels)
        .where(eq(dbSchema.labels.userId, userId));

      for (const row of existingLabels) {
        labelNameToId.set(row.label.toLowerCase(), row.id);
      }

      // Insert any labels not already in the DB (user-scoped)
      for (const name of allLabelNames) {
        const isKnownLabel = labelNameToId.has(name);
        if (isKnownLabel) {
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

    // Step 3 & 4: Insert persons and related data
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

      // Step 4: Insert related data in parallel
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

async function insertContactInfos(db: DB, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  const rows: dbSchema.NewContactInfo[] = [];

  for (let i = 0; i < contact.emails.length; i++) {
    const e = contact.emails[i];
    const isFirstEmail = i === 0;
    rows.push({
      personId,
      userId,
      type: ContactType.Email,
      value: e.value,
      label: e.label || undefined,
      isPrimary: isFirstEmail,
    });
  }

  for (const p of contact.phones) {
    const lower = p.label.toLowerCase();
    const isMobile = lower.includes(MOBILE_LABEL_WORD);
    const type = isMobile ? ContactType.Mobile : ContactType.Phone;
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
      type: ContactType.Website,
      value: w.value,
      label: w.label || undefined,
      isPrimary: false,
    });
  }

  if (rows.length === 0) {
    return;
  }

  // Pre-filter: skip any incoming entries this user already has for this person
  const existingInfos = await db
    .select({ value: dbSchema.contactInfos.value })
    .from(dbSchema.contactInfos)
    .where(and(eq(dbSchema.contactInfos.personId, personId), eq(dbSchema.contactInfos.userId, userId)));
  const existingValues = new Set(existingInfos.map((r) => r.value));

  const newRows = rows.filter((r) => existingValues.has(r.value) === false);
  if (newRows.length === 0) {
    return;
  }

  await db.insert(dbSchema.contactInfos).values(newRows);
}

async function insertAddresses(db: DB, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (contact.addresses.length === 0) {
    return;
  }

  const rows = contact.addresses.map((addr) => {
    const lower = addr.label.toLowerCase();
    const type = ADDRESS_LABEL_WORDS.find(({ word }) => lower.includes(word))?.type ?? AddressType.Other;

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
  const existingAddrs = await db
    .select({ line1: dbSchema.addresses.line1 })
    .from(dbSchema.addresses)
    .where(and(eq(dbSchema.addresses.personId, personId), eq(dbSchema.addresses.userId, userId)));
  const existingLine1s = new Set(existingAddrs.map((r) => r.line1));

  const newRows = rows.filter((r) => existingLine1s.has(r.line1) === false);
  if (newRows.length === 0) {
    return;
  }

  await db.insert(dbSchema.addresses).values(newRows);
}

async function insertBirthday(db: DB, personId: string, userId: string, contact: ParsedContact): Promise<void> {
  if (!contact.birthday) {
    return;
  }

  // DB wins — skip if a Birthday already exists for this person+user
  const existing = await db
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
    recurrence: Recurrence.Yearly,
  });
}

async function insertPersonLabels(
  db: DB,
  personId: string,
  userId: string,
  labelNames: string[],
  labelNameToId: Map<string, string>,
): Promise<void> {
  if (labelNames.length === 0) {
    return;
  }

  const rows: dbSchema.NewPersonLabel[] = [];
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
