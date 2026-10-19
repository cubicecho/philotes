package expo.modules.philotescontacts

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract.Data
import android.util.Log

private const val TAG = "OpenInPhilotes"

/** The app's route for one person, through its own scheme. Expo Router maps it to `/persons/[id]`. */
private const val PERSON_LINK_PREFIX = "philotes://persons/"

// What the "Open in Philotes" row of a contact opens. The contacts app sends a VIEW of the data row
// (content://com.android.contacts/data/<id>); its DATA1 is the person's id. This activity reads it,
// opens the person in the app, and closes itself without drawing anything.

class OpenInPhilotesActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val personId = intent.data?.let(::personIdOf)
    if (personId == null) {
      Log.w(TAG, "No person on ${intent.data}")
    } else {
      val open = Intent(Intent.ACTION_VIEW, Uri.parse(PERSON_LINK_PREFIX + Uri.encode(personId)))
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      startActivity(open)
    }
    finish()
  }

  private fun personIdOf(row: Uri): String? =
    contentResolver.query(row, arrayOf(Data.MIMETYPE, Data.DATA1), null, null, null)?.use { cursor ->
      val isOurs = cursor.moveToFirst() && cursor.getString(0) == Contract.PHILOTES_PROFILE
      if (isOurs) cursor.getString(1) else null
    }
}
