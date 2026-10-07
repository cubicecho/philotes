import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import type { ParsedContact } from './google-contacts-csv.ts';

// What an imported contact adds to a person: contact details, addresses, a birthday and labels. Each
// leaves out what the user already has there, so importing the same file twice adds nothing.

const { AddressType, ContactType, Recurrence } = dbSchema;

/** A phone whose Google label holds this word is a mobile. */
const MOBILE_LABEL_WORD = 'mobile';

/** The address type a Google label names, by the word it holds. The first match wins. */
const ADDRESS_LABEL_WORDS = [
  { word: 'home', type: AddressType.Home },
  { word: 'work', type: AddressType.Work },
] as const;

/**
 * Adds a contact's emails, phones and websites to a person, leaving out any value the user already has
 * there. The first email is the primary one, and a phone labelled as a mobile is stored as one.
 *
 * @param db - Drizzle client.
 * @param personId - The person the rows belong to.
 * @param userId - The user importing them.
 * @param contact - The parsed contact.
 * @returns Resolves once the new details are in.
 */
export async function insertContactInfos(
  db: DB,
  personId: string,
  userId: string,
  contact: ParsedContact,
): Promise<void> {
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
  // Whatever the case: the import finds a person by an email in any case, so it must not add it again in another.
  const existingValues = new Set(existingInfos.map((r) => r.value.trim().toLowerCase()));

  const newRows = rows.filter((r) => existingValues.has(r.value.trim().toLowerCase()) === false);
  if (newRows.length === 0) {
    return;
  }

  await db.insert(dbSchema.contactInfos).values(newRows);
}

/**
 * Adds a contact's addresses to a person, leaving out any whose first line the user already has there.
 * An address is home or work when its label says so, and other when it does not.
 *
 * @param db - Drizzle client.
 * @param personId - The person the rows belong to.
 * @param userId - The user importing them.
 * @param contact - The parsed contact.
 * @returns Resolves once the new addresses are in.
 */
export async function insertAddresses(db: DB, personId: string, userId: string, contact: ParsedContact): Promise<void> {
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
      line2: addr.line2 || undefined,
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

/**
 * Adds a contact's birthday as a yearly important date named "Birthday". A person who already has one
 * for this user keeps it.
 *
 * @param db - Drizzle client.
 * @param personId - The person the rows belong to.
 * @param userId - The user importing them.
 * @param contact - The parsed contact.
 * @returns Resolves once the date is in, or at once when there is nothing to add.
 */
export async function insertBirthday(db: DB, personId: string, userId: string, contact: ParsedContact): Promise<void> {
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

/**
 * Tags a person with a contact's labels. A label the person already has is left as it is.
 *
 * @param db - Drizzle client.
 * @param personId - The person to tag.
 * @param userId - The user importing the contact, who owns the labels.
 * @param labelNames - The contact's label names, in the case the file gave them.
 * @param labelNameToId - The user's labels by lower-cased name. A name missing from it is passed over.
 * @returns Resolves once the tags are in.
 */
export async function insertPersonLabels(
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
    const labelId = labelNameToId.get(name.toLowerCase());
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
