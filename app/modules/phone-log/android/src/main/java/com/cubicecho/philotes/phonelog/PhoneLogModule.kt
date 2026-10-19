package com.cubicecho.philotes.phonelog

import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import android.provider.CallLog
import android.provider.Telephony
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the metadata of the phone's calls and texts: the other number, the time, the Android type
 * and, for a call, how long it lasted. A text's body is never asked for: no projection names it.
 * The app asks for READ_CALL_LOG and READ_SMS first; without them a read is refused.
 */
class PhoneLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PhoneLog")

    // `sinceMs` is milliseconds since the epoch. Rows dated at or after it are read, oldest first.
    AsyncFunction("readCalls") { sinceMs: Double, limit: Int ->
      read(
        uri = CallLog.Calls.CONTENT_URI,
        projection = arrayOf(
          CallLog.Calls._ID,
          CallLog.Calls.NUMBER,
          CallLog.Calls.DATE,
          CallLog.Calls.TYPE,
          CallLog.Calls.DURATION,
        ),
        dateColumn = CallLog.Calls.DATE,
        sinceMs = sinceMs.toLong(),
        limit = limit,
      ) { cursor ->
        mapOf(
          "id" to cursor.getString(0),
          "address" to (cursor.getString(1) ?: ""),
          "dateMs" to cursor.getLong(2).toDouble(),
          "type" to cursor.getInt(3),
          "durationSeconds" to cursor.getInt(4),
        )
      }
    }

    AsyncFunction("readTexts") { sinceMs: Double, limit: Int ->
      read(
        uri = Telephony.Sms.CONTENT_URI,
        projection = arrayOf(
          Telephony.Sms._ID,
          Telephony.Sms.ADDRESS,
          Telephony.Sms.DATE,
          Telephony.Sms.TYPE,
        ),
        dateColumn = Telephony.Sms.DATE,
        sinceMs = sinceMs.toLong(),
        limit = limit,
      ) { cursor ->
        mapOf(
          "id" to cursor.getString(0),
          "address" to (cursor.getString(1) ?: ""),
          "dateMs" to cursor.getLong(2).toDouble(),
          "type" to cursor.getInt(3),
        )
      }
    }
  }

  private val resolver: ContentResolver
    get() = appContext.reactContext?.contentResolver ?: throw Exceptions.ReactContextLost()

  /**
   * Reads up to `limit` rows dated at or after `sinceMs`, oldest first. The limit is applied while
   * reading rather than in the query, since Android 11 refuses a LIMIT written into the sort order.
   */
  private fun read(
    uri: Uri,
    projection: Array<String>,
    dateColumn: String,
    sinceMs: Long,
    limit: Int,
    toRow: (Cursor) -> Map<String, Any>,
  ): List<Map<String, Any>> {
    val rows = mutableListOf<Map<String, Any>>()
    try {
      resolver.query(uri, projection, "$dateColumn >= ?", arrayOf(sinceMs.toString()), "$dateColumn ASC")
        ?.use { cursor ->
          while (rows.size < limit && cursor.moveToNext()) {
            rows.add(toRow(cursor))
          }
        }
    } catch (error: SecurityException) {
      throw CodedException("ERR_PHONE_LOG_PERMISSION", "Philotes may not read this log: ${error.message}", error)
    }
    return rows
  }
}
