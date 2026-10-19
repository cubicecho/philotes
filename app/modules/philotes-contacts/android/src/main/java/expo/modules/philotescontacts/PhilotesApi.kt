package expo.modules.philotescontacts

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// The server's GraphQL API, as the sync adapter uses it. The same calls the app's people list makes
// (`app/src/lib/people-sync.ts`): the user's revision, what changed after a revision, and the tombstones
// of who was deleted after it. Writes go through `saveContactCard` and the generated `deletePersons`, each
// guarded by the revision the phone last saw. The session token is the app's own, sent as a bearer token.

/** The server refused the token: the session ended. The app hands over a new one at its next sign-in. */
class SignedOutException(message: String) : IOException(message)

/** The server refused one contact as it is. The rest of the sync carries on. */
class RejectedException(message: String) : IOException(message)

/** A card the server sent, with what the sync keeps beside it. */
data class ServerCard(val personId: String, val revision: Long, val cursor: String, val card: Card)

/** How a save ended. `card` is the person as the server now has them, or null when they are gone. */
data class SaveResult(val outcome: String, val card: ServerCard?)

/** `ContactCardOutcome`, as the server names it. */
object SaveOutcome {
  const val CREATED = "CREATED"
  const val UPDATED = "UPDATED"
  const val CONFLICT = "CONFLICT"
}

private const val GRAPHQL_PATH = "/graphql"
private const val ERROR_CODE_UNAUTHENTICATED = "UNAUTHENTICATED"
private const val ERROR_CODE_BAD_USER_INPUT = "BAD_USER_INPUT"
private const val CONNECT_TIMEOUT_MS = 15_000
private const val READ_TIMEOUT_MS = 60_000

/** Cards a page. A card costs its fields, and a page must stay under the server's `maxCost`. */
const val CARD_PAGE_SIZE = 100

private const val CARD_FIELDS = """
  personId revision cursor namePrefix firstName middleName lastName nameSuffix nickname organization department
  jobTitle about
  contactInfos { type value kind label isPrimary }
  addresses { type label line1 line2 city state postalCode country isPrimary }
  dates { kind name date hasYear }
"""

private const val REVISION_QUERY = "query { me { personsRevision } }"
private const val CARDS_QUERY =
  "query (\$since: Float, \$after: String, \$limit: Int) { contactCards(since: \$since, after: \$after, limit: \$limit) { $CARD_FIELDS } }"
private const val TOMBSTONES_QUERY =
  "query (\$since: Float!, \$limit: Int!, \$after: String) { personTombstones(where: { revision: { gt: \$since } }, orderBy: { id: { direction: asc, priority: 1 } }, limit: \$limit, after: \$after) { personId cursor } }"
private const val SAVE_MUTATION =
  "mutation (\$input: ContactCardInput!) { saveContactCard(input: \$input) { outcome card { $CARD_FIELDS } } }"
private const val DELETE_MUTATION =
  "mutation (\$id: UUID!, \$revision: Float!) { deletePersons(where: { id: { eq: \$id }, revision: { eq: \$revision } }) { id } }"

class PhilotesApi(private val serverUrl: String, private val token: String) {
  /** The user's revision: every change to their people up to it is committed. */
  fun revision(): Long {
    // `me` is null rather than an error when the session has ended.
    val me = run(REVISION_QUERY, JSONObject()).optJSONObject("me") ?: throw SignedOutException("Signed out")
    return me.getLong("personsRevision")
  }

  /** Every card changed after `since`, or everyone's when it is null, a page at a time. */
  fun changedCards(since: Long?): List<ServerCard> = readAll { after ->
    val variables = JSONObject().put("limit", CARD_PAGE_SIZE).put("since", since ?: JSONObject.NULL).put("after", after ?: JSONObject.NULL)
    val page = run(CARDS_QUERY, variables).getJSONArray("contactCards")
    (0 until page.length()).map { serverCardOf(page.getJSONObject(it)) }.let { cards -> cards to cards.lastOrNull()?.cursor }
  }

  /** The ids of the people deleted after `since`. */
  fun removedIds(since: Long): List<String> = readAll { after ->
    val variables = JSONObject().put("since", since).put("limit", CARD_PAGE_SIZE).put("after", after ?: JSONObject.NULL)
    val page = run(TOMBSTONES_QUERY, variables).getJSONArray("personTombstones")
    val rows = (0 until page.length()).map { page.getJSONObject(it) }
    rows.map { it.getString("personId") } to rows.lastOrNull()?.optString("cursor")
  }

  /** Saves a contact, unless the person changed after `ifRevision`. */
  fun save(card: Card, personId: String?, ifRevision: Long?): SaveResult {
    val input = jsonOf(card).put("personId", personId ?: JSONObject.NULL).put("ifRevision", ifRevision ?: JSONObject.NULL)
    val result = run(SAVE_MUTATION, JSONObject().put("input", input)).getJSONObject("saveContactCard")
    val saved = result.optJSONObject("card")?.let(::serverCardOf)
    return SaveResult(result.getString("outcome"), saved)
  }

