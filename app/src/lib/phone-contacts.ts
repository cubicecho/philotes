import { PermissionsAndroid } from 'react-native';
import { apiUrl } from '@/lib/api-url';
import { getToken } from '@/lib/auth';
import { AccountRefresh, accountRefreshFor, SyncStart } from '@/lib/phone-contacts-base';
import {
  addPhoneContactsAccount,
  isPhoneContactsSyncAvailable,
  phoneContactsAccountName,
  removePhoneContactsAccount,
  requestPhoneContactsSync,
} from '../../modules/philotes-contacts';

// The phone's own contacts, kept by the Philotes account's sync adapter (`app/modules/philotes-contacts`).
// The account carries the server's address and the session token, so the adapter syncs without the app.
// `phone-contacts.web.ts` is the browser's half, where there is no such thing.

export { AccountRefresh, SyncStart } from '@/lib/phone-contacts-base';

/** The permissions the sync adapter needs at run time. */
const CONTACTS_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
] as const;

/**
 * Whether this build can sync to the phone's contacts.
 *
 * @returns True on an Android build with the module.
 */
export function isPhoneContactsSupported(): boolean {
  return isPhoneContactsSyncAvailable();
}

/**
 * Whether the phone's contacts are synced now.
 *
 * @returns True when the account exists.
 */
export function isSyncingPhoneContacts(): boolean {
  return phoneContactsAccountName() !== null;
}

/**
 * Hands the account the server and the session the app is signed in with.
 *
 * @param email - The signed-in user's email, which names the account.
 * @throws When there is no session or no server address.
 */
async function writeAccount(email: string): Promise<void> {
  const token = getToken();
  const serverUrl = apiUrl();
  if (token === null || serverUrl === '') {
    throw new Error('Sign in to a server before syncing to the phone’s contacts.');
  }
  await addPhoneContactsAccount({ name: email, serverUrl, token });
}

/**
 * Turns the sync on: asks for the contacts permissions, adds the account and syncs it.
 *
 * @param email - The signed-in user's email.
 * @returns Whether it started, or that the permissions were refused.
 */
export async function startPhoneContactsSync(email: string): Promise<SyncStart> {
  const granted = await PermissionsAndroid.requestMultiple([...CONTACTS_PERMISSIONS]);
  const isGranted = CONTACTS_PERMISSIONS.every(
    (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
  if (isGranted === false) {
    return SyncStart.PermissionDenied;
  }
  await writeAccount(email);
  return SyncStart.Started;
}

/** Turns the sync off: removes the account, and Android removes its contacts. */
export async function stopPhoneContactsSync(): Promise<void> {
  await removePhoneContactsAccount();
}

/**
 * Brings the account in line with whoever is signed in: hands the user's own account the current token
 * (a sign-in after a session ended issues a new one), and removes an account left by someone else.
 *
 * @param email - The signed-in user's email.
 */
export async function refreshPhoneContactsSync(email: string): Promise<void> {
  const refresh = accountRefreshFor(phoneContactsAccountName(), email);
  if (refresh === AccountRefresh.Remove) {
    await removePhoneContactsAccount();
  } else if (refresh === AccountRefresh.Refresh) {
    await writeAccount(email);
  }
}

/** Asks for a sync now, so changes made in the app reach the phone's contacts. Does nothing without the account. */
export function requestPhoneContactsRefresh(): void {
  requestPhoneContactsSync();
}
