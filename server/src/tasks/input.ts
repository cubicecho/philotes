import { z } from 'zod';
import { TASK_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const taskInput = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty.').max(TASK_DEFAULTS.maxTitleLength, 'Title is too long.'),
    notes: z.string().max(TASK_DEFAULTS.maxNotesLength, 'Notes are too long.').nullable(),
  })
  .partial();
