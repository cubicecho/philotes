package expo.modules.philotescontacts

// A Philotes contact card and the rows Android's contacts database keeps it in, and the mapping both
// ways. Plain Kotlin with no Android types, so it can be unit-tested on a JVM: the MIME types and
// column names are the values of the `ContactsContract` constants named beside them.
//
// The words in `PhilotesWord` are the server's vocabularies (`db/src/models/`). A TypeScript test,
// `app/modules/philotes-contacts/vocabulary.test.ts`, fails when the two drift apart.

/** The words the server uses for types and kinds. */
object PhilotesWord {
  // ContactType
  const val EMAIL = "email"
  const val PHONE = "phone"
  const val FAX = "fax"
  const val IM = "im"
  const val LINKEDIN = "linkedin"
  const val TWITTER = "twitter"
  const val INSTAGRAM = "instagram"
  const val WEBSITE = "website"
  const val OTHER = "other"

  // ContactKind (OTHER is shared)
  const val HOME = "home"
  const val WORK = "work"
  const val MOBILE = "mobile"

  // AddressType: HOME, WORK and OTHER above.

  // ImportantDateKind (OTHER is shared)
  const val BIRTHDAY = "birthday"
  const val ANNIVERSARY = "anniversary"
}

/** A way to reach the person. `type` and `kind` are `PhilotesWord`s. */
data class CardInfo(
  val type: String,
  val value: String,
  val kind: String?,
  val label: String?,
  val isPrimary: Boolean,
)

/** A postal address. `type` is home, work or other. */
data class CardAddress(
  val type: String,
  val label: String?,
  val line1: String,
  val line2: String?,
  val city: String?,
  val state: String?,
  val postalCode: String?,
  val country: String?,
  val isPrimary: Boolean,
)

/** A birthday, an anniversary or a named date. `date` is `YYYY-MM-DD`; the year means nothing when `hasYear` is false. */
data class CardDate(val kind: String, val name: String, val date: String, val hasYear: Boolean)

/** A person as a phone's contact holds them, the shape of the server's `ContactCard`. */
data class Card(
  val namePrefix: String? = null,
  val firstName: String? = null,
  val middleName: String? = null,
  val lastName: String? = null,
  val nameSuffix: String? = null,
  val nickname: String? = null,
  val organization: String? = null,
  val department: String? = null,
  val jobTitle: String? = null,
  val about: String? = null,
  val contactInfos: List<CardInfo> = emptyList(),
  val addresses: List<CardAddress> = emptyList(),
  val dates: List<CardDate> = emptyList(),
)

/** One row of `ContactsContract.Data`: its MIME type and the columns it sets. */
data class DataRow(val mimeType: String, val values: Map<String, Any?>)

/** The `ContactsContract` values the mapping uses. */
object Contract {
  const val NAME = "vnd.android.cursor.item/name" // StructuredName.CONTENT_ITEM_TYPE
  const val NICKNAME = "vnd.android.cursor.item/nickname" // Nickname.CONTENT_ITEM_TYPE
  const val ORGANIZATION = "vnd.android.cursor.item/organization" // Organization.CONTENT_ITEM_TYPE
  const val NOTE = "vnd.android.cursor.item/note" // Note.CONTENT_ITEM_TYPE
  const val PHONE = "vnd.android.cursor.item/phone_v2" // Phone.CONTENT_ITEM_TYPE
  const val EMAIL = "vnd.android.cursor.item/email_v2" // Email.CONTENT_ITEM_TYPE
  const val IM = "vnd.android.cursor.item/im" // Im.CONTENT_ITEM_TYPE
  const val WEBSITE = "vnd.android.cursor.item/website" // Website.CONTENT_ITEM_TYPE
  const val POSTAL = "vnd.android.cursor.item/postal-address_v2" // StructuredPostal.CONTENT_ITEM_TYPE
  const val EVENT = "vnd.android.cursor.item/contact_event" // Event.CONTENT_ITEM_TYPE

  /** Philotes' own row for a detail Android has no kind for: a social profile, or "other". Shown read-only. */
  const val PHILOTES_DETAIL = "vnd.android.cursor.item/vnd.com.cubicecho.philotes.detail"

  /** Philotes' own row that carries the person's id, drawn by the contacts app as "Open in Philotes". */
  const val PHILOTES_PROFILE = "vnd.android.cursor.item/vnd.com.cubicecho.philotes.profile"

