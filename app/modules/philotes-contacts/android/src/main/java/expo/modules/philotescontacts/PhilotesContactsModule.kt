package expo.modules.philotescontacts

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The JavaScript side's handle on the account: `app/modules/philotes-contacts/index.ts`. Asking for the
// contacts permissions is the app's job (React Native's PermissionsAndroid); this module only manages
// the account and asks Android to sync it.

class PhilotesContactsModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PhilotesContacts")

    /** The account's name (the user's email), or null when there is none. */
    Function("accountName") {
      PhilotesAccount.current(context)?.name
    }

    /** Adds the account, or hands it a new server and token, then syncs it. */
    AsyncFunction("addAccount") { name: String, serverUrl: String, token: String ->
      val account = PhilotesAccount.addOrUpdate(context, name, serverUrl, token)
      PhilotesAccount.requestSync(account)
    }

    /** Removes the account, and with it the contacts it put on the phone. */
    AsyncFunction("removeAccount") {
      PhilotesAccount.remove(context)
    }

    /** Asks Android to sync now. Does nothing without an account. */
    Function("requestSync") {
      val account = PhilotesAccount.current(context)
      if (account != null) {
        PhilotesAccount.requestSync(account)
      }
    }
  }
}
