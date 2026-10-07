import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, createTestDb, createUser, type TestDb } from '../helpers.ts';

const IMPORT = 'mutation ($csv: String!) { importGoogleContacts(csv: $csv) { imported merged errors } }';
const SHARED_PHONE = '555-0100';
const SHARED_EMAIL = 'ada@example.com';
/** What one import stores as contact details, sorted. */
const CONTACT_VALUES = [SHARED_PHONE, SHARED_EMAIL];
const CSV = [
  'First Name,Last Name,E-mail 1 - Value,Phone 1 - Value,Address 1 - Street,Address 1 - Extended Address',
  `Ada,Lovelace,${SHARED_EMAIL},${SHARED_PHONE},1 Analytical Way,Flat 2`,
].join('\n');

describe('importGoogleContacts', () => {
  let db: TestDb;
  let firstUserId: string;
  let secondUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    firstUserId = await createUser(db, 'first@example.com');
    secondUserId = await createUser(db, 'second@example.com');
  });

  it('gives each user their own contact details for a person they share', async () => {
    await createClient(db, firstUserId).run(IMPORT, { csv: CSV });

    const result = await createClient(db, secondUserId).run(IMPORT, { csv: CSV });

    expect(result.errors).toBeUndefined();
    expect(result.data?.importGoogleContacts).toEqual({ imported: 0, merged: 1, errors: [] });
    const details: Array<{ value: string }> = await db
      .select({ value: dbSchema.contactInfos.value })
      .from(dbSchema.contactInfos)
      .where(eq(dbSchema.contactInfos.userId, secondUserId));
    expect(details.map((row) => row.value).sort()).toEqual(CONTACT_VALUES);
    const addresses = await db
      .select({ line1: dbSchema.addresses.line1, line2: dbSchema.addresses.line2 })
      .from(dbSchema.addresses)
      .where(eq(dbSchema.addresses.userId, secondUserId));
    expect(addresses).toEqual([{ line1: '1 Analytical Way', line2: 'Flat 2' }]);
  });

  it('does not duplicate details when the same user imports twice', async () => {
    await createClient(db, firstUserId).run(IMPORT, { csv: CSV });

    const details: Array<{ value: string }> = await db
      .select({ value: dbSchema.contactInfos.value })
      .from(dbSchema.contactInfos)
      .where(eq(dbSchema.contactInfos.userId, firstUserId));
    expect(details.map((row) => row.value).sort()).toEqual(CONTACT_VALUES);
  });
});