  const val DATA1 = "data1"
  const val DATA2 = "data2"
  const val DATA3 = "data3"
  const val DATA4 = "data4"
  const val DATA5 = "data5"
  const val DATA6 = "data6"
  const val DATA7 = "data7"
  const val DATA8 = "data8"
  const val DATA9 = "data9"
  const val DATA10 = "data10"
  const val IS_PRIMARY = "is_primary" // Data.IS_PRIMARY

  /** CommonDataKinds.BaseTypes.TYPE_CUSTOM: the row's LABEL names it. */
  const val TYPE_CUSTOM = 0

  // Phone.TYPE_*
  const val PHONE_HOME = 1
  const val PHONE_MOBILE = 2
  const val PHONE_WORK = 3
  const val PHONE_FAX_WORK = 4
  const val PHONE_FAX_HOME = 5
  const val PHONE_OTHER = 7
  const val PHONE_OTHER_FAX = 13

  // Email.TYPE_*
  const val EMAIL_HOME = 1
  const val EMAIL_WORK = 2
  const val EMAIL_OTHER = 3
  const val EMAIL_MOBILE = 4

  // Im.TYPE_* and Im.PROTOCOL_CUSTOM
  const val IM_HOME = 1
  const val IM_WORK = 2
  const val IM_OTHER = 3
  const val IM_PROTOCOL_CUSTOM = -1

  // Website.TYPE_*
  const val WEBSITE_HOME = 4
  const val WEBSITE_WORK = 5
  const val WEBSITE_OTHER = 7

  // StructuredPostal.TYPE_*
  const val POSTAL_HOME = 1
  const val POSTAL_WORK = 2
  const val POSTAL_OTHER = 3

  // Event.TYPE_*
  const val EVENT_ANNIVERSARY = 1
  const val EVENT_OTHER = 2
  const val EVENT_BIRTHDAY = 3

  /** Nickname.TYPE_DEFAULT and Organization.TYPE_WORK. */
  const val TYPE_DEFAULT = 1
}

/** The MIME types this mapping writes. A sync replaces these and leaves the rest, such as a photo the phone set. */
val MAPPED_MIME_TYPES: Set<String> = setOf(
  Contract.NAME,
  Contract.NICKNAME,
  Contract.ORGANIZATION,
  Contract.NOTE,
  Contract.PHONE,
  Contract.EMAIL,
  Contract.IM,
  Contract.WEBSITE,
  Contract.POSTAL,
  Contract.EVENT,
  Contract.PHILOTES_DETAIL,
  Contract.PHILOTES_PROFILE,
)

/** What a birthday and an anniversary are named, as the server names them (`vcard/card.ts`). */
private const val BIRTHDAY_NAME = "Birthday"
private const val ANNIVERSARY_NAME = "Anniversary"
/** A date the phone gave no name. */
private const val UNNAMED_DATE = "Date"
/** The year a date without one is stored under on the server (`YEARLESS_DATE_YEAR`). */
private const val YEARLESS_YEAR = "1604"
/** How Android writes a date with no year: `--MM-DD`. */
private const val NO_YEAR_PREFIX = "--"

/** What the contacts app shows on the "Open in Philotes" row. */
const val PROFILE_SUMMARY = "Philotes"
const val PROFILE_DETAIL = "Open in Philotes"

// Each kind's Android type, both ways. A null kind is written as "other".
private val PHONE_TYPE_OF_KIND = mapOf(
  PhilotesWord.HOME to Contract.PHONE_HOME,
  PhilotesWord.MOBILE to Contract.PHONE_MOBILE,
  PhilotesWord.WORK to Contract.PHONE_WORK,
  PhilotesWord.OTHER to Contract.PHONE_OTHER,
)
private val FAX_TYPE_OF_KIND = mapOf(
  PhilotesWord.HOME to Contract.PHONE_FAX_HOME,
  PhilotesWord.WORK to Contract.PHONE_FAX_WORK,
  PhilotesWord.OTHER to Contract.PHONE_OTHER_FAX,
)
private val EMAIL_TYPE_OF_KIND = mapOf(
  PhilotesWord.HOME to Contract.EMAIL_HOME,
  PhilotesWord.WORK to Contract.EMAIL_WORK,
  PhilotesWord.MOBILE to Contract.EMAIL_MOBILE,
  PhilotesWord.OTHER to Contract.EMAIL_OTHER,
)
private val IM_TYPE_OF_KIND = mapOf(
  PhilotesWord.HOME to Contract.IM_HOME,
  PhilotesWord.WORK to Contract.IM_WORK,
  PhilotesWord.OTHER to Contract.IM_OTHER,
)
private val WEBSITE_TYPE_OF_KIND = mapOf(
  PhilotesWord.HOME to Contract.WEBSITE_HOME,
  PhilotesWord.WORK to Contract.WEBSITE_WORK,
  PhilotesWord.OTHER to Contract.WEBSITE_OTHER,
)
private val POSTAL_TYPE_OF_ADDRESS = mapOf(
  PhilotesWord.HOME to Contract.POSTAL_HOME,
  PhilotesWord.WORK to Contract.POSTAL_WORK,
  PhilotesWord.OTHER to Contract.POSTAL_OTHER,
)
private val EVENT_TYPE_OF_KIND = mapOf(
  PhilotesWord.BIRTHDAY to Contract.EVENT_BIRTHDAY,
  PhilotesWord.ANNIVERSARY to Contract.EVENT_ANNIVERSARY,
)

