# Android

The app is one Expo project with two targets: the web export the server ships,
and an Android app. Today the Android app exists only as an **EAS development
build**: an APK holding the native code and Expo's dev client, which loads the
JavaScript from a Metro server on your machine. There is no store release and
no standalone build yet.

## Configuration

| File | Holds |
| --- | --- |
| `app/app.json` | `android.package` (`com.cubicecho.philotes`), the icons, the splash screen, and the EAS project (`owner`, `extra.eas.projectId`) |
| `app/eas.json` | The build profiles. Only `development` exists |
| `app/assets/` | `icon.png`, the adaptive icon's foreground and monochrome layers, the splash image for light and dark, and the web favicon |

The images in `app/assets/` are placeholders drawn from `site/src/assets/favicon.svg`.

The EAS project is `@cubicecho/philotes` on expo.dev.

## Building and running

```bash
npm run android:build   # Queue a development build on EAS; it prints a link to the APK
npm run android         # Start Metro for the installed development build (port 8081)
npm run build:android   # Export the Android JavaScript bundle → app/dist-android/
```

1. `npm run android:build` uploads the repo and builds in EAS's cloud, so it
   uses the account's build quota and needs `eas login`. Install the APK it
   links to on a device or emulator. A new build is needed only when native
   code changes: a new Expo module, or a change to `app.json`.
2. `npm run android` starts Metro. Open the app on the device and pick the
   server (same network), or scan the QR code.
