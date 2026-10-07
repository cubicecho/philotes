import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';
import { objectType } from '../graphql/object-type.ts';
import { parseGoogleContactsCsv } from './google-contacts-csv.ts';
import { insertAddresses, insertBirthday, insertContactInfos, insertPersonLabels } from './person-details.ts';

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

/**
 * Finds the person among a user's own who has an email address, whatever its case.
 *
 * @param db - Drizzle client.
 * @param userId - The user whose people are searched.
 * @param email - The address.
 * @returns The person's id, or null when none of the user's people has it. The oldest wins when several do.
 */
async function findOwnPersonByEmail(db: DB, userId: string, email: string): Promise<string | null> {
  const { contactInfos } = dbSchema;
  const [match] = await db
    .select({ personId: contactInfos.personId })
    .from(contactInfos)
    .where(
      and(
        eq(contactInfos.userId, userId),
        eq(contactInfos.type, dbSchema.ContactType.Email),
        eq(sql`lower(${contactInfos.value})`, email.trim().toLowerCase()),
      ),
    )
    .orderBy(contactInfos.createdAt)
    .limit(1);
  return match?.personId ?? null;
}

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

/**
 * Adds `importGoogleContacts` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the import mutation.
 */
export function applyImportContactsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, IMPORT_CONTACTS_SDL);

  const mutationType = objectType(extendedSchema, 'Mutation');

  /**
   * Resolves `Mutation.importGoogleContacts`. Adds every contact in a Google Contacts CSV export to the
   * signed-in caller's contacts, creating the labels it names. A contact whose first email one of the
   * caller's people already has is merged into that person. A contact that fails is reported in `errors`, and the rest still go in.
   *
   * @param _parent - Unused.
   * @param args.csv - The export file's text.
   * @param context - Request context.
   * @returns How many contacts were imported, merged and skipped, and a message for each failure.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
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
        // A label is the same one whatever its case, and the first spelling met is the one kept.
        const key = name.toLowerCase();
        const isKnownLabel = labelNameToId.has(key);
        if (isKnownLabel) {
          continue;
        }

        const [inserted] = await db
          .insert(dbSchema.labels)
          .values({ label: name, color: '#6b7280', userId })
          .returning({ id: dbSchema.labels.id });

        if (inserted) {
          labelNameToId.set(key, inserted.id);
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
        const existingId = contact.email === null ? null : await findOwnPersonByEmail(db, userId, contact.email);
        if (existingId === null) {
          const [inserted] = await db
            .insert(dbSchema.persons)
            .values({ userId, firstName: contact.firstName, lastName: contact.lastName || contact.firstName })
            .returning({ id: dbSchema.persons.id });

          if (!inserted) {
            errors.push(`Failed to insert ${contact.firstName} ${contact.lastName}: no row returned`);
            continue;
          }

          personId = inserted.id;
          importedCount++;
        } else {
          personId = existingId;
          mergedCount++;
        }
      } catch (err: unknown) {
        reportFailure(errors, `Failed to import ${contact.firstName} ${contact.lastName}`, err);
        continue;
      }

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
