import { z } from 'zod';
import { LABEL_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const labelInput = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'A label cannot be empty.')
      .max(LABEL_DEFAULTS.maxLabelLength, 'The label is too long.'),
    color: z
      .string()
      .trim()
      .min(1, 'A label needs a colour.')
      .max(LABEL_DEFAULTS.maxColorLength, 'The colour is too long.'),
  })
  .partial();
