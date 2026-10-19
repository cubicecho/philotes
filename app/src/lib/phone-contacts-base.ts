// What both halves of `phone-contacts` share: the decisions, kept apart from the native calls so they
// can be tested anywhere.

/** What the app does with the phone's contacts account when a signed-in user opens it. */
export const AccountRefresh = {
  /** No account: the user never turned the sync on, or turned it off. */
  None: 'none',
  /** The account is someone else's, left from a session that ended without signing out. */
  Remove: 'remove',
  /** The account is the user's: hand it the current server and token. */
  Refresh: 'refresh',
} as const;
export type AccountRefresh = (typeof AccountRefresh)[keyof typeof AccountRefresh];

/**
 * Decides what to do with the account on the phone for the user who is signed in.
 *
 * @param accountName - The account's name, or null when there is none.
 * @param email - The signed-in user's email, which the account is named by.
 * @returns What to do.
 */
export function accountRefreshFor(accountName: string | null, email: string): AccountRefresh {
  if (accountName === null) {
    return AccountRefresh.None;
  }
  const isTheirs = accountName.toLowerCase() === email.toLowerCase();
  return isTheirs ? AccountRefresh.Refresh : AccountRefresh.Remove;
}

/** How turning the sync on ended. */
export const SyncStart = {
  Started: 'started',
  /** The user did not let the app read and write contacts. */
  PermissionDenied: 'permission-denied',
} as const;
export type SyncStart = (typeof SyncStart)[keyof typeof SyncStart];
