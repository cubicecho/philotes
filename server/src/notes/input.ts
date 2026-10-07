import { z } from 'zod';
import { NOTE_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const noteInput = z
  .object({
    body: z.string().trim().min(1, 'A note cannot be empty.').max(NOTE_DEFAULTS.maxBodyLength, 'The note is too long.'),
  })
  .partial();
