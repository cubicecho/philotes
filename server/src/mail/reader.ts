import type { Keyring } from './credential.ts';

// What the poller asks of a mailbox, apart from how it is spoken to. `imap-reader.ts` speaks IMAP; a test
// hands the poller one of its own. A header carries who and when, and has no field for a subject or a body,
// so nothing past this point can read either.

/** What logs in to a mailbox. */
export interface MailLogin {
  host: string;
  port: number;
  username: string;
  password: string;
}

/** One message, as far as the poller may know it. */
export interface MailHeader {
  /** The message's UID in its folder. */
  uid: number;
  /** The Message-ID header, or null when the message has none. */
  messageId: string | null;
  /** The Date header, or when the server received the message when Date is missing. */
  date: Date;
  from: string[];
  to: string[];
  cc: string[];
  bcc: string[];
}

/** A folder, once opened. */
export interface OpenedFolder {
  /** UIDVALIDITY: when it changes, every UID in the folder was reassigned. */
  uidValidity: string;
  /** The UID the next message will get. Everything below it exists already. */
  uidNext: number;
}

/** The folders a poll reads. */
export interface PolledFolders {
  inbox: string;
  /** The folder marked `\Sent`, or null when the server marks none. */
  sent: string | null;
}

/** One logged-in connection to a mailbox. */
export interface MailSession {
  /** Finds the inbox and the sent folder. */
  folders: () => Promise<PolledFolders>;
  /** Opens a folder read-only. */
  open: (path: string) => Promise<OpenedFolder>;
  /** The UIDs of the open folder's messages above a UID, in ascending order. */
  uidsAfter: (uid: number) => Promise<number[]>;
  /** The UIDs of the open folder's messages received on or after a day, in ascending order. */
  uidsSince: (date: Date) => Promise<number[]>;
  /** Fetches the open folder's headers for some UIDs: the envelope and the received time, nothing else. */
  headers: (uids: number[]) => Promise<MailHeader[]>;
  /** Logs out. */
  close: () => Promise<void>;
}

/**
 * Logs in to a mailbox.
 *
 * @param login - Where and as whom.
 * @param [signal] - Aborts the session: its connection is closed and what it was doing fails.
 * @returns The session.
 * @throws MailLoginRefused when the server refuses the login. Anything else is a failure that may pass.
 */
export type MailConnector = (login: MailLogin, signal?: AbortSignal) => Promise<MailSession>;

/** The mail server refused the login: a wrong or revoked app password, or the account locked. */
export class MailLoginRefused extends Error {}

/** What a server needs to read mail: its keys and the way it connects. */
export interface MailService {
  keyring: Keyring;
  connect: MailConnector;
}
