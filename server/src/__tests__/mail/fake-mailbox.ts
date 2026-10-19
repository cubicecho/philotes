import { randomBytes } from 'node:crypto';
import { type Keyring, parseKeyring } from '../../mail/credential.ts';
import {
  type MailConnector,
  type MailHeader,
  type MailLogin,
  MailLoginRefused,
  type MailService,
  type MailSession,
} from '../../mail/reader.ts';

/** One folder of a fake mailbox. */
export interface FakeFolder {
  uidValidity: string;
  /** Its messages, by UID. */
  messages: MailHeader[];
}

/** A mailbox in memory, spoken to through the same interface the IMAP reader has. */
export interface FakeMailbox {
  folders: Record<string, FakeFolder>;
  /** The sent folder's path, or null for a server that marks none. */
  sentPath: string | null;
  /** The password the fake accepts. */
  password: string;
  /** Set to make every connection fail as an unreachable server would. */
  unreachable: boolean;
  /** Every UID whose headers were fetched, in order. */
  fetchedUids: number[];
  /** Every `since` search, as the date asked for. */
  sinceSearches: Date[];
  /** Every login tried. */
  logins: MailLogin[];
}

/** AES-256 takes a 32-byte key. */
const KEY_BYTES = 32;

/**
 * Makes a key for MAIL_CREDENTIAL_KEYS.
 *
 * @param id - The key's id.
 * @returns The entry, `<id>:<base64>`.
 */
export function keyEntry(id: string): string {
  return `${id}:${randomBytes(KEY_BYTES).toString('base64')}`;
}

/**
 * Makes a keyring of fresh keys.
 *
 * @param entries - The entries, the sealing one first.
 * @returns The keyring.
 */
export function keyringOf(...entries: string[]): Keyring {
  const keyring = parseKeyring(entries.join(','));
  if (keyring === null) {
    throw new Error('A test keyring needs a key.');
  }
  return keyring;
}

/**
 * Builds a header.
 *
 * @param uid - Its UID.
 * @param fields - What differs from a message with no one on it.
 * @returns The header.
 */
export function header(uid: number, fields: Partial<MailHeader> = {}): MailHeader {
  return {
    uid,
    messageId: `<${uid}@mail.example.com>`,
    date: new Date('2026-10-10T10:00:00.000Z'),
    from: [],
    to: [],
    cc: [],
    bcc: [],
    ...fields,
  };
}

/**
 * Builds an empty fake mailbox with an inbox and a sent folder.
 *
 * @returns The mailbox.
 */
export function fakeMailbox(): FakeMailbox {
  return {
    folders: { INBOX: { uidValidity: '1', messages: [] }, Sent: { uidValidity: '1', messages: [] } },
    sentPath: 'Sent',
    password: 'app-password',
    unreachable: false,
    fetchedUids: [],
    sinceSearches: [],
    logins: [],
  };
}

/**
 * Builds a connector over a fake mailbox.
 *
 * @param mailbox - The mailbox.
 * @returns The connector.
 */
export function fakeConnector(mailbox: FakeMailbox): MailConnector {
  return async (login) => {
    mailbox.logins.push(login);
    if (mailbox.unreachable) {
      throw new Error('connect ECONNREFUSED 10.0.0.9:993');
    }
    if (login.password !== mailbox.password) {
      throw new MailLoginRefused('refused');
    }
    let open: FakeFolder | null = null;
    const opened = (): FakeFolder => {
      if (open === null) {
        throw new Error('No folder is open.');
      }
      return open;
    };
    const session: MailSession = {
      folders: async () => ({ inbox: 'INBOX', sent: mailbox.sentPath }),
      open: async (path) => {
        open = mailbox.folders[path];
        const highest = Math.max(0, ...open.messages.map((message) => message.uid));
        return { uidValidity: open.uidValidity, uidNext: highest + 1 };
      },
      uidsAfter: async (uid) =>
        opened()
          .messages.map((message) => message.uid)
          .filter((each) => each > uid)
          .sort((a, b) => a - b),
      uidsSince: async (date) => {
        mailbox.sinceSearches.push(date);
        return opened()
          .messages.filter((message) => message.date >= date)
          .map((message) => message.uid)
          .sort((a, b) => a - b);
      },
      headers: async (uids) => {
        mailbox.fetchedUids.push(...uids);
        return opened().messages.filter((message) => uids.includes(message.uid));
      },
      close: async () => {},
    };
    return session;
  };
}

/**
 * Builds the mail service a test server is given.
 *
 * @param mailbox - The mailbox its connector reaches.
 * @param [keyring] - The keys. Fresh ones by default.
 * @returns The service.
 */
export function fakeMailService(mailbox: FakeMailbox, keyring: Keyring = keyringOf(keyEntry('k1'))): MailService {
  return { keyring, connect: fakeConnector(mailbox) };
}
