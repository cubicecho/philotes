import { MILESTONE_TYPES, RECURRENCE_VALUES } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { IMPORTANT_DATE_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const importantDateInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty.')
      .max(IMPORTANT_DATE_DEFAULTS.maxNameLength, 'Name is too long.'),
    description: z.string().max(IMPORTANT_DATE_DEFAULTS.maxDescriptionLength, 'Description is too long.').nullable(),
    recurrence: z.enum(RECURRENCE_VALUES, `Recurrence must be one of: ${RECURRENCE_VALUES.join(', ')}.`).nullable(),
    milestoneType: z.enum(MILESTONE_TYPES, 'Choose a milestone type from the list.').nullable(),
  })
  .partial();
