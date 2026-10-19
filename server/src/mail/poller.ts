import type { DB } from '@cubicecho/philotes-db';
import { type Mailbox, MailboxStatus, mailboxes } from '@cubicecho/philotes-db/schema';
import { and, asc, eq, lte, ne } from 'drizzle-orm';
import { MAIL_DEFAULTS, type MailSettings } from '../core/defaults.ts';
import { errorMessage } from '../core/errors.ts';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../core/wire.ts';
import { CredentialUnreadable, credentialContext, openCredential } from './credential.ts';
import { pollMailbox } from './poll.ts';
import { MailLoginRefused, type MailService } from './reader.ts';

// The loop that polls connected mailboxes. Each tick takes the mailboxes that are due and polls them one at
// a time. A refused login stops a mailbox until its owner connects it again; any other failure backs off.
// See docs/email-interactions.md, "The poller".

/** What the Settings card says when a login was refused. */
export const LOGIN_REFUSED_MESSAGE =
  'The mail server refused the login. Make a new app password and connect the mailbox again.';
/** What the Settings card says when the saved password cannot be opened. */
export const UNREADABLE_MESSAGE = 'The saved password can no longer be read. Connect the mailbox again.';
/** What the Settings card says for any other failure. The real cause is in the server's log. */
export const UNREACHABLE_MESSAGE = 'The mail server could not be reached, or did not answer. Philotes will try again.';

/** The poller. */
export interface MailPoller {
  /** Starts the ticks. */
  start: () => void;
  /** Stops taking mailboxes, aborts the poll in flight, and resolves once it has stopped. */
  stop: () => Promise<void>;
  /** Polls every mailbox that is due, once. The ticks call it; so may a test. */
  tick: () => Promise<void>;
}

/** What the poller is built from. */
export interface MailPollerDeps {
  db: DB;
  mail: MailService;
  /** The time now. */
  now?: () => Date;
}

/**
 * Works out how long to wait after a run of failed polls.
 *
 * @param failures - Polls failed in a row, at least 1.
 * @param settings - The mail settings.
 * @returns The wait, in minutes.
 */
export function retryMinutes(failures: number, settings: MailSettings): number {
  return Math.min(settings.retryBaseMinutes * 2 ** (failures - 1), settings.retryMaxMinutes);
}

/**
 * Builds the poller.
 *
 * @param deps - The database, the keys and the connector.
 * @param [overrides] - Settings that differ from `MAIL_DEFAULTS`.
 * @returns The poller, not started.
 */
export function createMailPoller(
  { db, mail, now = () => new Date() }: MailPollerDeps,
  overrides: Partial<MailSettings> = {},
): MailPoller {
  const settings = { ...MAIL_DEFAULTS, ...overrides };
  const aborter = new AbortController();
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;

  const later = (minutes: number): Date => new Date(now().getTime() + minutes * MS_PER_MINUTE);

  const pollOne = async (mailbox: Mailbox): Promise<void> => {
    let password: string;
    try {
      password = openCredential(mail.keyring, mailbox.credential, credentialContext(mailbox.userId));
    } catch (error: unknown) {
      const isUnreadable = error instanceof CredentialUnreadable;
      if (isUnreadable === false) {
        throw error;
      }
      console.warn(`[mail] mailbox ${mailbox.id}: ${error.message}`);
      await db
        .update(mailboxes)
        .set({ status: MailboxStatus.NeedsReconnect, lastError: UNREADABLE_MESSAGE })
        .where(eq(mailboxes.id, mailbox.id));
      return;
    }

    try {
      const login = { host: mailbox.host, port: mailbox.port, username: mailbox.username, password };
      const session = await mail.connect(login, aborter.signal);
      try {
        const { fetched, logged } = await pollMailbox(db, mailbox, session, settings, now());
        console.log(`[mail] mailbox ${mailbox.id}: ${fetched} headers read, ${logged} interactions logged`);
      } finally {
        await session.close().catch(() => undefined);
      }
      await db
        .update(mailboxes)
        .set({
          status: MailboxStatus.Active,
          lastError: null,
          failureCount: 0,
          lastPolledAt: now(),
          nextPollAt: later(settings.pollIntervalMinutes),
        })
        .where(eq(mailboxes.id, mailbox.id));
    } catch (error: unknown) {
      if (error instanceof MailLoginRefused) {
        console.warn(`[mail] mailbox ${mailbox.id}: the login was refused; waiting for its owner to connect again`);
        await db
          .update(mailboxes)
          .set({ status: MailboxStatus.NeedsReconnect, lastError: LOGIN_REFUSED_MESSAGE, lastPolledAt: now() })
          .where(eq(mailboxes.id, mailbox.id));
        return;
      }
      if (aborter.signal.aborted) {
        // Shutting down: the poll was cut short on purpose, and its pages so far are kept.
        return;
      }
      const failures = mailbox.failureCount + 1;
      const waitMinutes = retryMinutes(failures, settings);
      console.warn(`[mail] mailbox ${mailbox.id}: poll failed (${errorMessage(error)}); next in ${waitMinutes} min`);
      await db
        .update(mailboxes)
        .set({
          status: MailboxStatus.Failing,
          lastError: UNREACHABLE_MESSAGE,
          failureCount: failures,
          lastPolledAt: now(),
          nextPollAt: later(waitMinutes),
        })
        .where(eq(mailboxes.id, mailbox.id));
    }
  };

  const pollDue = async (): Promise<void> => {
    const due = await db
      .select()
      .from(mailboxes)
      .where(and(ne(mailboxes.status, MailboxStatus.NeedsReconnect), lte(mailboxes.nextPollAt, now())))
      .orderBy(asc(mailboxes.nextPollAt))
      .limit(settings.maxMailboxesPerTick);
    for (const mailbox of due) {
      if (aborter.signal.aborted) {
        return;
      }
      await pollOne(mailbox);
    }
  };

  const tick = async (): Promise<void> => {
    const isBusy = running !== null || aborter.signal.aborted;
    if (isBusy) {
      return;
    }
    running = pollDue()
      .catch((error: unknown) => {
        console.error(`[mail] the poll loop failed: ${errorMessage(error)}`);
      })
      .finally(() => {
        running = null;
      });
    await running;
  };

  return {
    start: () => {
      timer = setInterval(() => void tick(), settings.tickSeconds * MS_PER_SECOND);
      void tick();
    },
    stop: async () => {
      if (timer !== null) {
        clearInterval(timer);
      }
      aborter.abort();
      await running;
    },
    tick,
  };
}
