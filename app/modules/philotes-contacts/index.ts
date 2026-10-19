import { requireOptionalNativeModule } from 'expo';

// The Philotes account in Android's contacts, from JavaScript. The Kotlin half is in `android/`: an
// account authenticator, and a sync adapter that keeps the account's contacts in step with the server
// whether the app is running or not. Anywhere else (the web, or a build made before the module was
// added) the module is missing and `isPhoneContactsSyncAvailable` says so.

/** The native module, as `PhilotesContactsModule.kt` defines it. */
interface PhilotesContactsNative {
  /** The account's name, or null when there is none. */
  accountName(): string | null;
  /** Adds the account, or hands it a new server and token, then syncs it. */
  addAccount(name: string, serverUrl: string, token: string): Promise<void>;
  /** Removes the account, and with it the contacts it put on the phone. */
  removeAccount(): Promise<void>;
  /** Asks Android to sync now. Does nothing without an account. */
  requestSync(): void;
}

const native = requireOptionalNativeModule<PhilotesContactsNative>('PhilotesContacts');

/** Where the adapter signs in, and as whom. */
export interface PhoneContactsAccount {
  /** What the account is called in Settings > Accounts: the user's email. */
  name: string;
  /** The server's address, as the app reaches it. */
  serverUrl: string;
  /** The session token the adapter sends as a bearer token. */
  token: string;
}

/**
 * Whether this build can put people in the phone's contacts.
 *
 * @returns True on an Android build that has the module.
 */
export function isPhoneContactsSyncAvailable(): boolean {
  return native !== null;
}

/**
 * Reads which account the phone's contacts are synced under.
 *
 * @returns The account's name, or null when there is none or the module is missing.
 */
export function phoneContactsAccountName(): string | null {
  return native?.accountName() ?? null;
}

/**
 * Adds the account, or brings the one there up to date, and syncs it. An account for someone else is
 * removed first.
 *
 * @param account - The account's name, server and token.
 * @throws When the module is missing.
 */
export async function addPhoneContactsAccount(account: PhoneContactsAccount): Promise<void> {
  if (native === null) {
    throw new Error('This build cannot sync to the phone’s contacts.');
  }
  await native.addAccount(account.name, account.serverUrl, account.token);
}

/** Removes the account and the contacts it holds. Does nothing when the module is missing. */
export async function removePhoneContactsAccount(): Promise<void> {
  await native?.removeAccount();
}

/** Asks Android to sync the account now. Does nothing without one. */
export function requestPhoneContactsSync(): void {
  native?.requestSync();
}
