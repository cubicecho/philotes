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

- **`app/modules/philotes-contacts`**, a local Expo module (Kotlin, Android
  only, autolinked from `modules/`). It hands JavaScript the launch intent
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
