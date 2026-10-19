package expo.modules.philotescontacts

import android.accounts.Account
import android.app.Service
import android.content.AbstractThreadedSyncAdapter
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.content.SyncResult
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import java.io.IOException

private const val TAG = "PhilotesSync"

// The contacts sync adapter. Android runs `onPerformSync` on a thread of its own when the account asks
// for a sync: periodically, when contacts change on the phone, or when the app calls `requestSync`.
// The app's JavaScript need not be running.

class ContactsSyncAdapter(context: Context) : AbstractThreadedSyncAdapter(context, true) {
  override fun onPerformSync(
    account: Account,
    extras: Bundle?,
    authority: String?,
    provider: ContentProviderClient,
    syncResult: SyncResult,
  ) {
    val serverUrl = PhilotesAccount.serverUrl(context, account)
    val token = PhilotesAccount.token(context, account)
    if (serverUrl == null || token == null) {
      syncResult.stats.numAuthExceptions++
      return
    }
    try {
      val sync = ContactsSync(
        api = PhilotesApi(serverUrl, token),
        store = ContactsStore(provider, account),
        since = PhilotesAccount.revision(context, account),
        result = syncResult,
      )
      PhilotesAccount.setRevision(context, account, sync.run())
    } catch (signedOut: SignedOutException) {
      // Android shows the account as failing; the app hands over a new token when the user signs in.
      Log.w(TAG, "The session ended: ${signedOut.message}")
      syncResult.stats.numAuthExceptions++
    } catch (network: IOException) {
      // Counted as a soft error, which Android retries later with a back-off.
      Log.w(TAG, "The sync stopped: ${network.message}")
      syncResult.stats.numIoExceptions++
    } catch (failure: Exception) {
      Log.e(TAG, "The sync failed", failure)
      syncResult.stats.numParseExceptions++
    }
  }
}

/** Hands Android the sync adapter. Declared in the manifest by the config plugin. */
class SyncService : Service() {
  override fun onCreate() {
    synchronized(lock) {
      if (adapter == null) {
        adapter = ContactsSyncAdapter(applicationContext)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = adapter?.syncAdapterBinder

  companion object {
    private val lock = Any()
    private var adapter: ContactsSyncAdapter? = null
  }
}
