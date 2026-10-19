package expo.modules.philotescontacts

import android.accounts.Account
import android.content.ContentProviderClient
import android.content.ContentProviderOperation
import android.content.ContentUris
import android.content.ContentValues
import android.net.Uri
import android.provider.ContactsContract
import android.provider.ContactsContract.Data
import android.provider.ContactsContract.RawContacts

// The Philotes account's raw contacts in Android's contacts database. Each raw contact is one person:
// SOURCE_ID holds the person's id and SYNC1 the revision the phone last had from the server. Every write
// is made as the sync adapter (CALLER_IS_SYNCADAPTER), so it neither marks the contact dirty nor is
// mistaken for an edit made on the phone.

/** A raw contact the phone holds. */
data class LocalContact(val rawId: Long, val personId: String?, val revision: Long?)

class ContactsStore(private val provider: ContentProviderClient, private val account: Account) {
  private fun asSyncAdapter(uri: Uri): Uri = uri.buildUpon()
    .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
    .appendQueryParameter(RawContacts.ACCOUNT_NAME, account.name)
    .appendQueryParameter(RawContacts.ACCOUNT_TYPE, account.type)
    .build()

  private val rawContactsUri = asSyncAdapter(RawContacts.CONTENT_URI)
  private val dataUri = asSyncAdapter(Data.CONTENT_URI)

  /** The account's raw contacts that match a selection over RawContacts. */
  private fun query(selection: String, args: Array<String>): List<LocalContact> {
    val projection = arrayOf(RawContacts._ID, RawContacts.SOURCE_ID, RawContacts.SYNC1)
    val accountSelection = "${RawContacts.ACCOUNT_TYPE} = ? AND ${RawContacts.ACCOUNT_NAME} = ? AND ($selection)"
    val contacts = mutableListOf<LocalContact>()
    provider.query(rawContactsUri, projection, accountSelection, arrayOf(account.type, account.name, *args), null)?.use { cursor ->
      while (cursor.moveToNext()) {
        contacts += LocalContact(
          rawId = cursor.getLong(0),
          personId = if (cursor.isNull(1)) null else cursor.getString(1),
          revision = if (cursor.isNull(2)) null else cursor.getString(2).toLongOrNull(),
        )
      }
    }
    return contacts
  }

  /** Every raw contact of the account that is not waiting to be purged. */
  fun all(): List<LocalContact> = query("${RawContacts.DELETED} = 0", emptyArray())

  /** The contacts deleted on the phone, which the provider keeps until the sync adapter purges them. */
  fun deleted(): List<LocalContact> = query("${RawContacts.DELETED} = 1", emptyArray())

  /** The contacts made or changed on the phone since the last sync. */
  fun dirty(): List<LocalContact> = query("${RawContacts.DIRTY} = 1 AND ${RawContacts.DELETED} = 0", emptyArray())

  /** The raw contact for a person, if the phone has one. */
  fun find(personId: String): LocalContact? = query("${RawContacts.SOURCE_ID} = ?", arrayOf(personId)).firstOrNull()

  /** A raw contact's data rows, as the mapping reads them. */
  fun dataRowsOf(rawId: Long): List<DataRow> {
    val columns = arrayOf(
      Data.MIMETYPE, Data.IS_PRIMARY,
      Data.DATA1, Data.DATA2, Data.DATA3, Data.DATA4, Data.DATA5, Data.DATA6, Data.DATA7, Data.DATA8, Data.DATA9, Data.DATA10,
    )
    val names = listOf(
      Contract.IS_PRIMARY,
      Contract.DATA1, Contract.DATA2, Contract.DATA3, Contract.DATA4, Contract.DATA5, Contract.DATA6, Contract.DATA7,
      Contract.DATA8, Contract.DATA9, Contract.DATA10,
    )
    val rows = mutableListOf<DataRow>()
    provider.query(dataUri, columns, "${Data.RAW_CONTACT_ID} = ?", arrayOf(rawId.toString()), null)?.use { cursor ->
      while (cursor.moveToNext()) {
        // Every column is read as text; the mapping reads numbers out of it.
        val values = names.mapIndexed { index, name -> name to cursor.getString(index + 1) }.toMap()
        rows += DataRow(cursor.getString(0), values)
      }
    }
    return rows
  }

  /**
   * Writes a person as the server has them: a new raw contact, or the mapped rows of the one the phone
   * has replaced. Rows the mapping does not write, such as a photo set on the phone, are kept.
   */
  fun write(server: ServerCard, existing: LocalContact?) {
    val operations = ArrayList<ContentProviderOperation>()
    val rows = rowsOf(server.card, server.personId)
    val state = ContentValues().apply {
      put(RawContacts.SOURCE_ID, server.personId)
      put(RawContacts.SYNC1, server.revision.toString())
      put(RawContacts.DIRTY, 0)
    }
    if (existing == null) {
      state.put(RawContacts.ACCOUNT_NAME, account.name)
      state.put(RawContacts.ACCOUNT_TYPE, account.type)
      operations += ContentProviderOperation.newInsert(rawContactsUri).withValues(state).build()
      for (row in rows) {
        // The rows point at the raw contact inserted by the first operation of the batch.
        operations += ContentProviderOperation.newInsert(dataUri)
          .withValueBackReference(Data.RAW_CONTACT_ID, 0)
          .withValues(valuesOf(row))
          .build()
      }
    } else {
      val mapped = MAPPED_MIME_TYPES.joinToString(",") { "?" }
      operations += ContentProviderOperation.newDelete(dataUri)
        .withSelection("${Data.RAW_CONTACT_ID} = ? AND ${Data.MIMETYPE} IN ($mapped)", arrayOf(existing.rawId.toString(), *MAPPED_MIME_TYPES.toTypedArray()))
        .build()
      for (row in rows) {
        operations += ContentProviderOperation.newInsert(dataUri)
          .withValue(Data.RAW_CONTACT_ID, existing.rawId)
          .withValues(valuesOf(row))
          .build()
      }
      operations += ContentProviderOperation.newUpdate(ContentUris.withAppendedId(rawContactsUri, existing.rawId)).withValues(state).build()
    }
    provider.applyBatch(operations)
  }

  /** Marks a contact as in step with the server, without changing its rows. */
  fun markClean(contact: LocalContact) {
    val values = ContentValues().apply { put(RawContacts.DIRTY, 0) }
    provider.update(ContentUris.withAppendedId(rawContactsUri, contact.rawId), values, null, null)
  }

  /** Removes a raw contact for good: one the server no longer has, or one deleted on the phone. */
  fun purge(rawId: Long) {
    provider.delete(ContentUris.withAppendedId(rawContactsUri, rawId), null, null)
  }

  private fun valuesOf(row: DataRow): ContentValues = ContentValues().apply {
    put(Data.MIMETYPE, row.mimeType)
    for ((column, value) in row.values) {
      when (value) {
        null -> putNull(column)
        is Int -> put(column, value)
        is Long -> put(column, value)
        is Boolean -> put(column, if (value) 1 else 0)
        else -> put(column, value.toString())
      }
    }
  }
}
