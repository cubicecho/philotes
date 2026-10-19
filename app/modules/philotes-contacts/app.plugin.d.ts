import type { ConfigPlugin } from 'expo/config-plugins';

// The types of `app.plugin.js`, which stays CommonJS because Expo loads plugins with `require`.

declare const withPhilotesContacts: ConfigPlugin;
export default withPhilotesContacts;

/** Adds the account's permissions and components to a manifest, and returns it. */
export declare function addSyncAccount<T>(manifest: T): T;

/** The permissions the plugin asks for. */
export declare const PERMISSIONS: string[];

/** The MIME type of the "Open in Philotes" row. */
export declare const PROFILE_MIME_TYPE: string;
