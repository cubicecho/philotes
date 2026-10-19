package expo.modules.philotescontacts

import android.accounts.Account
import android.accounts.AccountManager
import android.content.ContentResolver
import android.content.Context
import android.os.Bundle
import android.provider.ContactsContract

// The one Philotes account on the phone: named by the user's email, holding the server's address and the
// session token the sync adapter signs in with, and the revision the phone's contacts are complete up to.
// The app's own uid owns the authenticator, so it may read and write all of this without a permission.

/** Must match `android:accountType` in authenticator.xml and syncadapter.xml. */
const val ACCOUNT_TYPE = "com.cubicecho.philotes"

/** How often Android is asked to sync on its own, in seconds. */
private const val PERIODIC_SYNC_SECONDS = 60L * 60L * 4L

private const val KEY_SERVER_URL = "serverUrl"
private const val KEY_REVISION = "revision"

object PhilotesAccount {
  private fun manager(context: Context) = AccountManager.get(context)

  /** The account, or null when there is none. */
  fun current(context: Context): Account? = manager(context).getAccountsByType(ACCOUNT_TYPE).firstOrNull()

  /**
   * Adds the account, or hands the one there a new address and token. An account for another user is
   * removed first, which takes that user's contacts off the phone with it.
   */
  fun addOrUpdate(context: Context, name: String, serverUrl: String, token: String): Account {
    val manager = manager(context)
    for (other in manager.getAccountsByType(ACCOUNT_TYPE)) {
      if (other.name != name) {
        manager.removeAccountExplicitly(other)
      }
    }
    val account = Account(name, ACCOUNT_TYPE)
    val isNew = manager.addAccountExplicitly(account, token, Bundle().apply { putString(KEY_SERVER_URL, serverUrl) })
    if (isNew) {
      ContentResolver.setIsSyncable(account, ContactsContract.AUTHORITY, 1)
      ContentResolver.setSyncAutomatically(account, ContactsContract.AUTHORITY, true)
      ContentResolver.addPeriodicSync(account, ContactsContract.AUTHORITY, Bundle.EMPTY, PERIODIC_SYNC_SECONDS)
    } else {
      // A different server means none of the contacts on the phone can be trusted.
      if (manager.getUserData(account, KEY_SERVER_URL) != serverUrl) {
        manager.setUserData(account, KEY_REVISION, null)
      }
      manager.setPassword(account, token)
      manager.setUserData(account, KEY_SERVER_URL, serverUrl)
    }
    return account
  }

  /** Removes the account. Android deletes its contacts with it. */
  fun remove(context: Context) {
    val manager = manager(context)
    for (account in manager.getAccountsByType(ACCOUNT_TYPE)) {
      manager.removeAccountExplicitly(account)
    }
  }

  /** Asks Android to sync the account now, even if the user turned automatic sync off. */
  fun requestSync(account: Account) {
    val extras = Bundle().apply {
      putBoolean(ContentResolver.SYNC_EXTRAS_MANUAL, true)
      putBoolean(ContentResolver.SYNC_EXTRAS_EXPEDITED, true)
    }
    ContentResolver.requestSync(account, ContactsContract.AUTHORITY, extras)
  }

  fun serverUrl(context: Context, account: Account): String? = manager(context).getUserData(account, KEY_SERVER_URL)

  fun token(context: Context, account: Account): String? = manager(context).getPassword(account)

  fun revision(context: Context, account: Account): Long? = manager(context).getUserData(account, KEY_REVISION)?.toLongOrNull()

  fun setRevision(context: Context, account: Account, revision: Long?) {
    manager(context).setUserData(account, KEY_REVISION, revision?.toString())
  }
}
