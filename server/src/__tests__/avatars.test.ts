import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signToken } from '../auth/resolvers.ts';
import { createAvatarRouter } from '../persons/avatars.ts';
import { createPerson, createUser, migrateTestDatabase } from './helpers/harness.ts';

const HTTP_OK = 200;
const HTTP_UNAUTHENTICATED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;

describe('avatar routes', () => {
  let avatarDir: string;
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
    const headers: Record<string, string> = userId ? { authorization: `Bearer ${signToken(userId)}` } : {};
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
    await migrateTestDatabase();
    ownerId = await createUser('avatar-owner@example.com');
    strangerId = await createUser('avatar-stranger@example.com');
    personId = await createPerson(ownerId, 'Grace');
    avatarDir = await mkdtemp(join(tmpdir(), 'philotes-avatars-'));

    const app = express();
    app.use('/avatars', createAvatarRouter(avatarDir));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(async () => {
    await fetch(`${baseUrl}/avatars/${personId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${signToken(ownerId)}` },
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(avatarDir, { recursive: true, force: true });
  });

  it('writes nothing for a caller who is not signed in', async () => {
    const response = await uploadAvatar(null);

    expect(response.status).toBe(HTTP_UNAUTHENTICATED);
    expect(await readdir(avatarDir)).toEqual([]);
  });

  it("answers 'not found' and writes nothing for a person in someone else's list", async () => {
    const response = await uploadAvatar(strangerId);

    expect(response.status).toBe(HTTP_NOT_FOUND);
    expect(await readdir(avatarDir)).toEqual([]);
    expect(await storedAvatarPath()).toBeNull();
  });

  it("answers 'not found' for an id that is not a uuid", async () => {
    const response = await fetch(`${baseUrl}/avatars/not-a-uuid`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${signToken(ownerId)}` },
    });

    expect(response.status).toBe(HTTP_NOT_FOUND);
  });

  it('stores the upload under a random name with the extension of its type', async () => {
    const response = await uploadAvatar(ownerId, 'image/png', 'evil.html');

    expect(response.status).toBe(HTTP_OK);
    const [fileName] = await readdir(avatarDir);
    expect(fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fileName).not.toContain(personId);
    expect(await storedAvatarPath()).toBe(`/avatars/${fileName}`);
  });

  it('rejects a file that is not an image', async () => {
    const response = await uploadAvatar(ownerId, 'text/html', 'page.html');

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(await readdir(avatarDir)).toEqual([]);
  });

  it('removes the old file when a new one is uploaded', async () => {
    await uploadAvatar(ownerId);
    const [firstName] = await readdir(avatarDir);

    await uploadAvatar(ownerId, 'image/jpeg', 'me.jpg');

    const files = await readdir(avatarDir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe(firstName);
  });

  it('removes the file and clears the path on delete', async () => {
    await uploadAvatar(ownerId);

    const response = await fetch(`${baseUrl}/avatars/${personId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${signToken(ownerId)}` },
    });

    expect(response.status).toBe(HTTP_OK);
    expect(await readdir(avatarDir)).toEqual([]);
    expect(await storedAvatarPath()).toBeNull();
  });
});
