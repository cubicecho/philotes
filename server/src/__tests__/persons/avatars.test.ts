import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../../auth/better-auth.ts';
import { HttpStatus } from '../../core/wire.ts';
import { type AvatarStore, createDiskAvatarStore } from '../../persons/avatar-store.ts';
import { createS3AvatarStore } from '../../persons/avatar-store-s3.ts';
import { createAvatarRouter } from '../../persons/avatars.ts';
import {
  createPerson,
  createSessionToken,
  createTestAuth,
  createTestDb,
  createUser,
  portOf,
  type TestDb,
} from '../helpers.ts';

/** A store under test, with the two things only a test needs: what it holds, and how to throw it away. */
interface StoreUnderTest {
  store: AvatarStore;
  /** The names of the files the store holds. */
  names: () => Promise<string[]>;
  cleanup: () => Promise<void>;
}

/**
 * A disk store in a temporary directory.
 *
 * @returns The store, its file names read from the directory, and a cleanup that removes the directory.
 */
async function diskStore(): Promise<StoreUnderTest> {
  const directory = await mkdtemp(join(tmpdir(), 'philotes-avatars-'));
  return {
    store: createDiskAvatarStore(directory),
    names: () => readdir(directory),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

/**
 * A store that keeps its files in a map, standing in for any store that is not the disk.
 *
 * @returns The store, its file names, and a cleanup that does nothing.
 */
async function memoryStore(): Promise<StoreUnderTest> {
  const files = new Map<string, Buffer>();
  const store: AvatarStore = {
    prepare: async () => {},
    put: async (name, body) => {
      files.set(name, body);
    },
    read: async (name) => {
      const body = files.get(name);
      return body === undefined ? null : Readable.from([body]);
    },
    remove: async (name) => {
      files.delete(name);
    },
  };
  return { store, names: async () => [...files.keys()], cleanup: async () => {} };
}

/** A real S3-compatible store to test against. Unset, the run against one is left out. */
const S3_TEST_ENDPOINT = process.env.TEST_S3_ENDPOINT ?? '';

/**
 * A bucket of its own in the store `TEST_S3_ENDPOINT` names, made by the store's own `prepare`.
 *
 * @returns The store, its keys, and a cleanup that empties the bucket.
 */
async function s3Store(): Promise<StoreUnderTest> {
  const config = {
    endpoint: S3_TEST_ENDPOINT,
    bucket: `philotes-test-${Date.now()}`,
    region: 'us-east-1',
    forcePathStyle: true,
    accessKeyId: process.env.TEST_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY ?? '',
  };
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const names = async (): Promise<string[]> => {
    const listed = await client.send(new ListObjectsV2Command({ Bucket: config.bucket }));
    return (listed.Contents ?? []).map((object) => object.Key ?? '');
  };
  return {
    store: createS3AvatarStore(config),
    names,
    cleanup: async () => {
      const keys = await names();
      if (keys.length > 0) {
        const objects = keys.map((key) => ({ Key: key }));
        await client.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: objects } }));
      }
    },
  };
}

const STORES = [
  { kind: 'the disk', makeStore: diskStore },
  { kind: 'an in-memory store', makeStore: memoryStore },
  ...(S3_TEST_ENDPOINT === '' ? [] : [{ kind: 'an S3-compatible store', makeStore: s3Store }]),
];

