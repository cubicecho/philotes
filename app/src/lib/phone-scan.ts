import { type Permission, PermissionsAndroid, Platform } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { client } from '@/lib/apollo';
import { isAuthenticated } from '@/lib/auth';
import { readItem, removeItem, writeItem } from '@/lib/device-store';
import {
  callEntry,
  type PhoneLogEntry,
  type PhoneLogScanDeps,
  type PhoneLogScanResult,
  type PhoneSource,
  scanPhoneLog,
  textEntry,
} from '@/lib/phone-log';
import { InteractionSource } from '@/lib/vocabulary';
import { isPhoneLogAvailable, readCalls, readTexts } from '../../modules/phone-log';

// Reading the phone's call log and texts into interactions, on a device that was told it may. Each source
// is off until the user turns it on in Settings, and turning one on asks Android for its permission. What
// was read is sent to the server, which matches numbers to people and drops the rest. Where each source
// has read up to is kept on the device.

const LOG_INTERACTIONS = graphql(`
  mutation LogInteractions($entries: [PhoneLogEntryInput!]!) {
    logInteractions(entries: $entries) {
      logged
      alreadyLogged
      unmatched
    }
  }
`);

/** What the app needs to read one source. */
interface PhoneSourceConfig {
  /** The Android permission that lets the app read it. */
  permission: Permission;
  /** The device-store key that says the user turned it on. */
  enabledKey: string;
  /** The device-store key that holds the time the last scan reached. */
  cursorKey: string;
  /** Reads the source from where its cursor stands and sends what it finds. */
  scan: (deps: PhoneLogScanDeps) => Promise<PhoneLogScanResult>;
}

/** Each source the phone reads. */
const PHONE_SOURCES: Readonly<Record<PhoneSource, PhoneSourceConfig>> = {
  [InteractionSource.CallLog]: {
    permission: PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    enabledKey: 'philotes_phone_log_call-log_enabled',
    cursorKey: 'philotes_phone_log_call-log_cursor',
    scan: (deps) => scanPhoneLog({ read: readCalls, toEntry: callEntry }, deps),
  },
  [InteractionSource.Sms]: {
    permission: PermissionsAndroid.PERMISSIONS.READ_SMS,
    enabledKey: 'philotes_phone_log_sms_enabled',
    cursorKey: 'philotes_phone_log_sms_cursor',
    scan: (deps) => scanPhoneLog({ read: readTexts, toEntry: textEntry }, deps),
  },
};

/** The sources, in the order a scan reads them. */
const SOURCE_ORDER: readonly PhoneSource[] = [InteractionSource.CallLog, InteractionSource.Sms];

/** What a stored "on" holds. */
const ENABLED = 'on';

/** Whether this device can read its call log and texts: an Android build that carries the module. */
export const CAN_READ_PHONE_LOG = Platform.OS === 'android' && isPhoneLogAvailable();

/**
 * Whether the user turned a source on.
 *
 * @param source - The source.
 * @returns False until it is turned on, and always on a device that cannot read it.
 */
export function isPhoneSourceEnabled(source: PhoneSource): boolean {
  return CAN_READ_PHONE_LOG && readItem(PHONE_SOURCES[source].enabledKey) === ENABLED;
}

/**
 * Whether any source is on, which is what the background scan is registered for.
 *
 * @returns True when the call log or texts are read.
 */
export function isAnyPhoneSourceEnabled(): boolean {
  return SOURCE_ORDER.some(isPhoneSourceEnabled);
}

/**
 * Turns a source on, once Android has granted its permission.
 *
 * @param source - The source.
 * @returns Whether it is on: false when the permission was refused.
 */
export async function enablePhoneSource(source: PhoneSource): Promise<boolean> {
  if (CAN_READ_PHONE_LOG === false) {
    return false;
  }
  const { permission, enabledKey } = PHONE_SOURCES[source];
  const answer = await PermissionsAndroid.request(permission);
  const isGranted = answer === PermissionsAndroid.RESULTS.GRANTED;
  if (isGranted) {
    writeItem(enabledKey, ENABLED);
  }
  return isGranted;
}

/**
 * Turns a source off. Where it had read up to is kept, so turning it on again carries on from there.
 * The permission stays granted until the user takes it back in Android's settings.
 *
 * @param source - The source.
 */
export function disablePhoneSource(source: PhoneSource): void {
  removeItem(PHONE_SOURCES[source].enabledKey);
}

/** What a scan of every source that is on did. */
export interface PhoneScanSummary {
  /** Interactions the server wrote. */
  logged: number;
}

/** The scan running now, so the app opening and the background task never read at once. */
let running: Promise<PhoneScanSummary> | null = null;

/**
 * Reads every source that is on from where it last stopped and sends what it finds. A source whose
 * permission was taken back in Android's settings is skipped. Calling it while a scan runs joins that one.
 *
 * @returns How many interactions were logged.
 * @throws When the server cannot be reached or refuses a page. What was sent before that is kept.
 */
export function scanPhoneSources(): Promise<PhoneScanSummary> {
  if (running === null) {
    running = scanEverySource().finally(() => {
      running = null;
    });
  }
  return running;
}

/**
 * Scans each source that is on, one after the other.
 *
 * @returns How many interactions were logged.
 */
async function scanEverySource(): Promise<PhoneScanSummary> {
  const summary: PhoneScanSummary = { logged: 0 };
  if (isAuthenticated() === false) {
    return summary;
  }
  const send = async (entries: PhoneLogEntry[]): Promise<void> => {
    const { data } = await client.mutate({ mutation: LOG_INTERACTIONS, variables: { entries } });
    summary.logged += data?.logInteractions.logged ?? 0;
  };

  for (const source of SOURCE_ORDER) {
    const config = PHONE_SOURCES[source];
    const isOn = isPhoneSourceEnabled(source);
    const isAllowed = isOn && (await PermissionsAndroid.check(config.permission));
    if (isAllowed === false) {
      continue;
    }
    await config.scan({
      send,
      readCursor: () => {
        const stored = readItem(config.cursorKey);
        return stored === null ? null : Number(stored);
      },
      writeCursor: (sinceMs) => writeItem(config.cursorKey, String(sinceMs)),
      now: Date.now,
    });
  }

  if (summary.logged > 0) {
    // Whatever is on screen may list a person's interactions or when they were last in touch.
    await client.refetchQueries({ include: 'active' });
  }
  return summary;
}
