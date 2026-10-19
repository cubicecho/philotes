import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DB } from '@cubicecho/philotes-db';
import { mailboxes } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';

// A mailbox's app password, sealed with AES-256-GCM under a key from MAIL_CREDENTIAL_KEYS. The key never
// reaches the database. The sealed form names its key, so the keys can be rotated: the first key seals,
// any listed key opens, and `resealCredentials` moves every row onto the first. See
// docs/email-interactions.md, "The credential, at rest".

/** The cipher. GCM authenticates as well as encrypts, so a changed byte fails to open. */
const CIPHER = 'aes-256-gcm';
/** The sealed form's version, its first part. */
const SEALED_VERSION = 'v1';
/** What separates the sealed form's parts. Not in base64url, nor in a key id. */
const SEPARATOR = '.';
/** How many parts a sealed value has: version, key id, IV, tag, ciphertext. */
const SEALED_PARTS = 5;
/** AES-256 takes a 32-byte key. */
const KEY_BYTES = 32;
/** GCM's recommended IV: 96 bits, fresh for every seal. */
const IV_BYTES = 12;
/** What separates a key's id from its value in MAIL_CREDENTIAL_KEYS. */
const KEY_ID_SEPARATOR = ':';
/** What separates the keys in MAIL_CREDENTIAL_KEYS. */
const KEY_LIST_SEPARATOR = ',';
/** What a key id may be made of. */
const KEY_ID = /^[A-Za-z0-9_-]+$/;

/** One key from MAIL_CREDENTIAL_KEYS. */
export interface CredentialKey {
  id: string;
  key: Buffer;
}

/** The keys a server has: the one that seals, and every one that opens. */
export interface Keyring {
  current: CredentialKey;
  byId: ReadonlyMap<string, CredentialKey>;
}

/** A sealed value that cannot be opened: its key is gone, or it was changed. */
export class CredentialUnreadable extends Error {}

/**
 * Reads MAIL_CREDENTIAL_KEYS: `<id>:<base64 of 32 bytes>`, comma-separated, the sealing key first.
 *
 * @param raw - The variable's value.
 * @returns The keyring, or null when the variable is unset or empty, which turns mail off.
 * @throws When a key is malformed, so a misconfigured server stops at boot rather than sealing badly.
 */
export function parseKeyring(raw: string | undefined): Keyring | null {
  const entries = (raw ?? '')
    .split(KEY_LIST_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (entries.length === 0) {
    return null;
  }
  const keys = entries.map((entry): CredentialKey => {
    const at = entry.indexOf(KEY_ID_SEPARATOR);
    const id = entry.slice(0, at);
    const key = Buffer.from(entry.slice(at + 1), 'base64');
    const isMalformed = at <= 0 || KEY_ID.test(id) === false || key.length !== KEY_BYTES;
    if (isMalformed) {
      throw new Error(
        'Each MAIL_CREDENTIAL_KEYS entry is <id>:<key>, where the id is letters, digits, - or _ and the key is 32 random bytes in base64 (`openssl rand -base64 32`).',
      );
    }
    return { id, key };
  });
  const byId = new Map(keys.map((key) => [key.id, key]));
  const hasRepeats = byId.size !== keys.length;
  if (hasRepeats) {
    throw new Error('MAIL_CREDENTIAL_KEYS names the same key id twice.');
  }
  return { current: keys[0], byId };
}

/**
 * Builds the associated data a user's credential is sealed with, so it opens only on that user's row.
 *
 * @param userId - The mailbox's owner.
 * @returns The associated data.
 */
export function credentialContext(userId: string): Buffer {
  return Buffer.from(`mailbox:${userId}`);
}

/**
 * Seals a password under the keyring's current key.
 *
 * @param keyring - The server's keys.
 * @param plaintext - The password.
 * @param context - From `credentialContext`.
 * @returns The sealed form, safe to store.
 */
export function sealCredential(keyring: Keyring, plaintext: string, context: Buffer): string {
  const { id, key } = keyring.current;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key, iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    SEALED_VERSION,
    id,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(SEPARATOR);
}

/**
 * Reads which key sealed a value.
 *
 * @param sealed - The sealed form.
 * @returns The key id, or null when the value is not one this server writes.
 */
export function sealedKeyId(sealed: string): string | null {
  const parts = sealed.split(SEPARATOR);
  const isSealed = parts.length === SEALED_PARTS && parts[0] === SEALED_VERSION;
  return isSealed ? parts[1] : null;
}

/**
 * Opens a sealed password.
 *
 * @param keyring - The server's keys.
 * @param sealed - The sealed form.
 * @param context - From `credentialContext`, for the row it was read from.
 * @returns The password.
 * @throws CredentialUnreadable when its key is not in the keyring, or it does not open under it.
 */
export function openCredential(keyring: Keyring, sealed: string, context: Buffer): string {
  const keyId = sealedKeyId(sealed);
  const key = keyId === null ? undefined : keyring.byId.get(keyId);
  if (key === undefined) {
    throw new CredentialUnreadable('The credential was sealed with a key this server does not have.');
  }
  const [, , iv, tag, ciphertext] = sealed.split(SEPARATOR);
  try {
    const decipher = createDecipheriv(CIPHER, key.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(context);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    // GCM's "unable to authenticate data": a changed byte, or another row's credential.
    throw new CredentialUnreadable('The credential does not open: it was changed, or belongs to another mailbox.');
  }
}

/**
 * Seals every credential that is under an older key again under the current one. A credential no key
 * opens is left for its owner to replace; the poller marks that mailbox when it next comes up.
 *
 * @param db - The database.
 * @param keyring - The server's keys.
 * @returns How many credentials were sealed again.
 */
export async function resealCredentials(db: DB, keyring: Keyring): Promise<number> {
  const rows = await db
    .select({ id: mailboxes.id, userId: mailboxes.userId, credential: mailboxes.credential })
    .from(mailboxes);
  let resealed = 0;
  for (const row of rows) {
    const isCurrent = sealedKeyId(row.credential) === keyring.current.id;
    if (isCurrent) {
      continue;
    }
    const context = credentialContext(row.userId);
    try {
      const password = openCredential(keyring, row.credential, context);
      const credential = sealCredential(keyring, password, context);
      await db.update(mailboxes).set({ credential }).where(eq(mailboxes.id, row.id));
      resealed += 1;
    } catch (error: unknown) {
      if (error instanceof CredentialUnreadable) {
        continue;
      }
      throw error;
    }
  }
  return resealed;
}