describe.each(STORES)('avatar routes, kept in $kind', ({ makeStore }) => {
  let db: TestDb;
  let auth: Auth;
  let ownerHeaders: Record<string, string>;
  let stored: StoreUnderTest;
  let server: Server;
  let baseUrl: string;
  let ownerId: string;
  let strangerId: string;
  let personId: string;

  /**
   * Posts a one-file upload to the avatar route.
   *
   * @param userId - Who is uploading, or `null` to send no token.
   * @param mimeType - The type the file claims.
   * @param fileName - The name the client sends.
   * @returns The response.
   */
  async function uploadAvatar(userId: string | null, mimeType = 'image/png', fileName = 'me.png'): Promise<Response> {
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: mimeType }), fileName);
    const headers: Record<string, string> =
      userId === null ? {} : { authorization: `Bearer ${await createSessionToken(auth, userId)}` };
    return fetch(`${baseUrl}/avatars/${personId}`, { method: 'POST', body, headers });
  }

  /**
   * Reads the avatar path stored for the owner's link to the person.
   *
   * @returns The stored path, or `null` when there is none.
   */
  async function storedAvatarPath(): Promise<string | null> {
    const rows: Array<{ avatarPath: string | null }> = await db
      .select({ avatarPath: dbSchema.userPersons.avatarPath })
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.personId, personId), eq(dbSchema.userPersons.userId, ownerId)));
    return rows[0]?.avatarPath ?? null;
  }

  beforeAll(async () => {
    db = await createTestDb();
    ({ auth } = createTestAuth(db));
    ownerId = await createUser(db, 'avatar-owner@example.com');
    strangerId = await createUser(db, 'avatar-stranger@example.com');
    personId = await createPerson(db, ownerId, 'Grace');
    ownerHeaders = { authorization: `Bearer ${await createSessionToken(auth, ownerId)}` };
    stored = await makeStore();
    await stored.store.prepare();

    const app = express();
    app.use('/avatars', createAvatarRouter({ db, auth, store: stored.store }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${portOf(server)}`;
  });

  beforeEach(async () => {
    await fetch(`${baseUrl}/avatars/${personId}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await stored.cleanup();
  });

  it('writes nothing for a caller who is not signed in', async () => {
    const response = await uploadAvatar(null);

    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await stored.names()).toEqual([]);
  });

  it("answers 'not found' and writes nothing for a person in someone else's list", async () => {
    const response = await uploadAvatar(strangerId);

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await stored.names()).toEqual([]);
    expect(await storedAvatarPath()).toBeNull();
  });

  it("answers 'not found' for an id that is not a uuid", async () => {
    const response = await fetch(`${baseUrl}/avatars/not-a-uuid`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });

    expect(response.status).toBe(HttpStatus.NotFound);
  });

  it('stores the upload under a random name with the extension of its type', async () => {
    const response = await uploadAvatar(ownerId, 'image/png', 'evil.html');

    expect(response.status).toBe(HttpStatus.Ok);
    const [fileName] = await stored.names();
    expect(fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fileName).not.toContain(personId);
    expect(await storedAvatarPath()).toBe(`/avatars/${fileName}`);
  });

  it('rejects a file that is not an image', async () => {
    const response = await uploadAvatar(ownerId, 'text/html', 'page.html');

    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await stored.names()).toEqual([]);
  });

  it('serves a stored avatar only to a signed-in caller', async () => {
    const { url } = (await (await uploadAvatar(ownerId)).json()) as { url: string };

    const anonymous = await fetch(`${baseUrl}${url}`);
    const signedIn = await fetch(`${baseUrl}${url}`, { headers: ownerHeaders });

    expect(anonymous.status).toBe(HttpStatus.Unauthorized);
    expect(signedIn.status).toBe(HttpStatus.Ok);
    expect(signedIn.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await signedIn.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("answers 'not found' for a name the store does not hold", async () => {
    const response = await fetch(`${baseUrl}/avatars/00000000-0000-4000-8000-000000000000.png`, {
      headers: ownerHeaders,
    });

    expect(response.status).toBe(HttpStatus.NotFound);
  });

  it("answers 'not found' for a name that is not an image file's", async () => {
    await uploadAvatar(ownerId);

    const dotted = await fetch(`${baseUrl}/avatars/..%2F..%2Fpackage.json`, { headers: ownerHeaders });
    const untyped = await fetch(`${baseUrl}/avatars/notes.txt`, { headers: ownerHeaders });

    expect(dotted.status).toBe(HttpStatus.NotFound);
    expect(untyped.status).toBe(HttpStatus.NotFound);
  });

  it('removes the old file when a new one is uploaded', async () => {
    await uploadAvatar(ownerId);
    const [firstName] = await stored.names();

    await uploadAvatar(ownerId, 'image/jpeg', 'me.jpg');

    const files = await stored.names();
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe(firstName);
  });

  it('removes the file and clears the path on delete', async () => {
    await uploadAvatar(ownerId);

    const response = await fetch(`${baseUrl}/avatars/${personId}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });

    expect(response.status).toBe(HttpStatus.Ok);
    expect(await stored.names()).toEqual([]);
    expect(await storedAvatarPath()).toBeNull();
  });
});
