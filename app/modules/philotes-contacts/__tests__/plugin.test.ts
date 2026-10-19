import { describe, expect, it } from 'vitest';
import { addSyncAccount, PERMISSIONS } from '../app.plugin.js';

/** One component of `<application>`, as xml2js reads it. */
interface Component {
  $: Record<string, string>;
  'intent-filter'?: unknown[];
  'meta-data'?: Array<{ $: Record<string, string> }>;
}

/** The parts of a manifest the plugin touches. */
interface Manifest {
  manifest: {
    $: Record<string, string>;
    'uses-permission'?: Array<{ $: Record<string, string> }>;
    application: Array<{ $: Record<string, string>; activity?: Component[]; service?: Component[] }>;
  };
}

/**
 * Builds the manifest prebuild starts from: the main application and its activity.
 *
 * @returns The manifest.
 */
function prebuiltManifest(): Manifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      application: [
        { $: { 'android:name': '.MainApplication' }, activity: [{ $: { 'android:name': '.MainActivity' } }] },
      ],
    },
  };
}

const namesOf = (components: Component[] | undefined): string[] =>
  (components ?? []).map((component) => component.$['android:name'] ?? '');

describe('the contacts config plugin', () => {
  it('asks for the contacts, account and sync permissions', () => {
    const manifest = addSyncAccount(prebuiltManifest());

    const asked = (manifest.manifest['uses-permission'] ?? []).map((permission) => permission.$['android:name']);
    expect(asked).toEqual(expect.arrayContaining(PERMISSIONS));
  });

  it('declares the authenticator and the sync adapter, each with its XML', () => {
    const [application] = addSyncAccount(prebuiltManifest()).manifest.application;

    const resources = (application?.service ?? []).flatMap((service) =>
      (service['meta-data'] ?? []).map((item) => item.$['android:resource']),
    );
    expect(namesOf(application?.service)).toEqual([
      'expo.modules.philotescontacts.AuthenticatorService',
      'expo.modules.philotescontacts.SyncService',
    ]);
    expect(resources).toEqual(['@xml/philotes_authenticator', '@xml/philotes_syncadapter', '@xml/philotes_contacts']);
  });

  it('adds the "Open in Philotes" activity beside the app’s own, and nothing twice', () => {
    const [application] = addSyncAccount(addSyncAccount(prebuiltManifest())).manifest.application;

    expect(namesOf(application?.activity)).toEqual([
      '.MainActivity',
      'expo.modules.philotescontacts.OpenInPhilotesActivity',
    ]);
    expect(application?.service).toHaveLength(2);
  });
});
