import { INTERACTION_CHANNELS, INTERACTION_SENTIMENTS } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { INTERACTION_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const interactionInput = z
  .object({
    channel: z.enum(INTERACTION_CHANNELS, `Channel must be one of: ${INTERACTION_CHANNELS.join(', ')}.`),
    sentiment: z
      .enum(INTERACTION_SENTIMENTS, `Sentiment must be one of: ${INTERACTION_SENTIMENTS.join(', ')}.`)
      .nullable(),
    note: z.string().max(INTERACTION_DEFAULTS.maxNoteLength, 'The note is too long.').nullable(),
  })
  .partial();
