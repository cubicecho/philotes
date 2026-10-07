import type { DB } from '@philotes/db';
import { sql } from 'drizzle-orm';
import { version } from '../core/config.ts';
import { errorMessage } from '../core/errors.ts';

/** What /healthz answers. */
export interface Health {
  ok: boolean;
  /** The released version (config.ts). */
  version: string;
  /** Why the database didn't answer. Only present when `ok` is false. */
  error?: string;
}

/**
 * Round-trips to the database. A live process with a dead database is not healthy.
 *
 * @param db - Database client.
 * @returns The health report.
 */
export async function checkHealth(db: DB): Promise<Health> {
  try {
    await db.execute(sql`select 1`);
    return { ok: true, version: version() };
  } catch (error) {
    return { ok: false, version: version(), error: errorMessage(error) };
  }
}
