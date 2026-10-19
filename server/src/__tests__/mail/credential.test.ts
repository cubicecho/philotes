import { mailboxes } from '@cubicecho/philotes-db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CredentialUnreadable,
  credentialContext,
  openCredential,
  parseKeyring,
  resealCredentials,
  sealCredential,
  sealedKeyId,
} from '../../mail/credential.ts';
import { closeTestDb, createTestDb, createUser, type TestDb } from '../helpers.ts';
import { keyEntry, keyringOf } from './fake-mailbox.ts';

const PASSWORD = 'abcd efgh ijkl mnop';
const OWNER = credentialContext('00000000-0000-4000-8000-000000000001');
const STRANGER = credentialContext('00000000-0000-4000-8000-000000000002');

describe('parseKeyring', () => {
  it('turns mail off when the variable is unset or empty', () => {
    expect(parseKeyring(undefined)).toBeNull();
    expect(parseKeyring(' , ')).toBeNull();
  });

  it('seals with the first key and opens with any', () => {
    const keyring = keyringOf(keyEntry('new'), keyEntry('old'));

    expect(keyring.current.id).toBe('new');
    expect([...keyring.byId.keys()]).toEqual(['new', 'old']);
  });

  it.each([
    ['a key with no id', ':AAAA'],
    ['a key of the wrong length', 'k1:c2hvcnQ='],
    ['an id with a dot', `k.1:${keyEntry('x').split(':')[1]}`],
  ])('refuses %s', (_name, raw) => {
    expect(() => parseKeyring(raw)).toThrow(/MAIL_CREDENTIAL_KEYS/);
  });

  it('refuses the same id twice', () => {
    expect(() => parseKeyring([keyEntry('k1'), keyEntry('k1')].join(','))).toThrow(/twice/);
  });
});

describe('sealing a credential', () => {
  const keyring = keyringOf(keyEntry('k1'));

  it('opens to what was sealed, and never holds it in the clear', () => {
    const sealed = sealCredential(keyring, PASSWORD, OWNER);

    expect(sealed).not.toContain(PASSWORD);
    expect(sealedKeyId(sealed)).toBe('k1');
    expect(openCredential(keyring, sealed, OWNER)).toBe(PASSWORD);
  });

  it('seals the same password differently each time', () => {
    expect(sealCredential(keyring, PASSWORD, OWNER)).not.toBe(sealCredential(keyring, PASSWORD, OWNER));
  });

  it("does not open on another user's row", () => {
    const sealed = sealCredential(keyring, PASSWORD, OWNER);

    expect(() => openCredential(keyring, sealed, STRANGER)).toThrow(CredentialUnreadable);
  });

  it('does not open once a byte is changed', () => {
    const sealed = sealCredential(keyring, PASSWORD, OWNER);
    const parts = sealed.split('.');
    const ciphertext = Buffer.from(parts[4], 'base64url');
    ciphertext[0] ^= 1;
    parts[4] = ciphertext.toString('base64url');

    expect(() => openCredential(keyring, parts.join('.'), OWNER)).toThrow(CredentialUnreadable);
  });

  it('does not open once its key is gone', () => {
    const sealed = sealCredential(keyringOf(keyEntry('old')), PASSWORD, OWNER);

    expect(() => openCredential(keyring, sealed, OWNER)).toThrow(CredentialUnreadable);
  });
});

describe('resealCredentials', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  it('moves every credential under an older key onto the current one, and leaves one no key opens', async () => {
    const oldKey = keyEntry('old');
    const before = keyringOf(oldKey);
    const after = keyringOf(keyEntry('new'), oldKey);
    const lostKeyring = keyringOf(keyEntry('lost'));
    const ownerId = await createUser(db, 'owner@example.com');
    const lostId = await createUser(db, 'lost@example.com');
    const row = { host: 'imap.example.com', port: 993, username: 'u', address: 'u@example.com' };
    await db.insert(mailboxes).values([
      { ...row, userId: ownerId, credential: sealCredential(before, PASSWORD, credentialContext(ownerId)) },
      { ...row, userId: lostId, credential: sealCredential(lostKeyring, PASSWORD, credentialContext(lostId)) },
    ]);

    const resealed = await resealCredentials(db, after);
    const again = await resealCredentials(db, after);

    expect(resealed).toBe(1);
    expect(again).toBe(0);
    const rows: Array<{ userId: string; credential: string }> = await db.select().from(mailboxes);
    const owner = rows.find((each) => each.userId === ownerId);
    const lost = rows.find((each) => each.userId === lostId);
    expect(owner && sealedKeyId(owner.credential)).toBe('new');
    expect(owner && openCredential(after, owner.credential, credentialContext(ownerId))).toBe(PASSWORD);
    expect(lost && sealedKeyId(lost.credential)).toBe('lost');
  });
});
