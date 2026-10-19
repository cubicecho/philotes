import type { DB } from '@cubicecho/philotes-db';
import {
  InteractionDirection,
  InteractionSource,
  type Mailbox,
  type MailFolderCursor,
  mailboxes,
} from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { MAIL_DEFAULTS, type MailSettings } from '../core/defaults.ts';
import { MS_PER_DAY } from '../core/wire.ts';
import { type LoggedEvent, logInteractions } from '../interactions/log.ts';
import type { MailHeader, MailSession } from './reader.ts';

// One poll of one mailbox: the inbox as incoming mail, the sent folder as outgoing, each from where its
// cursor stands. Each page of headers is logged, then the cursor moves, so a poll cut short loses nothing.

/** What a poll needs to know of its mailbox. */
export type PolledMailbox = Pick<Mailbox, 'id' | 'userId' | 'address' | 'username' | 'cursors'>;

/** What one poll did. */
export interface PollResult {
  /** Headers fetched, across both folders. */
  fetched: number;
  /** Interactions written. */
  logged: number;
}

/**
 * Splits a list into pages.
 *
 * @typeParam T - What the list holds.
 * @param items - The list.
 * @param size - Most items per page.
 * @returns The pages, in order.
 */
function pagesOf<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    pages.push(items.slice(start, start + size));
  }
  return pages;
}

/**
 * Turns a header into the event logged for it: the sender of mail that came in, the recipients of mail
 * that went out, never the user's own addresses.
 *
 * @param header - The header.
 * @param direction - Incoming for the inbox, outgoing for the sent folder.
 * @param ownAddresses - The user's own addresses, lower case.
 * @param fallbackId - The id a message with no Message-ID is known by.
 * @returns The event, or null when nobody but the user is on it.
 */
export function eventOf(
  header: MailHeader,
  direction: InteractionDirection,
  ownAddresses: ReadonlySet<string>,
  fallbackId: string,
): LoggedEvent | null {
  const others =
    direction === InteractionDirection.Incoming ? header.from : [...header.to, ...header.cc, ...header.bcc];
  const addresses = others.filter((address) => ownAddresses.has(address.trim().toLowerCase()) === false);
  if (addresses.length === 0) {
    return null;
  }
  return {
    source: InteractionSource.Email,
    externalId: header.messageId ?? fallbackId,
    addresses,
    occurredAt: header.date,
    direction,
  };
}

/**
 * Reads one folder from its cursor and logs what it finds, a page at a time.
 *
 * @param db - The database.
 * @param mailbox - The mailbox. Its `cursors` is updated in place as pages are logged.
 * @param session - The logged-in session.
 * @param path - The folder.
 * @param direction - Which way the folder's mail went.
 * @param settings - The mail settings.
 * @param now - The time the poll started.
 * @returns What was fetched and logged.
 */
async function pollFolder(
  db: DB,
  mailbox: PolledMailbox,
  session: MailSession,
  path: string,
  direction: InteractionDirection,
  settings: MailSettings,
  now: Date,
): Promise<PollResult> {
  const result: PollResult = { fetched: 0, logged: 0 };
  const { uidValidity, uidNext } = await session.open(path);
  const cursor = mailbox.cursors[path];
  const isFresh = cursor === undefined || cursor.uidValidity !== uidValidity;
  const since = new Date(now.getTime() - settings.firstPollDays * MS_PER_DAY);
  const uids = isFresh ? await session.uidsSince(since) : await session.uidsAfter(cursor.lastUid);

  const saveCursor = async (next: MailFolderCursor): Promise<void> => {
    mailbox.cursors = { ...mailbox.cursors, [path]: next };
    await db.update(mailboxes).set({ cursors: mailbox.cursors }).where(eq(mailboxes.id, mailbox.id));
  };
  if (uids.length === 0) {
    if (isFresh) {
      // Nothing recent: the next poll starts after what is there now, not from the folder's first message.
      await saveCursor({ uidValidity, lastUid: uidNext - 1 });
    }
    return result;
  }

  const ownAddresses = new Set([mailbox.address, mailbox.username].map((address) => address.trim().toLowerCase()));
  for (const page of pagesOf(uids, settings.pageSize).slice(0, settings.maxPagesPerPoll)) {
    const headers = await session.headers(page);
    console.log(`[mail] ${path}: fetched ${headers.length} envelopes (headers only)`);
    const events = headers.flatMap((header) => {
      const event = eventOf(header, direction, ownAddresses, `${path}:${uidValidity}:${header.uid}`);
      return event === null ? [] : [event];
    });
    const { logged } = await logInteractions(db, mailbox.userId, events);
    result.fetched += headers.length;
    result.logged += logged;
    await saveCursor({ uidValidity, lastUid: Math.max(...page) });
  }
  return result;
}

/**
 * Polls a mailbox: its inbox, then its sent folder when it has one.
 *
 * @param db - The database.
 * @param mailbox - The mailbox.
 * @param session - A session logged in to it.
 * @param [overrides] - Settings that differ from `MAIL_DEFAULTS`.
 * @param [now] - The time the poll starts.
 * @returns What was fetched and logged.
 */
export async function pollMailbox(
  db: DB,
  mailbox: PolledMailbox,
  session: MailSession,
  overrides: Partial<MailSettings> = {},
  now: Date = new Date(),
): Promise<PollResult> {
  const settings = { ...MAIL_DEFAULTS, ...overrides };
  const { inbox, sent } = await session.folders();
  const folders: Array<[string, InteractionDirection]> = [[inbox, InteractionDirection.Incoming]];
  if (sent !== null) {
    folders.push([sent, InteractionDirection.Outgoing]);
  }

  const total: PollResult = { fetched: 0, logged: 0 };
  for (const [path, direction] of folders) {
    const { fetched, logged } = await pollFolder(db, mailbox, session, path, direction, settings, now);
    total.fetched += fetched;
    total.logged += logged;
  }
  return total;
}