/** The contact types that go in Philotes' own detail row, because Android has no kind for them. */
private val PHILOTES_DETAIL_TYPES = setOf(
  PhilotesWord.LINKEDIN,
  PhilotesWord.TWITTER,
  PhilotesWord.INSTAGRAM,
  PhilotesWord.OTHER,
)

private fun <K, V> Map<K, V>.keyOf(value: Any?): K? = entries.firstOrNull { it.value == value }?.key

private fun Any?.asText(): String? = (this as? String)?.takeIf { it.isNotBlank() }

private fun Any?.asInt(): Int? = when (this) {
  is Number -> this.toInt()
  is String -> this.toIntOrNull()
  else -> null
}

private fun Any?.asFlag(): Boolean = asInt()?.let { it != 0 } ?: false

/** A row with nothing set is not written. */
private fun rowOf(mimeType: String, vararg values: Pair<String, Any?>): DataRow? {
  val set = values.filter { it.second != null }.toMap()
  return if (set.isEmpty()) null else DataRow(mimeType, set)
}

/** The row for one contact detail. */
private fun infoRow(info: CardInfo): DataRow {
  val primary = Contract.IS_PRIMARY to (if (info.isPrimary) 1 else 0)
  val kind = info.kind ?: PhilotesWord.OTHER
  fun typed(mimeType: String, types: Map<String, Int>, otherType: Int, vararg extra: Pair<String, Any?>) = DataRow(
    mimeType,
    mapOf(
      Contract.DATA1 to info.value,
      Contract.DATA2 to (types[kind] ?: otherType),
      // Android shows the label only for TYPE_CUSTOM, but keeps it either way, so it comes back.
      Contract.DATA3 to info.label,
      primary,
      *extra,
    ),
  )
  return when (info.type) {
    PhilotesWord.PHONE -> typed(Contract.PHONE, PHONE_TYPE_OF_KIND, Contract.PHONE_OTHER)
    PhilotesWord.FAX -> typed(Contract.PHONE, FAX_TYPE_OF_KIND, Contract.PHONE_OTHER_FAX)
    PhilotesWord.EMAIL -> typed(Contract.EMAIL, EMAIL_TYPE_OF_KIND, Contract.EMAIL_OTHER)
    PhilotesWord.IM -> typed(Contract.IM, IM_TYPE_OF_KIND, Contract.IM_OTHER, Contract.DATA5 to Contract.IM_PROTOCOL_CUSTOM)
    PhilotesWord.WEBSITE -> typed(Contract.WEBSITE, WEBSITE_TYPE_OF_KIND, Contract.WEBSITE_OTHER)
    // Social profiles and "other": data1 the value, data2 the type, data3 the kind, data4 the label.
    else -> DataRow(
      Contract.PHILOTES_DETAIL,
      mapOf(
        Contract.DATA1 to info.value,
        Contract.DATA2 to info.type,
        Contract.DATA3 to info.kind,
        Contract.DATA4 to info.label,
        primary,
      ),
    )
  }
}

/** The row for one date: `YYYY-MM-DD`, or `--MM-DD` without a year, as Android's own contacts app writes it. */
private fun dateRow(date: CardDate): DataRow {
  val monthDay = date.date.substringAfter('-')
  val start = if (date.hasYear) date.date else "$NO_YEAR_PREFIX$monthDay"
  val type = EVENT_TYPE_OF_KIND[date.kind] ?: Contract.TYPE_CUSTOM
  val label = if (type == Contract.TYPE_CUSTOM) date.name else null
  return DataRow(Contract.EVENT, mapOf(Contract.DATA1 to start, Contract.DATA2 to type, Contract.DATA3 to label))
}

/**
 * Writes a card as data rows, with the "Open in Philotes" row for the person.
 *
 * @param card The card.
 * @param personId The person's id, which "Open in Philotes" opens.
 * @return The rows, without the raw contact they belong to.
 */
