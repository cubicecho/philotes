import { NativeModule, requireOptionalNativeModule } from 'expo';
import { type ContactIntent, PHILOTES_ACCOUNT_TYPES, type RawContactSync } from '@/lib/contact-intent';

/** The events the module sends. */
type ContactsEvents = {
  /** A warm start: the app was already running when another app sent it a contact intent. */
  onContactIntent: (intent: ContactIntent) => void;
};

/** `app/modules/philotes-contacts`, the Kotlin module. Uncompiled here; see `docs/android.md`. */
declare class PhilotesContactsModule extends NativeModule<ContactsEvents> {
  takeLaunchIntent(): ContactIntent | null;
  requestReadPermission(): Promise<{ granted: boolean }>;
  findRawContact(uri: string, accountTypes: readonly string[]): Promise<RawContactSync | null>;
  finishPick(uid: string | null, accountTypes: readonly string[]): Promise<boolean>;
}

/** The module, or `null` on the web and in a development build made before it was added. */
const native = requireOptionalNativeModule<PhilotesContactsModule>('PhilotesContacts');

/** Whether this build can read contact intents and the phone's contacts. */
export const hasContactsModule = native !== null;

/**
 * The intent the app was started with, once per intent.
 *
 * @returns The intent, or `null` when it was taken already or there is no module.
 */
export function takeLaunchIntent(): ContactIntent | null {
  return native?.takeLaunchIntent() ?? null;
}

/**
 * Listens for contact intents sent while the app is running.
 *
 * @param listener - Called with each intent.
 * @returns A function that stops listening.
 */
export function onContactIntent(listener: (intent: ContactIntent) => void): () => void {
  const subscription = native?.addListener('onContactIntent', listener);
  return () => subscription?.remove();
}

/**
 * Asks to read the phone's contacts, unless that was granted already.
 *
 * @returns True once it is granted.
 */
export async function requestContactsPermission(): Promise<boolean> {
  const result = await native?.requestReadPermission();
  return result?.granted ?? false;
}

/** Reads the sync columns of a Philotes raw contact behind a contact URI; `null` without the module. */
export const readRawContactSync =
  native === null ? null : (uri: string) => native.findRawContact(uri, PHILOTES_ACCOUNT_TYPES);

/**
 * Answers the app that asked to pick a contact, and closes Philotes.
 *
 * @param uid - The chosen person's uid, or `null` to cancel.
 * @returns True when a phone contact was found for them and sent back.
 */
export async function finishPick(uid: string | null): Promise<boolean> {
  return (await native?.finishPick(uid, PHILOTES_ACCOUNT_TYPES)) ?? false;
}
