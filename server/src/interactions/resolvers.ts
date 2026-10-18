import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import { phoneLogInput } from './input.ts';
import { type LogResult, logInteractions } from './log.ts';

const LOG_INTERACTIONS_SDL = parse(`
  "One event a phone read from its call log or its texts: who, when and which way, never what was said."
  input PhoneLogEntryInput {
    "Where it was read: call-log or sms."
    source: String!
    "What the phone knows the event by. Sending the same one again logs nothing new."
    externalId: String!
    "The other party's number, as the phone shows it. It is matched to people and not kept."
    address: String!
    "When the call started or the text was sent or received."
    occurredAt: DateTime!
    "incoming, outgoing or missed."
    direction: String!
    "How long a call lasted, in seconds. Left out for a text."
    durationSeconds: Int
  }

  "What one logInteractions call did."
  type LogInteractionsResult {
    "Interactions written by this call."
    logged: Int!
    "Interactions already logged for an event and person by an earlier call."
    alreadyLogged: Int!
    "Events whose number matched nobody. They are dropped."
    unmatched: Int!
  }

  extend type Mutation {
    """
    Logs calls and texts a phone read as interactions with the caller's people, matched on their
    contact details' normalized numbers. One interaction per event and person; an event sent again is
    left alone, so a phone may send what it read as often as it likes.
    """
    logInteractions(entries: [PhoneLogEntryInput!]!): LogInteractionsResult!
  }
`);

/**
 * Adds `logInteractions`, which a phone sends what it read from its call log and texts through.
 *
 * @param schema - The schema so far.
 * @returns The schema with the mutation.
 */
export function applyLogInteractionsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, LOG_INTERACTIONS_SDL);
  const mutations = objectType(extended, 'Mutation').getFields();

  /**
   * Resolves `Mutation.logInteractions`.
   *
   * @param _parent - Unused.
   * @param args.entries - The events the phone read.
   * @param ctx - Request context.
   * @returns What was written, what was there already, and what matched nobody.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when an entry is malformed or there are too many.
   */
  mutations.logInteractions.resolve = async (
    _parent: unknown,
    args: { entries: unknown },
    ctx: Context,
  ): Promise<LogResult> => {
    const userId = requireAuth(ctx);
    const entries = parseOrThrow(phoneLogInput, args.entries);
    const events = entries.map(({ address, ...entry }) => ({ ...entry, addresses: [address] }));
    return logInteractions(ctx.db, userId, events);
  };

  return extended;
}