fun rowsOf(card: Card, personId: String): List<DataRow> {
  val rows = mutableListOf<DataRow?>()
  rows += rowOf(
    Contract.NAME,
    Contract.DATA2 to card.firstName, // GIVEN_NAME
    Contract.DATA3 to card.lastName, // FAMILY_NAME
    Contract.DATA4 to card.namePrefix, // PREFIX
    Contract.DATA5 to card.middleName, // MIDDLE_NAME
    Contract.DATA6 to card.nameSuffix, // SUFFIX
  )
  rows += card.nickname?.let { DataRow(Contract.NICKNAME, mapOf(Contract.DATA1 to it, Contract.DATA2 to Contract.TYPE_DEFAULT)) }
  rows += rowOf(
    Contract.ORGANIZATION,
    Contract.DATA1 to card.organization, // COMPANY
    Contract.DATA4 to card.jobTitle, // TITLE
    Contract.DATA5 to card.department, // DEPARTMENT
  )?.let { it.copy(values = it.values + (Contract.DATA2 to Contract.TYPE_DEFAULT)) }
  rows += card.about?.let { DataRow(Contract.NOTE, mapOf(Contract.DATA1 to it)) }
  rows += card.contactInfos.map(::infoRow)
  rows += card.addresses.map { address ->
    DataRow(
      Contract.POSTAL,
      mapOf(
        Contract.DATA2 to (POSTAL_TYPE_OF_ADDRESS[address.type] ?: Contract.POSTAL_OTHER),
        Contract.DATA3 to address.label,
        // STREET holds both lines. The provider writes FORMATTED_ADDRESS from the parts.
        Contract.DATA4 to listOfNotNull(address.line1, address.line2).joinToString("\n"),
        Contract.DATA7 to address.city, // CITY
        Contract.DATA8 to address.state, // REGION
        Contract.DATA9 to address.postalCode, // POSTCODE
        Contract.DATA10 to address.country, // COUNTRY
        Contract.IS_PRIMARY to (if (address.isPrimary) 1 else 0),
      ),
    )
  }
  rows += card.dates.map(::dateRow)
  rows += DataRow(
    Contract.PHILOTES_PROFILE,
    mapOf(Contract.DATA1 to personId, Contract.DATA2 to PROFILE_SUMMARY, Contract.DATA3 to PROFILE_DETAIL),
  )
  return rows.filterNotNull()
}

/** Reads one typed detail row back. */
private fun infoOf(type: String, row: DataRow, kinds: Map<String, Int>): CardInfo? {
  val value = row.values[Contract.DATA1].asText() ?: return null
  val androidType = row.values[Contract.DATA2].asInt()
  return CardInfo(
    type = type,
    value = value,
    // TYPE_CUSTOM, or a type with no kind of its own, is a detail with only a label.
    kind = kinds.keyOf(androidType),
    label = row.values[Contract.DATA3].asText(),
    isPrimary = row.values[Contract.IS_PRIMARY].asFlag(),
  )
}

/** Reads a phone row, which is a fax when Android types it as one. */
private fun phoneOf(row: DataRow): CardInfo? {
  val isFax = FAX_TYPE_OF_KIND.containsValue(row.values[Contract.DATA2].asInt())
  return if (isFax) infoOf(PhilotesWord.FAX, row, FAX_TYPE_OF_KIND) else infoOf(PhilotesWord.PHONE, row, PHONE_TYPE_OF_KIND)
}

/** Reads Philotes' own detail row back. */
private fun philotesDetailOf(row: DataRow): CardInfo? {
  val value = row.values[Contract.DATA1].asText() ?: return null
  val type = row.values[Contract.DATA2].asText()?.takeIf { it in PHILOTES_DETAIL_TYPES } ?: PhilotesWord.OTHER
  return CardInfo(
    type = type,
    value = value,
    kind = row.values[Contract.DATA3].asText(),
    label = row.values[Contract.DATA4].asText(),
    isPrimary = row.values[Contract.IS_PRIMARY].asFlag(),
  )
}

