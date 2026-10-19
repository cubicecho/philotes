package expo.modules.philotescontacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The mapping between a card and Android's data rows, on the JVM. Run with the app's Gradle build:
// `./gradlew :philotes-contacts:testDebugUnitTest` from a prebuilt `android/` directory.

class ContactRowsTest {
  private val ada = Card(
    namePrefix = "Lady",
    firstName = "Ada",
    lastName = "Lovelace",
    nickname = "Enchantress of Numbers",
    organization = "Analytical Engines",
    jobTitle = "Programmer",
    about = "Wrote the first program.",
    contactInfos = listOf(
      CardInfo(PhilotesWord.PHONE, "+44 20 7946 0000", PhilotesWord.MOBILE, null, isPrimary = true),
      CardInfo(PhilotesWord.FAX, "+44 20 7946 0001", PhilotesWord.WORK, null, isPrimary = false),
      CardInfo(PhilotesWord.EMAIL, "ada@example.com", PhilotesWord.HOME, "Personal", isPrimary = false),
      CardInfo(PhilotesWord.WEBSITE, "https://example.com", PhilotesWord.WORK, null, isPrimary = false),
      CardInfo(PhilotesWord.LINKEDIN, "ada-lovelace", null, null, isPrimary = false),
    ),
    addresses = listOf(
      CardAddress(PhilotesWord.HOME, null, "12 St James's Square", "Flat 1", "London", null, "SW1Y 4JH", "GB", isPrimary = true),
    ),
    dates = listOf(
      CardDate(PhilotesWord.BIRTHDAY, "Birthday", "1815-12-10", hasYear = true),
      CardDate(PhilotesWord.OTHER, "Name day", "1604-07-26", hasYear = false),
    ),
  )

  @Test
  fun `a card comes back from its rows as it went in`() {
    assertEquals(ada, cardOf(rowsOf(ada, "person-1")))
  }

  @Test
  fun `the rows carry the person's id for Open in Philotes`() {
    val rows = rowsOf(ada, "person-1")

    assertEquals("person-1", personIdOf(rows))
    assertEquals(1, rows.count { it.mimeType == Contract.PHILOTES_PROFILE })
  }

  @Test
  fun `a fax is a phone row of a fax type`() {
    val fax = rowsOf(ada, "p").single { it.values[Contract.DATA1] == "+44 20 7946 0001" }

    assertEquals(Contract.PHONE, fax.mimeType)
    assertEquals(Contract.PHONE_FAX_WORK, fax.values[Contract.DATA2])
  }

  @Test
  fun `a date without a year is written the way Android writes one`() {
    val nameDay = rowsOf(ada, "p").single { it.mimeType == Contract.EVENT && it.values[Contract.DATA3] == "Name day" }

    assertEquals("--07-26", nameDay.values[Contract.DATA1])
  }

  @Test
  fun `dates are read in the forms the contacts apps write`() {
    assertEquals("1815-12-10" to true, parseEventDate("1815-12-10"))
    assertEquals("1815-12-10" to true, parseEventDate("18151210"))
    assertEquals("1604-12-10" to false, parseEventDate("--12-10"))
    assertEquals("1604-12-10" to false, parseEventDate("--1210"))
    assertNull(parseEventDate("next Tuesday"))
  }

  @Test
  fun `rows the phone wrote as text read back as numbers, and empty fields as nothing`() {
    val rows = listOf(
      DataRow(Contract.NAME, mapOf(Contract.DATA2 to "Grace", Contract.DATA3 to "")),
      DataRow(Contract.PHONE, mapOf(Contract.DATA1 to "555 0100", Contract.DATA2 to "2", Contract.IS_PRIMARY to "1")),
      DataRow("vnd.android.cursor.item/photo", mapOf(Contract.DATA1 to "ignored")),
    )

    val card = cardOf(rows)

    assertEquals("Grace", card.firstName)
    assertNull(card.lastName)
    assertEquals(listOf(CardInfo(PhilotesWord.PHONE, "555 0100", PhilotesWord.MOBILE, null, isPrimary = true)), card.contactInfos)
  }

  @Test
  fun `a detail with a custom type keeps its label and has no kind`() {
    val rows = listOf(DataRow(Contract.EMAIL, mapOf(Contract.DATA1 to "boat@example.com", Contract.DATA2 to Contract.TYPE_CUSTOM, Contract.DATA3 to "Boat")))

    assertEquals(listOf(CardInfo(PhilotesWord.EMAIL, "boat@example.com", null, "Boat", isPrimary = false)), cardOf(rows).contactInfos)
  }
}
