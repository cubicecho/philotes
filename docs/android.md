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
- Logging calls and texts has not been compiled or run: the Kotlin module was
  written without an Android SDK. It needs a new development build, then a
  call and a text on the device, and a second scan that logs nothing new.
  MMS (group texts and pictures) is not read.
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
