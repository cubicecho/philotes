import { InteractionChannel, InteractionSentiment } from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { INTERACTION_DEFAULTS } from '../core/defaults.ts';

/** Partial, since an update's `set` carries only the changed columns. */
export const interactionInput = z
  .object({
    channel: z.enum(InteractionChannel, `Channel must be one of: ${Object.values(InteractionChannel).join(', ')}.`),
    sentiment: z
      .enum(InteractionSentiment, `Sentiment must be one of: ${Object.values(InteractionSentiment).join(', ')}.`)
      .nullable(),
    note: z.string().max(INTERACTION_DEFAULTS.maxNoteLength, 'The note is too long.').nullable(),
  })
  .partial();
