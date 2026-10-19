package expo.modules.philotescontacts

import android.accounts.AbstractAccountAuthenticator
import android.accounts.Account
import android.accounts.AccountAuthenticatorResponse
import android.accounts.AccountManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.IBinder

// The account type's authenticator, which Android binds to from Settings > Accounts. The app adds and
// removes the account itself (`PhilotesAccount`) once the user is signed in, so the authenticator's only
// job is to send someone who taps "Add account" to the app's settings, where sync is turned on.

/** Where "Add account" leads: the settings page, through the app's own scheme. */
private const val SETTINGS_LINK = "philotes://settings"

class PhilotesAuthenticator(private val context: Context) : AbstractAccountAuthenticator(context) {
  override fun addAccount(
    response: AccountAuthenticatorResponse?,
    accountType: String?,
    authTokenType: String?,
    requiredFeatures: Array<out String>?,
    options: Bundle?,
  ): Bundle {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SETTINGS_LINK)).setPackage(context.packageName)
    return Bundle().apply { putParcelable(AccountManager.KEY_INTENT, intent) }
  }

  // The token lives in the account's password and is never asked for through the authenticator.
  override fun getAuthToken(
    response: AccountAuthenticatorResponse?,
    account: Account?,
    authTokenType: String?,
    options: Bundle?,
  ): Bundle? = null

  override fun getAuthTokenLabel(authTokenType: String?): String? = null

  override fun confirmCredentials(response: AccountAuthenticatorResponse?, account: Account?, options: Bundle?): Bundle? = null

  override fun updateCredentials(
    response: AccountAuthenticatorResponse?,
    account: Account?,
    authTokenType: String?,
    options: Bundle?,
  ): Bundle? = null

  override fun hasFeatures(response: AccountAuthenticatorResponse?, account: Account?, features: Array<out String>?): Bundle =
    Bundle().apply { putBoolean(AccountManager.KEY_BOOLEAN_RESULT, false) }

  override fun editProperties(response: AccountAuthenticatorResponse?, accountType: String?): Bundle? = null
}

/** Hands Android the authenticator. Declared in the manifest by the config plugin. */
class AuthenticatorService : Service() {
  private lateinit var authenticator: PhilotesAuthenticator

  override fun onCreate() {
    authenticator = PhilotesAuthenticator(this)
  }

  override fun onBind(intent: Intent?): IBinder? = authenticator.iBinder
}
