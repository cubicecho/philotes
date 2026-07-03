/**
 * One-time migration helper for existing single-user installations.
 *
 * If the DB has persons/notes/etc. but no users, this creates a default user
 * and assigns all existing rows to them. Run once after deploying the
 * multi-tenant schema migration.
 *
 * Usage:
 *   node --experimental-strip-types db/src/migrate-existing-data.ts \
 *     --email admin@example.com --name "Admin" --password "changeme"
 */

import { db } from './index.ts';

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
const anyDb = db as any;

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const email = flag('email') ?? 'admin@example.com';
const name = flag('name') ?? 'Admin';
const password = flag('password') ?? 'changeme';

const { default: bcrypt } = await import('bcryptjs');
const passwordHash = await bcrypt.hash(password, 12);

// Check if any users exist
const existingUsers = await anyDb
  .select()
  .from((await import('./schema.ts')).users)
  .limit(1);
if (existingUsers.length > 0) {
  console.log('Users already exist — skipping migration.');
  process.exit(0);
}

const schema = await import('./schema.ts');

// Create the seed user
const [user] = await anyDb
  .insert(schema.users)
  .values({ email, name, passwordHash })
  .returning({ id: schema.users.id });

console.log(`Created user: ${email} (id: ${user.id})`);

// Fetch all persons
const allPersons: Array<{ id: string }> = await anyDb.select({ id: schema.persons.id }).from(schema.persons);

// Create user_persons links for every existing person
if (allPersons.length > 0) {
  await anyDb
    .insert(schema.userPersons)
    .values(allPersons.map((p: { id: string }) => ({ userId: user.id, personId: p.id })))
    .onConflictDoNothing();
  console.log(`Linked ${allPersons.length} persons to user.`);
}

// Assign userId to all user-owned tables
const tables = [
  schema.notes,
  schema.interactions,
  schema.tasks,
  schema.labels,
  schema.importantDates,
  schema.personRelationships,
  schema.addresses,
  schema.contactInfos,
];

for (const table of tables) {
  const result = await anyDb
    .update(table)
    .set({ userId: user.id })
    .returning({ id: (table as typeof schema.notes).id });
  console.log(`Updated ${result.length} rows in ${(table as { _: { name: string } })._.name}.`);
}

// person_labels: bulk re-insert with userId since PK changed
const existingPl: Array<{ personId: string; labelId: string }> = await anyDb
  .select({ personId: schema.personLabels.personId, labelId: schema.personLabels.labelId })
  .from(schema.personLabels)
  .where(
    // Select rows that don't have the userId yet (pre-migration rows won't have it)
    // Since userId is now part of PK we can detect them by querying without filter
    // then re-inserting with the userId.
    // Actually all existing rows already have NULL userId before this script —
    // but since userId is NOT NULL the migration itself would have failed.
    // This script is intended to run after the migration adds the column
    // with a default, then we update the value.
    (await import('drizzle-orm')).isNull(schema.personLabels.userId),
  );

if (existingPl.length > 0) {
  // Delete the null-userId rows and re-insert with the seed userId
  await anyDb.delete(schema.personLabels).where((await import('drizzle-orm')).isNull(schema.personLabels.userId));
  await anyDb
    .insert(schema.personLabels)
    .values(existingPl.map((r: { personId: string; labelId: string }) => ({ ...r, userId: user.id })))
    .onConflictDoNothing();
  console.log(`Migrated ${existingPl.length} personLabels rows.`);
}

console.log('Migration complete.');
