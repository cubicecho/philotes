import { type FetchMessageObject, ImapFlow, type MessageAddressObject } from 'imapflow';
import { MAIL_DEFAULTS, type MailSettings } from '../core/defaults.ts';
import { MS_PER_SECOND } from '../core/wire.ts';
import { type MailConnector, type MailHeader, MailLoginRefused, type MailSession } from './reader.ts';

// The IMAP half of `reader.ts`, over imapflow. Implicit TLS with the certificate checked, read-only folders,
// and a fetch that asks for the envelope and the received time only: no body, no structure, no attachment.

/** The inbox's name, which IMAP fixes. */
const INBOX = 'INBOX';
/** The RFC 6154 special-use flag of the folder sent mail is kept in. */
const SENT_FLAG = '\\Sent';
/** The whole of what a poll fetches of a message. Adding to it is a change to the design note. */
export const HEADERS_ONLY = { uid: true, envelope: true, internalDate: true } as const;
/** UID ranges and searches are by UID, not by sequence number. */
const BY_UID = { uid: true } as const;

/**
 * Reads the bare addresses out of an envelope field.
 *
 * @param field - From, To, Cc or Bcc as imapflow parses it.
 * @returns The addresses, without their names.
 */
function addressesOf(field: MessageAddressObject[] | undefined): string[] {
  return (field ?? []).flatMap((entry) => (entry.address ? [entry.address] : []));
}

/**
 * Reads a date imapflow may hand over as a string.
 *
 * @param value - The date, a string, or nothing.
 * @returns The date, or null when there is none or it does not parse.
 */
function dateOf(value: Date | string | undefined): Date | null {
  if (value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Turns a fetched message into the header the poller reads.
 *
 * @param message - What imapflow fetched: the envelope and the received time.
 * @returns The header.
 */
function headerOf(message: FetchMessageObject): MailHeader {
  const { envelope } = message;
  return {
    uid: message.uid,
    messageId: envelope?.messageId?.trim() || null,
    date: dateOf(envelope?.date) ?? dateOf(message.internalDate) ?? new Date(),
    from: addressesOf(envelope?.from),
    to: addressesOf(envelope?.to),
    cc: addressesOf(envelope?.cc),
    bcc: addressesOf(envelope?.bcc),
  };
}

/**
 * Builds the connector the server reads mail with.
 *
 * @param [overrides] - Settings that differ from `MAIL_DEFAULTS`. Only the timeout is read.
 * @returns The connector.
 */
export function createImapConnector(overrides: Partial<MailSettings> = {}): MailConnector {
  const timeoutMs = { ...MAIL_DEFAULTS, ...overrides }.connectTimeoutSeconds * MS_PER_SECOND;

  return async ({ host, port, username, password }, signal) => {
    const client = new ImapFlow({
      host,
      port,
      secure: true,
      tls: { rejectUnauthorized: true },
      auth: { user: username, pass: password },
      // imapflow's own logger would write every command; the poller logs what it fetched itself.
      logger: false,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });
    const abort = (): void => client.close();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      await client.connect();
    } catch (error: unknown) {
      signal?.removeEventListener('abort', abort);
      // A failed connect can leave the socket open; nothing else would close it.
      client.close();
      const isRefused = typeof error === 'object' && error !== null && 'authenticationFailed' in error;
      if (isRefused) {
        throw new MailLoginRefused('The mail server refused the login.');
      }
      throw error;
    }

    const session: MailSession = {
      folders: async () => {
        const listed = await client.list();
        const sent = listed.find((folder) => folder.specialUse === SENT_FLAG);
        return { inbox: INBOX, sent: sent?.path ?? null };
      },
      open: async (path) => {
        const folder = await client.mailboxOpen(path, { readOnly: true });
        return { uidValidity: folder.uidValidity.toString(), uidNext: folder.uidNext };
      },
      uidsAfter: async (uid) => {
        // `n:*` always matches the newest message, even below n, so the range is filtered again.
        const found = (await client.search({ uid: `${uid + 1}:*` }, BY_UID)) || [];
        return found.filter((each) => each > uid).sort((a, b) => a - b);
      },
      uidsSince: async (date) => {
        const found = (await client.search({ since: date }, BY_UID)) || [];
        return [...found].sort((a, b) => a - b);
      },
      headers: async (uids) => {
        if (uids.length === 0) {
          return [];
        }
        const messages = await client.fetchAll(uids.join(','), HEADERS_ONLY, BY_UID);
        return messages.map(headerOf);
      },
      close: async () => {
        signal?.removeEventListener('abort', abort);
        await client.logout();
      },
    };
    return session;
  };
}
