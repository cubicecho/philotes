import { db } from '@philotes/db';
import { createSchema } from './build-schema.ts';

/** The schema the server serves, bound to the app's database. */
export const { schema, entities } = createSchema(db);
