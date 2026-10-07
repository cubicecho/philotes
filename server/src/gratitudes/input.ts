import { z } from 'zod';
import { GRATITUDE_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const gratitudeInput = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'A gratitude cannot be empty.')
      .max(GRATITUDE_DEFAULTS.maxBodyLength, 'The gratitude is too long.'),
  })
  .partial();
