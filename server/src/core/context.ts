import type { DB } from '@philotes/db';

/** What every resolver receives. Built once per request. */
export interface Context {
  /** The Drizzle client the request reads and writes through. */
  db: DB;
  /** The signed-in user, or null for an anonymous request. */
  userId: string | null;
}
