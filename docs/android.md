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
  swaps the rail for cubeui's bar across the top, with the same places.
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
- The bar on a phone is at the top. A bar along the bottom needs cubeui to
  offer one.
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
