package expo.modules.philotescontacts

import android.content.SyncResult
import android.util.Log

private const val TAG = "PhilotesSync"

// One sync, start to end. Phone changes go up first, each guarded by the revision the phone last had,
// then the server's changes come down. The server wins a conflict: a contact that changed on both sides
// is written over with the server's version, and a phone edit to a person deleted on the server is
// dropped. That is what the server's revision check (`saveContactCard`, `deletePersons` with
// `revision: { eq }`) can promise, and the same rule CardDAV's `If-Match` gives DAVx5.

class ContactsSync(
  private val api: PhilotesApi,
  private val store: ContactsStore,
  /** The revision the phone's contacts are complete up to, or null when they never were. */
  private val since: Long?,
  private val result: SyncResult,
) {
  /** Runs the sync. Returns the revision the phone is now complete up to. */
  fun run(): Long {
    pushDeletes()
    pushEdits()
    return pull()
  }

  /** Contacts deleted on the phone: delete the person, unless they changed on the server since. */
  private fun pushDeletes() {
    for (contact in store.deleted()) {
      val personId = contact.personId
      val revision = contact.revision
      if (personId != null && revision != null) {
        val wasDeleted = api.delete(personId, revision)
        if (wasDeleted) {
          result.stats.numDeletes++
        } else {
          // Changed on the server since: the pull below brings the person back to the phone.
          Log.i(TAG, "Not deleting $personId, which changed on the server")
        }
      }
      store.purge(contact.rawId)
    }
  }

  /** Contacts made or changed on the phone. */
  private fun pushEdits() {
    for (contact in store.dirty()) {
      val card = cardOf(store.dataRowsOf(contact.rawId))
      val saved = try {
        api.save(card, contact.personId, contact.revision)
      } catch (rejected: RejectedException) {
        // Left dirty, so the edit is not lost; it is tried again on the next sync.
        Log.w(TAG, "The server refused contact ${contact.rawId}: ${rejected.message}")
        result.stats.numSkippedEntries++
        continue
      }
      val server = saved.card
      when {
        server != null -> store.write(server, contact)
        // A conflict with nobody left on the server: the person was deleted there.
        else -> store.purge(contact.rawId)
      }
      if (saved.outcome == SaveOutcome.CONFLICT) {
        result.stats.numConflictDetectedExceptions++
      } else {
        result.stats.numUpdates++
      }
    }
  }

  /** The server's changes since the phone last synced, or everything on the first sync. */
  private fun pull(): Long {
    // Asked first: every change up to it is committed, so the pages below are complete up to it.
    val head = api.revision()
    // A server put back from a backup counts from an older number, and nothing on the phone can be trusted.
    val from = since?.takeIf { it <= head }
    if (from == head) {
      return head
    }
    val changed = api.changedCards(from)
    for (server in changed) {
      val local = store.find(server.personId)
      store.write(server, local)
      if (local == null) {
        result.stats.numInserts++
      } else {
        result.stats.numUpdates++
      }
    }
    if (from == null) {
      // A full read: anyone the phone still holds that the server did not send is gone.
      val kept = changed.mapTo(HashSet()) { it.personId }
      for (contact in store.all()) {
        val isGone = contact.personId != null && contact.personId !in kept
        if (isGone) {
          store.purge(contact.rawId)
          result.stats.numDeletes++
        }
      }
    } else {
      for (personId in api.removedIds(from)) {
        store.find(personId)?.let {
          store.purge(it.rawId)
          result.stats.numDeletes++
        }
      }
    }
    return head
  }
}
