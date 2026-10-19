import { requireOptionalNativeModule } from 'expo';

// The typed face of the `PhoneLog` native module (android/…/PhoneLogModule.kt). It reads who a call or
// text was with, when, which way and how long a call lasted, and never a text's body. Only an Android
// build carries the module: in a browser, or a development build made before it was added, it is absent.

/** One row of the phone's call log, as Android keeps it. */
export interface NativeCallRow {
  /** The row's `_ID` in the call log. */
  id: string;
  /** The other party's number as the phone wrote it. Empty for a withheld number. */
  address: string;
  /** When the call started, in milliseconds since the epoch. */
  dateMs: number;
  /** `CallLog.Calls.TYPE`: incoming, outgoing, missed and the rest, as Android numbers them. */
  type: number;
  /** How long the call lasted. */
  durationSeconds: number;
}

/** One row of the phone's texts, as Android keeps it. Its body is not read. */
export interface NativeTextRow {
  /** The row's `_ID` among the texts. */
  id: string;
  /** The other party's number, or a sender's name for a text from a service. */
  address: string;
  /** When the text was sent or received, in milliseconds since the epoch. */
  dateMs: number;
  /** `Telephony.Sms.TYPE`: inbox, sent, draft and the rest, as Android numbers them. */
  type: number;
}

/** The native module's functions. */
interface PhoneLogNativeModule {
  readCalls(sinceMs: number, limit: number): Promise<NativeCallRow[]>;
  readTexts(sinceMs: number, limit: number): Promise<NativeTextRow[]>;
}

/** The module, or null where the build does not carry it. */
const PhoneLog = requireOptionalNativeModule<PhoneLogNativeModule>('PhoneLog');

/**
 * Whether this build can read the phone's call log and texts at all.
 *
 * @returns False in a browser, and in a build made before the module existed.
 */
export function isPhoneLogAvailable(): boolean {
  return PhoneLog !== null;
}

/**
 * Reads calls from the phone's call log, oldest first. Needs READ_CALL_LOG.
 *
 * @param sinceMs - The earliest start time to read, in milliseconds since the epoch. Rows at it are included.
 * @param limit - The most rows to read.
 * @returns The rows.
 * @throws When the module is absent, or the permission has not been granted (`ERR_PHONE_LOG_PERMISSION`).
 */
export async function readCalls(sinceMs: number, limit: number): Promise<NativeCallRow[]> {
  if (PhoneLog === null) {
    throw new Error('This build cannot read the call log.');
  }
  return PhoneLog.readCalls(sinceMs, limit);
}

/**
 * Reads texts, oldest first: who and when, never what they say. Needs READ_SMS.
 *
 * @param sinceMs - The earliest time to read, in milliseconds since the epoch. Rows at it are included.
 * @param limit - The most rows to read.
 * @returns The rows.
 * @throws When the module is absent, or the permission has not been granted (`ERR_PHONE_LOG_PERMISSION`).
 */
export async function readTexts(sinceMs: number, limit: number): Promise<NativeTextRow[]> {
  if (PhoneLog === null) {
    throw new Error('This build cannot read texts.');
  }
  return PhoneLog.readTexts(sinceMs, limit);
}
