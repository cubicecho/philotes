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
- A sign-in link sent by email opens the server's web app, not this one. On a
  device, sign in with a password, or with an email alone on a
  `SECURE_LOCAL_NET` server.

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
- The file picker (imports in Settings) and the phone layout still assume a
  browser.
- A build that carries its own JavaScript (EAS `preview` or `production`)
  needs `npm run codegen` to run on the builder first, since the generated
  GraphQL types are not in the repository. No such profile exists yet.

## `npx expo-doctor`

Run it from `app/` after changing dependencies. Two findings are known and left:

- **Metro config.** `metro.config.js` sets `resolver.nodeModulesPaths` itself,
  because of the workspace layout. The bundle builds for both targets with it.
- **Hermes memory regression.** Expo SDK 56 ships a Hermes with a known memory
  regression that SDK 57 fixes. It is tolerable in a development build and goes
  away with the SDK upgrade.

A native build holds one copy of each native module, so the root
`package.json` pins `react-native-screens` and `react-native-svg` in
`overrides` to the versions SDK 56 expects. Without them `expo-router` and
`lucide-react-native` each bring a second, newer copy. Move the pins when the
SDK moves.
