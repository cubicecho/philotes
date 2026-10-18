import {
  InteractionChannel,
  InteractionDirection,
  InteractionSentiment,
  InteractionSource,
} from '@cubicecho/philotes-db/schema';
import { z } from 'zod';
import { CONTACT_INFO_DEFAULTS, INTERACTION_DEFAULTS } from '../core/defaults.ts';

const { maxNoteLength, maxLoggedPerCall, maxExternalIdLength, maxDurationSeconds } = INTERACTION_DEFAULTS;

/** Which way an interaction went, as a client sends it. */
const directionInput = z.enum(
  InteractionDirection,
  `Direction must be one of: ${Object.values(InteractionDirection).join(', ')}.`,
);

/** How long a call lasted, in seconds. */
const durationInput = z
  .int('The duration is a whole number of seconds.')
  .nonnegative('The duration cannot be negative.')
  .max(maxDurationSeconds, 'The duration is longer than a call can be.');

/** Partial, since an update's `set` carries only the changed columns. */
export const interactionInput = z
  .object({
    channel: z.enum(InteractionChannel, `Channel must be one of: ${Object.values(InteractionChannel).join(', ')}.`),
    sentiment: z
      .enum(InteractionSentiment, `Sentiment must be one of: ${Object.values(InteractionSentiment).join(', ')}.`)
      .nullable(),
    note: z.string().max(maxNoteLength, 'The note is too long.').nullable(),
    direction: directionInput.nullable(),
    durationSeconds: durationInput.nullable(),
  })
  .partial();

/** The sources a phone reads and sends through `logInteractions`. Email is read by the server itself. */
export const PHONE_SOURCES = [InteractionSource.CallLog, InteractionSource.Sms] as const;
/** A source a phone reads. */
export type PhoneSource = (typeof PHONE_SOURCES)[number];

/** One event a phone read from its call log or its texts. */
export const phoneLogEntryInput = z.object({
  source: z.enum(PHONE_SOURCES, `Source must be one of: ${PHONE_SOURCES.join(', ')}.`),
  externalId: z
    .string()
    .trim()
    .min(1, 'Every logged event needs the id its source knows it by.')
    .max(maxExternalIdLength, 'The external id is too long.'),
  address: z.string().max(CONTACT_INFO_DEFAULTS.maxValueLength, 'The number or address is too long.'),
  occurredAt: z.date('Every logged event needs the time it happened.'),
  direction: directionInput,
  durationSeconds: durationInput.nullish(),
});
/** One event a phone read, once checked. */
export type PhoneLogEntry = z.infer<typeof phoneLogEntryInput>;

/** What one `logInteractions` call carries. */
export const phoneLogInput = z
  .array(phoneLogEntryInput)
  .max(maxLoggedPerCall, `Send at most ${maxLoggedPerCall} events at a time.`);
