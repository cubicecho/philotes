import { DATABASE_URL, db } from './index.ts';
import { runMigrations } from './run-migrations.ts';

await runMigrations(db, './drizzle/', DATABASE_URL);

console.log('Migration complete.');