3. The app asks for the server's address on its sign-in screen; see
   [Signing in on a device](#signing-in-on-a-device).

`npm run build:android` involves no Android SDK. It is what CI runs (the
`android` job), and it fails on anything Metro cannot resolve for a device,
such as a module that exists only in its `.web` form.

## Signing in on a device

A device is not served by the server, so it has to be told where the server
is. The sign-in screen opens on **Connect to your server** until an address is
stored, and every sign-in form has a **Change server** button that leads back
to it. The web app shows neither.

- The address is typed as it is opened in a browser. `normalizeServerUrl`
  (`app/src/lib/api-url.ts`) adds `https://` when no scheme is typed and drops
  a trailing slash. `EXPO_PUBLIC_API_URL`, read when Metro bundles, only
  pre-fills the field.
- Nothing reads the address at import. `apiUrl()` is read at each request, so
  the Apollo client and the avatar requests follow a change at once.
  `app/src/lib/server-address.ts` stores it and restores it at start.
- The address and the session token are kept by `app/src/lib/device-store.ts`:
  the system's encrypted store (`expo-secure-store`) on a device,
  `localStorage` in its `.web.ts` half. Changing the server clears the token
  and the Apollo cache, since both belong to the server they came from.
- A session that has expired sends the app back to the sign-in screen through
  the router; the browser does it with a full page load.
- A development build may talk to a plain `http://` server, which is what a
  server on the home network usually is. Android refuses cleartext traffic in
  a release build unless the app opts in, which is for the day there is one.
- A sign-in link sent by email opens the server's web app, not this one, and so
  would an OIDC provider's callback, which is why the device build does not show
  the provider's button. On a device, sign in with a password, or with an email
  alone on a `SECURE_LOCAL_NET` server.

## Reading offline

The app opens without a connection and shows what it last had: the people
list in full, and any page opened before. Changes need the server. How it
works is in [`frontend.md`](./frontend.md#reading-offline). The copy is kept by
`expo-sqlite`, a native module, so a development build made before it was
added has to be rebuilt.

A session that ends takes the copy with it, since the copy belongs to whoever
was signed in. With the default `SESSION_STORE=memory` every restart of the
server ends every session, so a server a phone relies on wants
`SESSION_STORE=database`.

## Photos

- **Showing.** Avatars sit behind the session. A device's image loader sends
  the bearer token as a header (`use-avatar-image.ts`); a browser's `<img>`
  cannot, so the web half fetches the photo and shows it from an object URL
  (`use-avatar-image.web.ts`).
- **Uploading.** `AvatarPickerButton` (`domain/person/`) opens the system
  photo picker through `expo-image-picker` on a device and the file dialog on
  the web. Both hand `useAvatarUpload` a `PickedPhoto`, whose `part` is the
  form part that platform uploads: a `Blob` in a browser, a `{ uri, name,
  type }` on a device. Only the photo library is used, so `app.json` blocks
  the camera and microphone permissions the module would otherwise declare.

## The phone layout

- **Safe area.** The root layout (`app/app/_layout.tsx`) wraps every route in
  `react-native-safe-area-context`'s `SafeAreaView`, so nothing is drawn under
  the status bar or the navigation bar. cubeui's shells measure no insets
  themselves; that is left to the app.
- **Navigation.** Under `md` the app shell (`components/layouts/app-shell.tsx`)
  swaps the rail for cubeui's bars: the brand, Add person and Sign out across
  the top, and the same places as the rail along the bottom
  (`barPosition="bottom"`). The root layout's `SafeAreaView` keeps the bottom
  bar above the navigation bar.
- **The people list** is a virtualised `SectionList` in a `PageLayout` whose
  body does not scroll, so a few thousand people cost what a screenful does.
  Pulling it down loads the list again.
- **Importing a file.** `ImportFileButton` (`components/settings/`) opens the
  system's file picker through `expo-document-picker` and reads the file with
  `expo-file-system`. Android names a `.vcf` or a `.csv` by several MIME
  types, so the picker offers every file and the name is checked afterwards.
  The web half is cubeui's `FilePickerButton`, whose native half is a stub by
  design.

## The phone's own contacts

Settings → API Keys → **Sync to the phone's contacts** adds a Philotes account
to the phone (Settings → Accounts), and a sync adapter writes the user's people
under it as raw contacts, so the dialer, caller ID and messaging see them.
Edits made in the phone's contacts app come back. It does what DAVx⁵ does over
CardDAV ([`carddav.md`](carddav.md)), which stays supported; a phone should use
one or the other.

The code is a local Expo module, `app/modules/philotes-contacts/`:

| File | Holds |
| --- | --- |
| `index.ts` | The JavaScript API: add, update or remove the account, ask for a sync. `app/src/lib/phone-contacts.ts` is what the app calls; its `.web.ts` half does nothing |
| `app.plugin.js` | The config plugin `app.json` lists. It adds the permissions (contacts, accounts, sync settings), the authenticator and sync services, the "Open in Philotes" activity, and copies `plugin/xml/` into the app's `res/xml` |
| `plugin/xml/` | `philotes_authenticator.xml`, `philotes_syncadapter.xml`, and `philotes_contacts.xml`: the edit schema and Philotes' own rows |
| `android/…/ContactRows.kt` | The mapping between a card and Android's data rows, both ways. Plain Kotlin, no Android types |
| `android/…/ContactsSync.kt` | One sync: phone deletes and edits up, then the server's changes down |
| `android/…/PhilotesApi.kt` | The GraphQL calls, over `HttpURLConnection` and `org.json` |
| `android/…/ContactsStore.kt` | The account's raw contacts, read and written as the sync adapter |
| `android/…/PhilotesAccount.kt` | The account: its server, token and last revision |
| `android/…/*Service.kt`, `OpenInPhilotesActivity.kt`, `PhilotesContactsModule.kt` | What Android and the JavaScript side bind to |

**What it talks to.** The GraphQL API with the app's own session token as a
bearer token, not CardDAV with an API key. It reads changes the way the
people list does ([`frontend.md`](frontend.md#reading-offline)): `me {
personsRevision }`, then everyone changed after the revision the phone has, then
`personTombstones` after it. The cards come from `contactCards`, and a phone
edit goes up through `saveContactCard` (see
[`server.md`](server.md#vcard)), so the adapter reads JSON, which Android parses
without a library, rather than vCard and DAV XML, and it knows each person's id.

- A raw contact's `SOURCE_ID` is the person's id and `SYNC1` the revision the
  phone last had. The account keeps the user's revision the contacts are
  complete up to. A server whose revision went backwards (a restored backup)
  gets a full read.
- **Conflicts: the server wins.** An edit or a delete from the phone is sent
  with the revision the phone last had. When the person changed on the server
  since, nothing is written and the server's version replaces the phone's; an
  edit to someone deleted on the server is dropped. A contact the server
  refuses (a contact with no name, say) stays marked dirty and is tried again
  on the next sync.
- A save from the phone keeps the person's labels, picture and the vCard lines
  Philotes has no field for, none of which the phone holds. A photo set on the
  phone stays on the phone and is not sent.
- Social profiles and "other" details have no Android kind. They are Philotes'
  own row type, shown read-only on the contact.
- **Open in Philotes.** Every contact carries a row that the contacts app and
  the dialer draw as "Open in Philotes". It opens `OpenInPhilotesActivity`,
  which reads the person's id off the row and opens `philotes://persons/<id>`,
  which Expo Router serves as `/persons/[id]`.
- **When it syncs.** Every four hours on Android's own schedule, when a contact
  is changed on the phone, when the setting is turned on, and each time the app
  goes to the background, so a change made in the app reaches the contacts
  soon after.
- **The session.** The account holds the token the app signed in with, which
  syncing keeps alive. Signing out, or changing the server, removes the account,
  and Android removes its contacts with it. A session that ends some other way
  (it expired, or `SESSION_STORE=memory` restarted) leaves the account failing
  to sign in until the user signs in again, when the app hands it the new
  token. Someone else signing in on the phone removes it.
- The contacts permissions are asked for when the setting is turned on. A
  development build made before the module was added does not have it, and the
  setting is not shown.

**Tests.** The pure mapping has JVM tests in `android/src/test/`
(`./gradlew :philotes-contacts:testDebugUnitTest` from a prebuilt `android/`).
`app/modules/philotes-contacts/__tests__/` holds the plugin's manifest changes,
and keeps the Kotlin's vocabulary words, account type and row MIME type in step
with the server's and the XML's by reading the source.
## Logging calls and texts

Settings → App Settings → **Log Calls and Texts** turns on reading the call
log and the texts, each on its own. Both are off until the user turns them
on, and turning one on asks Android for its permission (`READ_CALL_LOG` or
`READ_SMS`). The card says what is read: the other number, the time, which
way it went and how long a call lasted. A text's body is never read.

- **The native module** is `app/modules/phone-log`, a local Expo module that
  autolinking finds by its folder. `PhoneLogModule.kt` reads `CallLog.Calls`
  and `Telephony.Sms` through the `ContentResolver`, with projections that
  name only `_ID`, the number, the date, the type and (for calls) the
  duration. `index.ts` is its typed wrapper; the module is optional, so a
  browser, or a build made before it was added, sees `isPhoneLogAvailable()`
  false and shows no card.
- **What becomes an interaction** is decided in `app/src/lib/phone-log.ts`,
  a plain module with tests: incoming, outgoing and missed calls (declined and
  voicemail count as missed), received and sent texts. Blocked calls, withheld
  numbers, drafts and unsent texts are left out. An event's `externalId` is
  its row's `_ID` and time, since Android reuses an `_ID` once the log is
  cleared.
- **The scan** (`phone-scan.ts`) reads each source that is on from its
  cursor, a page at a time (`PHONE_LOG_DEFAULTS`), and sends each page
  through `logInteractions`. The server matches numbers to people and drops
  the rest; see [`server.md`](./server.md#logged-interactions). Each source's
  cursor is the time it has read up to, kept in the device store and moved
  after each page the server took. The first scan of a source reads
  `firstScanDays` back.
- **When it runs:** whenever the signed-in app opens or comes back to the
  front (`usePhoneLogScan`), and from a periodic background task
  (`phone-scan-task.ts`, `expo-background-task` on Android's WorkManager).
  The task is registered while any source is on, asks for every
  `backgroundIntervalMinutes`, and Android decides when it actually runs (no
  more often than every 15 minutes). The two never read at once.
- Re-reading is harmless. Every page starts at the last row of the one before,
  a source turned off and on carries on from its cursor, and the server
  ignores an event it already has.

### Google Play and these permissions

`READ_CALL_LOG` and `READ_SMS` are in Google Play's
[restricted permission groups](https://support.google.com/googleplay/android-developer/answer/10208820):
an app on Play may hold them only when it is the user's default phone or SMS
handler, or falls under one of a short list of exceptions, and it must
declare why in the Play Console. A contacts or CRM app is not on that list.
A development or sideloaded build, which is how Philotes ships today, is not
reviewed and may use them freely. **A store release would have to drop the
call and text logging, or become the default dialer or SMS app.** The
permissions are declared in `app.json` (`android.permissions`) and nowhere
else, so a store build can remove them there.
## Standing in for the contacts app

Android has no "default contacts app" role. Other apps reach a contacts app
through intents, so Philotes declares the intent filters a contacts app has
(`android.intentFilters` in `app/app.json`) and appears in the system's
chooser beside the built-in app. The phone's people are still the ones DAVx5
syncs from the CardDAV address book ([`carddav.md`](./carddav.md)).

### How DAVx5 marks a contact (the spike)

DAVx5 keeps each CardDAV address book as an Android account of type
`at.bitfire.davdroid.address_book` (`account_type_address_book` in DAVx5's
`core/src/main/res/values/strings.xml`). Each card is one raw contact of that
account, and DAVx5's sync library writes its sync columns
(`synctools/…/storage/contacts/AddressContract.kt`, `RawContactColumns`):

| Column | Holds |
| --- | --- |
| `RawContacts.SOURCE_ID` | The card's file name on the server: for Philotes `<uid>.vcf`, URL-encoded |
| `RawContacts.SYNC1` | The vCard `UID` |
| `RawContacts.SYNC2` | The card's ETag |
| `RawContacts.SYNC3` | A hash of the contact's data (a workaround for Android 7) |
| `RawContacts.SYNC4` | DAVx5's own flags for local changes |

The older `vcard4android` library, which `synctools` replaced, used the same
`SOURCE_ID` / `SYNC1` / `SYNC2` mapping, so contacts synced by older DAVx5
versions read the same way. Philotes names a card after the person's `uid` and
puts the same value in its `UID`, so `SYNC1` is the person's `uid`, and
`SOURCE_ID` without `.vcf` is a fallback for it.

**expo-contacts cannot read any of this.** It works on aggregate contacts by
`ContactsContract.Contacts._ID` and offers no raw contacts on Android, no sync
columns, no account type, and no way to resolve a `content://` lookup URI. It
also cannot read the intent that opened the app. React Native's `Linking` gives
the router only the data URI of a `VIEW` intent, never the action of an edit,
insert or pick, and never the extras. So the phase needed a small Expo module.

### What is built

- **`app/modules/contact-intents`**, a local Expo module (Kotlin, Android
  only, autolinked from `modules/`; native name `ContactIntents`). It is
  separate from `philotes-contacts`, the phone contacts account above. It hands JavaScript the launch intent
  once (`takeLaunchIntent`), sends later ones as an `onContactIntent` event,
  asks for `READ_CONTACTS` (declared in the module's manifest), reads `SYNC1`
  and `SOURCE_ID` of the raw contact behind a contact URI (`findRawContact`),
  and answers a pick (`finishPick`). The JavaScript side
  (`app/src/lib/contacts-native.ts`) takes it with
  `requireOptionalNativeModule`, so the web and a development build made
  before the module was added go on without it.
- **What an intent means** is decided in `app/src/lib/contact-intent.ts`,
  which is pure and tested:

  | Intent | Lands on |
  | --- | --- |
  | `VIEW` a contact ("Open contact") | `/contacts/open?uri=…`, then the person's page |
  | `EDIT` a contact | the same, then the person's page with their edit form open (`?edit=1`) |
  | `INSERT`, `INSERT_OR_EDIT` ("Add to contacts", "Create contact") | `/persons?new=1&…`: the new person form, filled from the `ContactsContract.Intents.Insert` extras (name, phone, email, company, job title, notes) |
  | `PICK` a contact | `/contacts/pick`: choose a person, and the app that asked gets their phone contact |

- A `VIEW` arrives through `Linking`, and `app/app/+native-intent.tsx`
  rewrites its `content://com.android.contacts/…` URI to `/contacts/open`.
  The rest come from the module, read by `useContactIntents` in the signed-in
  layout.
- `/contacts/open` asks for the contacts permission, reads the raw contact's
  UID, looks the person up by `uid`, and replaces itself with their page. A
  contact that is not in the Philotes address book, or not synced yet, says so.
- `INSERT_OR_EDIT` asks to add a number to someone, new or existing. Philotes
  always starts a new person; adding the number to an existing one is done on
  their page.
- The VIEW filter names the `content` scheme as well as the MIME types. The
  development client's config plugin adds its `exp+philotes` scheme to every
  plain VIEW filter, and a filter with only that scheme would no longer match a
  `content://` URI.

### Not verified, and known risks

- **The module is uncompiled.** No Android SDK was at hand when it was
  written, so it has not been built, and nothing here has run on a device. The
  next EAS development build is its first compile.
- **Pick may be cancelled at once.** The main activity is `singleTask`, and
  Android has cancelled `startActivityForResult` into a `singleTask` activity
  in other apps' tasks. If a pick comes back empty, the fix is a small
  activity of its own for `PICK`, which needs a config plugin.
- **Signed out, the intent is dropped.** The signed-in layout redirects to
  `/login` and the intent is not kept for after.
- **The development client** opens its launcher on a cold start that is not
  one of its own links; an intent may land only once a bundle is loaded.
- The account type is DAVx5's from F-Droid and Google Play. A rebranded build,
  such as Managed DAVx5, may use another; add it to `PHILOTES_ACCOUNT_TYPES`.

## Keeping Expo packages in step

Every `expo-*` package, and the React Native libraries Expo pins, have one
version that belongs to the installed SDK. Add them with `npx expo install
<package>` from `app/`, never `npm install`, which takes the newest and can
land a package from the next SDK. `npx expo install --check` reports any that
drifted, and CI fails on it; `npx expo install --fix` puts them back.

## Not done yet

- Nothing in this document has run on a device yet. It is checked by the
  bundle building and by the web app, which shares everything but the
  platform halves named above.
- Reading offline has been run in a browser with the server stopped, and as
  unit tests. The copy kept by `expo-sqlite`, and a start in airplane mode,
  have not been tried on a device. Photos are not kept: a picture the image
  cache does not hold shows as initials.
- The exports in Settings (`DownloadButton`) have not been tried on a device.
- The phone contacts account has never been built or run. Its mapping
  (`ContactRows.kt`) has been compiled and its JVM tests run outside Gradle,
  and the rest of the Kotlin compiled against the Android framework classes,
  but not the Expo module class, and nothing has been built by Gradle or tried
  in a contacts app. Whether the stock and Google contacts apps offer editing
  for the account (`EditSchema` in `philotes_contacts.xml`), and draw "Open in
  Philotes" in the dialer, needs a device.
- Logging calls and texts has not been compiled or run: the Kotlin module was
  written without an Android SDK. It needs a new development build, then a
  call and a text on the device, and a second scan that logs nothing new.
  MMS (group texts and pictures) is not read.
- A build that carries its own JavaScript (EAS `preview` or `production`)
  needs `npm run codegen` to run on the builder first, since the generated
  GraphQL types are not in the repository. No such profile exists yet.

## `npx expo-doctor`

Run it from `app/` after changing dependencies. One finding is known and left:

- **Metro config.** `metro.config.js` sets `resolver.nodeModulesPaths` itself,
  because of the workspace layout. The bundle builds for both targets with it.

A native build holds one copy of each native module, so the root
`package.json` pins `react-native-screens` and `react-native-svg` in
`overrides` to the versions the SDK expects (SDK 57 kept the ones SDK 56 had).
Without them `expo-router` and `lucide-react-native` each bring a second, newer
copy. Move the pins when the SDK moves.

An SDK upgrade can leave the previous React Native hoisted at the root of
`package-lock.json` beside the new one under `app/`, which the doctor reports
as duplicate dependencies. `npm dedupe` does not clear it. Remove the
`react-native`, `react-native-reanimated`, `react-native-worklets` and
`@react-native/*` entries from the lockfile and run `npm install`, which
resolves them again as one copy.