/** Reads a postal row back. A row with no street takes its formatted address as the first line. */
private fun addressOf(row: DataRow): CardAddress? {
  val street = row.values[Contract.DATA4].asText() ?: row.values[Contract.DATA1].asText() ?: return null
  val lines = street.split("\n", limit = 2).map { it.trim() }
  val line1 = lines[0].takeIf { it.isNotEmpty() } ?: return null
  return CardAddress(
    type = POSTAL_TYPE_OF_ADDRESS.keyOf(row.values[Contract.DATA2].asInt()) ?: PhilotesWord.OTHER,
    label = row.values[Contract.DATA3].asText(),
    line1 = line1,
    line2 = lines.getOrNull(1)?.takeIf { it.isNotEmpty() },
    city = row.values[Contract.DATA7].asText(),
    state = row.values[Contract.DATA8].asText(),
    postalCode = row.values[Contract.DATA9].asText(),
    country = row.values[Contract.DATA10].asText(),
    isPrimary = row.values[Contract.IS_PRIMARY].asFlag(),
  )
}

private val FULL_DATE = Regex("""^(\d{4})-(\d{2})-(\d{2})""")
private val COMPACT_DATE = Regex("""^(\d{4})(\d{2})(\d{2})$""")
private val NO_YEAR_DATE = Regex("""^--(\d{2})-?(\d{2})$""")

/**
 * Reads the date of an event row, in the forms Android's contacts apps write.
 *
 * @return The date as `YYYY-MM-DD` and whether it has a year, or null for a form not known here.
 */
fun parseEventDate(start: String): Pair<String, Boolean>? {
  NO_YEAR_DATE.find(start)?.let { return "$YEARLESS_YEAR-${it.groupValues[1]}-${it.groupValues[2]}" to false }
  val full = FULL_DATE.find(start) ?: COMPACT_DATE.find(start) ?: return null
  val (year, month, day) = full.destructured
  // Apple's stand-in for "no year" arrives through other apps too.
  val hasYear = year != YEARLESS_YEAR
  return "$year-$month-$day" to hasYear
}

/** Reads an event row back. */
private fun dateOf(row: DataRow): CardDate? {
  val (date, hasYear) = row.values[Contract.DATA1].asText()?.let(::parseEventDate) ?: return null
  val type = row.values[Contract.DATA2].asInt()
  val kind = EVENT_TYPE_OF_KIND.keyOf(type) ?: PhilotesWord.OTHER
  val name = when (kind) {
    PhilotesWord.BIRTHDAY -> BIRTHDAY_NAME
    PhilotesWord.ANNIVERSARY -> ANNIVERSARY_NAME
    else -> row.values[Contract.DATA3].asText() ?: UNNAMED_DATE
  }
  return CardDate(kind = kind, name = name, date = date, hasYear = hasYear)
}

/**
 * Reads a raw contact's data rows back into a card. Rows of a type the mapping does not know, such as a
 * photo or a group, are passed over.
 *
 * @param rows The raw contact's rows.
 * @return The card.
 */
fun cardOf(rows: List<DataRow>): Card {
  fun first(mimeType: String) = rows.firstOrNull { it.mimeType == mimeType }?.values ?: emptyMap()
  val name = first(Contract.NAME)
  val organization = first(Contract.ORGANIZATION)
  val infos = rows.mapNotNull { row ->
    when (row.mimeType) {
      Contract.PHONE -> phoneOf(row)
      Contract.EMAIL -> infoOf(PhilotesWord.EMAIL, row, EMAIL_TYPE_OF_KIND)
      Contract.IM -> infoOf(PhilotesWord.IM, row, IM_TYPE_OF_KIND)
      Contract.WEBSITE -> infoOf(PhilotesWord.WEBSITE, row, WEBSITE_TYPE_OF_KIND)
      Contract.PHILOTES_DETAIL -> philotesDetailOf(row)
      else -> null
    }
  }
  return Card(
    namePrefix = name[Contract.DATA4].asText(),
    firstName = name[Contract.DATA2].asText(),
    middleName = name[Contract.DATA5].asText(),
    lastName = name[Contract.DATA3].asText(),
    nameSuffix = name[Contract.DATA6].asText(),
    nickname = first(Contract.NICKNAME)[Contract.DATA1].asText(),
    organization = organization[Contract.DATA1].asText(),
    department = organization[Contract.DATA5].asText(),
    jobTitle = organization[Contract.DATA4].asText(),
    about = first(Contract.NOTE)[Contract.DATA1].asText(),
    contactInfos = infos,
    addresses = rows.filter { it.mimeType == Contract.POSTAL }.mapNotNull(::addressOf),
    dates = rows.filter { it.mimeType == Contract.EVENT }.mapNotNull(::dateOf),
  )
}

/** The person id an "Open in Philotes" row carries. */
fun personIdOf(rows: List<DataRow>): String? =
  rows.firstOrNull { it.mimeType == Contract.PHILOTES_PROFILE }?.values?.get(Contract.DATA1).asText()
