import { type Mailbox, MailboxStatus, mailboxes } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { badInput, errorMessage, requireAuth } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import { credentialContext, sealCredential } from './credential.ts';
import { connectMailboxInput } from './input.ts';
import { MailLoginRefused } from './reader.ts';

const MAIL_SDL = parse(`
  "The caller's connected mailbox, as its owner sees it. The password is never sent back."
  type Mailbox {
    id: UUID!
    host: String!
    port: Int!
    "The IMAP login."
    username: String!
    "The caller's own address, which is never matched to a person."
    address: String!
    "active, failing or needs-reconnect."
    status: String!
    "What went wrong last, while polls are failing or the mailbox needs connecting again."
    lastError: String
    lastPolledAt: DateTime
    nextPollAt: DateTime!
  }

  "A mailbox to connect over IMAP with implicit TLS."
  input ConnectMailboxInput {
    "The IMAP server, such as imap.gmail.com."
    host: String!
    "993 when left out."
    port: Int
    "The login, usually the email address."
    username: String!
    "An app password made for Philotes. It is sealed before it is stored."
    password: String!
    "The caller's own address, when the login is not it."
    address: String
  }

  extend type Query {
    "The caller's connected mailbox, or null when none is."
    mailbox: Mailbox
    "Whether this server can read mail at all: it needs MAIL_CREDENTIAL_KEYS."
    mailSyncAvailable: Boolean!
  }

  extend type Mutation {
    """
    Connects the caller's mailbox, after checking that the login works. Its headers (who, when, which way)
    are then read every so often and logged as email interactions with the caller's people. Connecting
    again replaces the mailbox.
    """
    connectMailbox(input: ConnectMailboxInput!): Mailbox!
    "Disconnects the caller's mailbox and deletes its saved password. Interactions already logged stay."
    disconnectMailbox: Boolean!
  }
`);

/** What `connectMailbox` says when the server holds no keys. */
const MAIL_OFF_MESSAGE = 'This server is not set up to read mail. Whoever runs it sets MAIL_CREDENTIAL_KEYS.';
/** What `connectMailbox` says when the login was refused. */
const LOGIN_REFUSED_MESSAGE = 'The mail server refused the login. Check the login and the app password.';
/** What `connectMailbox` says for any other failure, whatever it was, so it cannot map a network. */
const UNREACHABLE_MESSAGE =
  'Philotes could not reach a mail server at that address over TLS. Check the server name and the port.';

/** A mailbox without its credential: what the API answers with. */
type MailboxView = Omit<Mailbox, 'credential' | 'cursors'>;

/**
 * Drops what a mailbox row holds that never leaves the server.
 *
 * @param row - The row.
 * @returns The row without its credential and cursors.
 */
function viewOf({ credential: _credential, cursors: _cursors, ...view }: Mailbox): MailboxView {
  return view;
}

/**
 * Adds the mailbox query and mutations.
 *
 * @param schema - The schema so far.
 * @returns The schema with them.
 */
export function applyMailExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, MAIL_SDL);
  const queries = objectType(extended, 'Query').getFields();
  const mutations = objectType(extended, 'Mutation').getFields();

  /**
   * Resolves `Query.mailbox`.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns The caller's mailbox, or null.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  queries.mailbox.resolve = async (_parent: unknown, _args: unknown, ctx: Context): Promise<MailboxView | null> => {
    const userId = requireAuth(ctx);
    const [row] = await ctx.db.select().from(mailboxes).where(eq(mailboxes.userId, userId));
    return row ? viewOf(row) : null;
  };

  /**
   * Resolves `Query.mailSyncAvailable`.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns Whether the server holds credential keys.
   */
  queries.mailSyncAvailable.resolve = (_parent: unknown, _args: unknown, ctx: Context): boolean => {
    requireAuth(ctx);
    return ctx.mail !== null;
  };

  /**
   * Resolves `Mutation.connectMailbox`. Logs in once to check the login, then stores the mailbox with its
   * password sealed. The same server and login keep how far each folder was read; another starts afresh.
   *
   * @param _parent - Unused.
   * @param args.input - The mailbox.
   * @param ctx - Request context.
   * @returns The mailbox.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws TOO_MANY_REQUESTS when the caller has tried too often.
   * @throws BAD_USER_INPUT when the server reads no mail, the input is malformed, or the login does not work.
   */
  mutations.connectMailbox.resolve = async (
    _parent: unknown,
    args: { input: unknown },
    ctx: Context,
  ): Promise<MailboxView> => {
    const userId = requireAuth(ctx);
    const { mail } = ctx;
    if (mail === null) {
      throw badInput(MAIL_OFF_MESSAGE);
    }
    // Each attempt opens a connection to a host the caller names, so attempts are counted like sign-ins.
    ctx.limiter.hit(`mailbox:user:${userId}`);
    const input = parseOrThrow(connectMailboxInput, args.input);

    try {
      const { host, port, username, password } = input;
      const session = await mail.connect({ host, port, username, password });
      await session.close();
    } catch (error: unknown) {
      if (error instanceof MailLoginRefused) {
        throw badInput(LOGIN_REFUSED_MESSAGE);
      }
      console.warn(`[mail] connecting ${input.host}:${input.port} failed: ${errorMessage(error)}`);
      throw badInput(UNREACHABLE_MESSAGE);
    }

    const credential = sealCredential(mail.keyring, input.password, credentialContext(userId));
    const [existing] = await ctx.db.select().from(mailboxes).where(eq(mailboxes.userId, userId));
    const isSameMailbox = existing?.host === input.host && existing.username === input.username;
    const values = {
      userId,
      host: input.host,
      port: input.port,
      username: input.username,
      address: input.address,
      credential,
      status: MailboxStatus.Active,
      lastError: null,
      failureCount: 0,
      nextPollAt: new Date(),
      cursors: isSameMailbox ? existing.cursors : {},
    };
    const [row] = await ctx.db
      .insert(mailboxes)
      .values(values)
      .onConflictDoUpdate({ target: mailboxes.userId, set: values })
      .returning();
    return viewOf(row);
  };

  /**
   * Resolves `Mutation.disconnectMailbox`.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns Whether a mailbox was connected.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  mutations.disconnectMailbox.resolve = async (_parent: unknown, _args: unknown, ctx: Context): Promise<boolean> => {
    const userId = requireAuth(ctx);
    const deleted = await ctx.db.delete(mailboxes).where(eq(mailboxes.userId, userId)).returning({ id: mailboxes.id });
    return deleted.length > 0;
  };

  return extended;
}
