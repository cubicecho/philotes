import { PHONE_LOG_DEFAULTS, type PhoneLogSettings } from '@/lib/defaults';
import { MS_PER_DAY } from '@/lib/time';
import { InteractionDirection, InteractionSource } from '@/lib/vocabulary';
import type { NativeCallRow, NativeTextRow } from '../../modules/phone-log';

// What the app makes of the phone's call log and texts: which rows become interactions, which way they
// went, and how a scan walks the log from where the last one stopped. Nothing here touches the device,
// so the scan is handed its reads, its sends and its cursor.

/** `CallLog.Calls.TYPE`, as Android numbers it. */
export const AndroidCallType = {
  Incoming: 1,
  Outgoing: 2,
  Missed: 3,
  Voicemail: 4,
  Rejected: 5,
  Blocked: 6,
  AnsweredExternally: 7,
} as const;
export type AndroidCallType = (typeof AndroidCallType)[keyof typeof AndroidCallType];

/** `Telephony.Sms.TYPE`, as Android numbers it. */
export const AndroidTextType = {
  Inbox: 1,
  Sent: 2,
  Draft: 3,
  Outbox: 4,
  Failed: 5,
  Queued: 6,
} as const;
export type AndroidTextType = (typeof AndroidTextType)[keyof typeof AndroidTextType];

/**
 * Which way each kind of call went. A blocked call is left out: the user never heard it ring. A call
 * declined or sent to voicemail was not answered, so it counts as missed.
 */
const CALL_DIRECTION: Readonly<Partial<Record<number, InteractionDirection>>> = {
  [AndroidCallType.Incoming]: InteractionDirection.Incoming,
  [AndroidCallType.Outgoing]: InteractionDirection.Outgoing,
  [AndroidCallType.Missed]: InteractionDirection.Missed,
  [AndroidCallType.Voicemail]: InteractionDirection.Missed,
  [AndroidCallType.Rejected]: InteractionDirection.Missed,
  [AndroidCallType.AnsweredExternally]: InteractionDirection.Incoming,
};

/** Which way each kind of text went. Drafts, and texts that were never sent, are left out. */
const TEXT_DIRECTION: Readonly<Partial<Record<number, InteractionDirection>>> = {
  [AndroidTextType.Inbox]: InteractionDirection.Incoming,
  [AndroidTextType.Sent]: InteractionDirection.Outgoing,
};

/** The sources the phone reads. */
export type PhoneSource = typeof InteractionSource.CallLog | typeof InteractionSource.Sms;

/** One event as `logInteractions` takes it. */
export interface PhoneLogEntry {
  source: PhoneSource;
  externalId: string;
  address: string;
  occurredAt: Date;
  direction: InteractionDirection;
  durationSeconds: number | null;
}

/**
 * Builds the id the server keeps an event by. Android reuses a row's `_ID` once the log is cleared,
 * so the time goes with it.
 *
 * @param row - The row.
 * @returns The id.
 */
function externalIdOf(row: { id: string; dateMs: number }): string {
  return `${row.id}:${row.dateMs}`;
}

/**
 * Turns a call-log row into the event the server logs.
 *
 * @param row - The row as the native module read it.
 * @returns The event, or null for a call that is not one: blocked, or from a withheld number.
 */
export function callEntry(row: NativeCallRow): PhoneLogEntry | null {
  const direction = CALL_DIRECTION[row.type];
  const isWithheld = row.address.trim() === '';
  if (direction === undefined || isWithheld) {
    return null;
  }
  return {
    source: InteractionSource.CallLog,
    externalId: externalIdOf(row),
    address: row.address,
    occurredAt: new Date(row.dateMs),
    direction,
    durationSeconds: row.durationSeconds,
  };
}

/**
 * Turns a text's row into the event the server logs.
 *
 * @param row - The row as the native module read it. It carries no body.
 * @returns The event, or null for a draft or a text that was never sent.
 */
export function textEntry(row: NativeTextRow): PhoneLogEntry | null {
  const direction = TEXT_DIRECTION[row.type];
  const hasNoSender = row.address.trim() === '';
  if (direction === undefined || hasNoSender) {
    return null;
  }
  return {
    source: InteractionSource.Sms,
    externalId: externalIdOf(row),
    address: row.address,
    occurredAt: new Date(row.dateMs),
    direction,
    durationSeconds: null,
  };
}

/** One of the phone's logs, as a scan reads it. */
export interface PhoneLogReader<Row extends { dateMs: number }> {
  /** Reads up to `limit` rows dated at or after `sinceMs`, oldest first. */
  read: (sinceMs: number, limit: number) => Promise<Row[]>;
  /** Turns a row into an event, or null when it is not one. */
  toEntry: (row: Row) => PhoneLogEntry | null;
}

/** What a scan reads its place from, and sends to. */
export interface PhoneLogScanDeps {
  /** Sends one page of events to the server. */
  send: (entries: PhoneLogEntry[]) => Promise<void>;
  /** The time the last scan stopped at, or null before the first. */
  readCursor: () => number | null;
  /** Keeps the time the scan has reached. */
  writeCursor: (sinceMs: number) => void;
  /** The time now, in milliseconds since the epoch. */
  now: () => number;
}

/** What a scan of one log did. */
export interface PhoneLogScanResult {
  /** Rows read from the phone. */
  read: number;
  /** Events sent to the server. */
  sent: number;
}

/**
 * Reads one log from where the last scan stopped and sends what it finds, a page at a time. The
 * cursor moves after each page the server took, so a scan cut short carries on where it was.
 *
 * Each page starts at the time of the last row before it, so that row is read twice; the server
 * leaves an event it already has alone. Only a full page that is all one instant moves past it, or
 * the scan would read that page for ever.
 *
 * @typeParam Row - The log's row.
 * @param reader - The log.
 * @param deps - Where the scan sends to and keeps its place.
 * @param [overrides] - Settings that differ from `PHONE_LOG_DEFAULTS`.
 * @returns How many rows were read and events sent.
 */
export async function scanPhoneLog<Row extends { dateMs: number }>(
  reader: PhoneLogReader<Row>,
  deps: PhoneLogScanDeps,
  overrides: Partial<PhoneLogSettings> = {},
): Promise<PhoneLogScanResult> {
  const { pageSize, maxPagesPerScan, firstScanDays } = { ...PHONE_LOG_DEFAULTS, ...overrides };
  let cursor = deps.readCursor() ?? deps.now() - firstScanDays * MS_PER_DAY;
  const result: PhoneLogScanResult = { read: 0, sent: 0 };

  for (let page = 0; page < maxPagesPerScan; page += 1) {
    const rows = await reader.read(cursor, pageSize);
    const last = rows.at(-1);
    if (last === undefined) {
      break;
    }
    const entries = rows.map(reader.toEntry).filter((entry) => entry !== null);
    if (entries.length > 0) {
      await deps.send(entries);
    }
    result.read += rows.length;
    result.sent += entries.length;

    const isFull = rows.length >= pageSize;
    const isStuck = isFull && last.dateMs <= cursor;
    cursor = isStuck ? cursor + 1 : last.dateMs;
    deps.writeCursor(cursor);
    if (isFull === false) {
      break;
    }
  }
  return result;
}
