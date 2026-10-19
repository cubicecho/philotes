// The config plugin for the Philotes contacts account. `app.json` lists it, and `expo prebuild` (which EAS
// runs) applies it: the permissions, the authenticator and sync services, the activity behind "Open in
// Philotes", and the three XML files they point at, copied into the app's resources so that they can name
// the app's own icon and label. CommonJS, because Expo loads plugins with `require`.

const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const PACKAGE = 'expo.modules.philotescontacts';

const PERMISSIONS = [
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.GET_ACCOUNTS',
  'android.permission.READ_SYNC_SETTINGS',
  'android.permission.WRITE_SYNC_SETTINGS',
];

/** The XML resources, by file name, in `plugin/xml/`. */
const XML_FILES = ['philotes_authenticator.xml', 'philotes_syncadapter.xml', 'philotes_contacts.xml'];

/** The MIME type of the "Open in Philotes" row. Matches `Contract.PHILOTES_PROFILE` in ContactRows.kt. */
const PROFILE_MIME_TYPE = 'vnd.android.cursor.item/vnd.com.cubicecho.philotes.profile';

const named = (name, extra = {}) => ({ $: { 'android:name': name, ...extra } });

/** The components the plugin adds to `<application>`, as xml2js objects. */
const SERVICES = [
  {
    $: { 'android:name': `${PACKAGE}.AuthenticatorService`, 'android:exported': 'true' },
    'intent-filter': [{ action: [named('android.accounts.AccountAuthenticator')] }],
    'meta-data': [
      named('android.accounts.AccountAuthenticator', { 'android:resource': '@xml/philotes_authenticator' }),
    ],
  },
  {
    $: { 'android:name': `${PACKAGE}.SyncService`, 'android:exported': 'true' },
    'intent-filter': [{ action: [named('android.content.SyncAdapter')] }],
    'meta-data': [
      named('android.content.SyncAdapter', { 'android:resource': '@xml/philotes_syncadapter' }),
      named('android.provider.CONTACTS_STRUCTURE', { 'android:resource': '@xml/philotes_contacts' }),
    ],
  },
];

const ACTIVITIES = [
  {
    $: {
      'android:name': `${PACKAGE}.OpenInPhilotesActivity`,
      'android:exported': 'true',
      'android:excludeFromRecents': 'true',
      'android:noHistory': 'true',
      'android:theme': '@android:style/Theme.NoDisplay',
    },
    'intent-filter': [
      {
        action: [named('android.intent.action.VIEW')],
        category: [named('android.intent.category.DEFAULT')],
        data: [{ $: { 'android:mimeType': PROFILE_MIME_TYPE } }],
      },
    ],
  },
];

/**
 * Puts components into a list, replacing any of the same name, so applying the plugin twice changes nothing.
 *
 * @param list - The `<application>`'s components of one kind, or undefined when it has none.
 * @param components - The components to add.
 * @returns The list.
 */
function upsert(list, components) {
  const names = new Set(components.map((component) => component.$['android:name']));
  const others = (list ?? []).filter((component) => names.has(component.$?.['android:name']) === false);
  return [...others, ...components];
}

/**
 * Adds the account's permissions and components to a manifest.
 *
 * @param manifest - The manifest, as `withAndroidManifest` hands it over.
 * @returns The same manifest, changed.
 */
function addSyncAccount(manifest) {
  AndroidConfig.Permissions.ensurePermissions(manifest, PERMISSIONS);
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.service = upsert(application.service, SERVICES);
  application.activity = upsert(application.activity, ACTIVITIES);
  return manifest;
}

/**
 * Copies the XML resources into the app's `res/xml`.
 *
 * @param projectRoot - The Android project's directory.
 */
function copyXmlResources(projectRoot) {
  const target = path.join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(target, { recursive: true });
  for (const file of XML_FILES) {
    fs.copyFileSync(path.join(__dirname, 'plugin', 'xml', file), path.join(target, file));
  }
}

/**
 * The plugin.
 *
 * @param config - The Expo config.
 * @returns The config, with the manifest and resource mods queued.
 */
function withPhilotesContacts(config) {
  const withManifest = withAndroidManifest(config, (modded) => {
    addSyncAccount(modded.modResults);
    return modded;
  });
  return withDangerousMod(withManifest, [
    'android',
    (modded) => {
      copyXmlResources(modded.modRequest.platformProjectRoot);
      return modded;
    },
  ]);
}

module.exports = withPhilotesContacts;
module.exports.addSyncAccount = addSyncAccount;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.PROFILE_MIME_TYPE = PROFILE_MIME_TYPE;
