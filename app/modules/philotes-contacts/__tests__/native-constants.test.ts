import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as stored from '@cubicecho/philotes-db/schema';
import { describe, expect, it } from 'vitest';

// The Kotlin half cannot be compiled here, so this holds the words it shares with the rest of the repo in
// step by reading its source: the server's vocabularies, the account type, and the MIME type of the
// "Open in Philotes" row.

const MODULE_ROOT = path.resolve(__dirname, '..');
const KOTLIN_ROOT = path.join(MODULE_ROOT, 'android/src/main/java/expo/modules/philotescontacts');

/**
 * Reads a file of the module.
 *
 * @param parts - The path inside the module.
 * @returns The text.
 */
function read(...parts: string[]): string {
  return readFileSync(path.join(...parts), 'utf8');
}

/**
 * Reads the string constants of one Kotlin `object`.
 *
 * @param source - The Kotlin source.
 * @param objectName - The object's name.
 * @returns Each constant's value, by name.
 */
function kotlinConstants(source: string, objectName: string): Map<string, string> {
  const body = source.match(new RegExp(`object ${objectName} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return new Map([...body.matchAll(/const val (\w+) = "([^"]*)"/g)].map((match) => [match[1] ?? '', match[2] ?? '']));
}

const contactRows = read(KOTLIN_ROOT, 'ContactRows.kt');

describe('the Kotlin sync adapter', () => {
  it('knows every word the server stores for a type or kind, and no other', () => {
    const inKotlin = new Set(kotlinConstants(contactRows, 'PhilotesWord').values());
    const inDatabase = new Set<string>([
      ...Object.values(stored.ContactType),
      ...Object.values(stored.ContactKind),
      ...Object.values(stored.AddressType),
      ...Object.values(stored.ImportantDateKind),
    ]);

    expect([...inKotlin].sort()).toEqual([...inDatabase].sort());
  });

  it('names the year of a date without one as the server does', () => {
    const year = contactRows.match(/YEARLESS_YEAR = "(\d+)"/)?.[1];

    expect(Number(year)).toBe(stored.YEARLESS_DATE_YEAR);
  });

  it('uses one account type in the code and in both XML files', () => {
    const accountType = read(KOTLIN_ROOT, 'PhilotesAccount.kt').match(/ACCOUNT_TYPE = "([^"]+)"/)?.[1];
    const inXml = ['philotes_authenticator.xml', 'philotes_syncadapter.xml'].map(
      (file) => read(MODULE_ROOT, 'plugin/xml', file).match(/android:accountType="([^"]+)"/)?.[1],
    );

    expect(accountType).toBeDefined();
    expect(inXml).toEqual([accountType, accountType]);
  });

  it('gives the "Open in Philotes" row one MIME type in the code, the plugin and contacts.xml', async () => {
    const inKotlin = kotlinConstants(contactRows, 'Contract').get('PHILOTES_PROFILE');
    const { PROFILE_MIME_TYPE } = await import('../app.plugin.js');
    const contactsXml = read(MODULE_ROOT, 'plugin/xml/philotes_contacts.xml');

    expect(inKotlin).toBe(PROFILE_MIME_TYPE);
    expect(contactsXml).toContain(`android:mimeType="${inKotlin}"`);
  });
});