  /** Deletes a person, unless they changed after `ifRevision`. True when they were deleted. */
  fun delete(personId: String, ifRevision: Long): Boolean {
    val variables = JSONObject().put("id", personId).put("revision", ifRevision)
    return run(DELETE_MUTATION, variables).getJSONArray("deletePersons").length() > 0
  }

  /** Reads pages until one comes back short. `fetch` returns a page and the cursor after it. */
  private fun <T> readAll(fetch: (after: String?) -> Pair<List<T>, String?>): List<T> {
    val all = mutableListOf<T>()
    var after: String? = null
    while (true) {
      val (page, last) = fetch(after)
      all += page
      if (page.size < CARD_PAGE_SIZE || last == null) {
        return all
      }
      after = last
    }
  }

  /** Runs one operation and returns its `data`. */
  private fun run(query: String, variables: JSONObject): JSONObject {
    val connection = URL(serverUrl.trimEnd('/') + GRAPHQL_PATH).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Authorization", "Bearer $token")
      val body = JSONObject().put("query", query).put("variables", variables).toString()
      connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

      // Yoga answers a GraphQL error with 200 and puts the reason in `errors`; anything else is the network's.
      val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
      val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
        ?: throw IOException("The server answered ${connection.responseCode} with no body.")
      val answer = JSONObject(text)
      answer.optJSONArray("errors")?.let(::throwFirst)
      return answer.getJSONObject("data")
    } finally {
      connection.disconnect()
    }
  }

  private fun throwFirst(errors: JSONArray): Nothing {
    val first = errors.optJSONObject(0)
    val message = first?.optString("message") ?: "The server refused the request."
    when (first?.optJSONObject("extensions")?.optString("code")) {
      ERROR_CODE_UNAUTHENTICATED -> throw SignedOutException(message)
      ERROR_CODE_BAD_USER_INPUT -> throw RejectedException(message)
      else -> throw IOException(message)
    }
  }
}

private fun JSONObject.text(name: String): String? = if (isNull(name)) null else optString(name)

private fun serverCardOf(json: JSONObject): ServerCard {
  fun list(name: String) = json.getJSONArray(name).let { array -> (0 until array.length()).map(array::getJSONObject) }
  val card = Card(
    namePrefix = json.text("namePrefix"),
    firstName = json.text("firstName"),
    middleName = json.text("middleName"),
    lastName = json.text("lastName"),
    nameSuffix = json.text("nameSuffix"),
    nickname = json.text("nickname"),
    organization = json.text("organization"),
    department = json.text("department"),
    jobTitle = json.text("jobTitle"),
    about = json.text("about"),
    contactInfos = list("contactInfos").map {
      CardInfo(it.getString("type"), it.getString("value"), it.text("kind"), it.text("label"), it.getBoolean("isPrimary"))
    },
    addresses = list("addresses").map {
      CardAddress(
        type = it.getString("type"),
        label = it.text("label"),
        line1 = it.getString("line1"),
        line2 = it.text("line2"),
        city = it.text("city"),
        state = it.text("state"),
        postalCode = it.text("postalCode"),
        country = it.text("country"),
        isPrimary = it.getBoolean("isPrimary"),
      )
    },
    dates = list("dates").map { CardDate(it.getString("kind"), it.getString("name"), it.getString("date"), it.getBoolean("hasYear")) },
  )
  return ServerCard(json.getString("personId"), json.getLong("revision"), json.getString("cursor"), card)
}

private fun Any?.orNull(): Any = this ?: JSONObject.NULL

private fun jsonOf(card: Card): JSONObject = JSONObject()
  .put("namePrefix", card.namePrefix.orNull())
  .put("firstName", card.firstName.orNull())
  .put("middleName", card.middleName.orNull())
  .put("lastName", card.lastName.orNull())
  .put("nameSuffix", card.nameSuffix.orNull())
  .put("nickname", card.nickname.orNull())
  .put("organization", card.organization.orNull())
  .put("department", card.department.orNull())
  .put("jobTitle", card.jobTitle.orNull())
  .put("about", card.about.orNull())
  .put(
    "contactInfos",
    JSONArray(
      card.contactInfos.map {
        JSONObject().put("type", it.type).put("value", it.value).put("kind", it.kind.orNull())
          .put("label", it.label.orNull()).put("isPrimary", it.isPrimary)
      },
    ),
  )
  .put(
    "addresses",
    JSONArray(
      card.addresses.map {
        JSONObject().put("type", it.type).put("label", it.label.orNull()).put("line1", it.line1)
          .put("line2", it.line2.orNull()).put("city", it.city.orNull()).put("state", it.state.orNull())
          .put("postalCode", it.postalCode.orNull()).put("country", it.country.orNull()).put("isPrimary", it.isPrimary)
      },
    ),
  )
  .put(
    "dates",
    JSONArray(
      card.dates.map {
        JSONObject().put("kind", it.kind).put("name", it.name).put("date", it.date).put("hasYear", it.hasYear)
      },
    ),
  )
