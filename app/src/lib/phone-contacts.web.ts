import { SyncStart } from '@/lib/phone-contacts-base';

// The browser's half of `phone-contacts.ts`: a browser has no phone contacts to sync, so nothing is
// supported and every call does nothing.

export { AccountRefresh, SyncStart } from '@/lib/phone-contacts-base';

/**
 * Whether this build can sync to the phone's contacts.
 *
 * @returns False: a browser cannot.
 */
export function isPhoneContactsSupported(): boolean {
  return false;
}

/**
 * Whether the phone's contacts are synced now.
 *
 * @returns False.
 */
export function isSyncingPhoneContacts(): boolean {
  return false;
}

/**
 * Turns the sync on. Never reached: nothing offers it in a browser.
 *
 * @param _email - Unused.
 * @returns That it was refused.
 */
export async function startPhoneContactsSync(_email: string): Promise<SyncStart> {
  return SyncStart.PermissionDenied;
}

/** Turns the sync off. Nothing to do. */
export async function stopPhoneContactsSync(): Promise<void> {}

/**
 * Brings the account in line with whoever is signed in. Nothing to do.
 *
 * @param _email - Unused.
 */
export async function refreshPhoneContactsSync(_email: string): Promise<void> {}

/** Asks for a sync now. Nothing to do. */
export function requestPhoneContactsRefresh(): void {}
