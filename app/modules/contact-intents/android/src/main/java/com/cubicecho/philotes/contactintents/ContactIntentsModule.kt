package com.cubicecho.philotes.contactintents

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import android.provider.ContactsContract.RawContacts
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What lets Philotes stand in for the contacts app: the intent the app was opened with, and the
 * sync columns DAVx5 writes on the raw contacts it keeps for the Philotes address book.
 *
 * DAVx5 (synctools' `AddressContract.RawContactColumns`) stores the vCard UID in
 * [RawContacts.SYNC1] and the card's file name in [RawContacts.SOURCE_ID]. expo-contacts reads
 * neither, which is why this module exists. It is small on purpose: the JavaScript side decides
 * what an intent means and which account types count.
 */
class ContactIntentsModule : Module() {
  /** The launch intent already handed to JavaScript, so a remount does not act on it twice. */
  private var takenIntent: Intent? = null

  private val resolver
    get() = (appContext.reactContext ?: throw Exceptions.ReactContextLost()).contentResolver

  override fun definition() = ModuleDefinition {
    Name("ContactIntents")

    Events(INTENT_EVENT)

    /** The intent the activity was started with, once; `null` after that or when there is none. */
    Function("takeLaunchIntent") {
      val intent = appContext.currentActivity?.intent
      if (intent == null || intent === takenIntent) {
        return@Function null
      }
      takenIntent = intent
      describe(intent)
    }

    // A warm start: the activity is `singleTask`, so a second intent arrives here instead.
    OnNewIntent { intent ->
      takenIntent = intent
      sendEvent(INTENT_EVENT, describe(intent))
    }

    AsyncFunction("requestReadPermission") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        appContext.permissions,
        promise,
        Manifest.permission.READ_CONTACTS,
      )
    }

    /**
     * The sync columns of the first raw contact behind [uri] that one of [accountTypes] owns, or
     * `null` when none does. [uri] is any contact URI an intent carries: a lookup URI, a
     * `contacts/<id>` or a `raw_contacts/<id>`.
     */
    AsyncFunction("findRawContact") { uri: String, accountTypes: List<String> ->
      val parsed = Uri.parse(uri)
      val contactId = contactIdOf(parsed) ?: return@AsyncFunction null
      findSyncColumns("${RawContacts.CONTACT_ID} = ?", arrayOf(contactId.toString()), accountTypes)
    }

    /**
     * Answers a PICK: the contact whose raw contact carries [uid] in SYNC1 goes back to the app
     * that asked, and the activity finishes. A `null` [uid], or one with no raw contact, cancels.
     */
    AsyncFunction("finishPick") { uid: String?, accountTypes: List<String> ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val contactId = uid?.let { contactIdForUid(it, accountTypes) }
      if (contactId == null) {
        activity.setResult(Activity.RESULT_CANCELED)
      } else {
        val result = Intent().apply {
          data = ContentUris.withAppendedId(ContactsContract.Contacts.CONTENT_URI, contactId)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.setResult(Activity.RESULT_OK, result)
      }
      activity.finish()
      contactId != null
    }
  }

  /** The parts of an intent JavaScript reads: its action, data, type, and its string extras. */
  private fun describe(intent: Intent): Map<String, Any?> {
    val extras = mutableMapOf<String, String>()
    intent.extras?.let { bundle ->
      for (key in bundle.keySet()) {
        // Only the strings: `ContactsContract.Intents.Insert.DATA` is a list of ContentValues.
        @Suppress("DEPRECATION")
        val value = bundle.get(key)
        if (value is String) {
          extras[key] = value
        }
      }
    }
    return mapOf(
      "action" to intent.action,
      "data" to intent.dataString,
      "type" to intent.type,
      "extras" to extras,
    )
  }

  /** The aggregate contact's id, from a raw contact URI or anything `lookupContact` resolves. */
  private fun contactIdOf(uri: Uri): Long? {
    val isRawContact = uri.pathSegments.firstOrNull() == RAW_CONTACTS_PATH
    if (isRawContact) {
      val rawId = uri.lastPathSegment?.toLongOrNull() ?: return null
      resolver.query(
        ContentUris.withAppendedId(RawContacts.CONTENT_URI, rawId),
        arrayOf(RawContacts.CONTACT_ID),
        null,
        null,
        null,
      )?.use { cursor ->
        return if (cursor.moveToFirst()) cursor.getLong(0) else null
      }
      return null
    }
    val contactUri = ContactsContract.Contacts.lookupContact(resolver, uri) ?: return null
    return ContentUris.parseId(contactUri)
  }

  /** SYNC1 (the UID) and SOURCE_ID (the file name) of the first matching live raw contact. */
  private fun findSyncColumns(
    selection: String,
    args: Array<String>,
    accountTypes: List<String>,
  ): Map<String, String?>? {
    if (accountTypes.isEmpty()) {
      return null
    }
    val placeholders = accountTypes.joinToString(",") { "?" }
    resolver.query(
      RawContacts.CONTENT_URI,
      arrayOf(RawContacts.SYNC1, RawContacts.SOURCE_ID, RawContacts.ACCOUNT_TYPE),
      "$selection AND ${RawContacts.DELETED} = 0 AND ${RawContacts.ACCOUNT_TYPE} IN ($placeholders)",
      args + accountTypes,
      null,
    )?.use { cursor ->
      if (cursor.moveToFirst()) {
        return mapOf(
          "uid" to cursor.getString(0),
          "fileName" to cursor.getString(1),
          "accountType" to cursor.getString(2),
        )
      }
    }
    return null
  }

  /** The aggregate contact holding the raw contact whose SYNC1 is [uid]. */
  private fun contactIdForUid(uid: String, accountTypes: List<String>): Long? {
    if (accountTypes.isEmpty()) {
      return null
    }
    val placeholders = accountTypes.joinToString(",") { "?" }
    resolver.query(
      RawContacts.CONTENT_URI,
      arrayOf(RawContacts.CONTACT_ID),
      "${RawContacts.SYNC1} = ? AND ${RawContacts.DELETED} = 0 AND ${RawContacts.ACCOUNT_TYPE} IN ($placeholders)",
      arrayOf(uid) + accountTypes,
      null,
    )?.use { cursor ->
      if (cursor.moveToFirst()) {
        return cursor.getLong(0)
      }
    }
    return null
  }

  companion object {
    private const val INTENT_EVENT = "onContactIntent"
    private const val RAW_CONTACTS_PATH = "raw_contacts"
  }
}
