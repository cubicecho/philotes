import { ImportantDateKind, MilestoneType, Recurrence } from '@cubicecho/philotes-db/schema';
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
    kind: z.enum(ImportantDateKind, 'Choose birthday, anniversary or other.'),
    hasYear: z.boolean('Say whether the year is known.'),
    recurrence: z.enum(Recurrence, `Recurrence must be one of: ${Object.values(Recurrence).join(', ')}.`).nullable(),
    milestoneType: z.enum(MilestoneType, 'Choose a milestone type from the list.').nullable(),
  })
  .partial();
