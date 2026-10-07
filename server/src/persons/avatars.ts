import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import { type Auth, sessionUserId } from '../auth/better-auth.ts';
import { HttpStatus } from '../core/wire.ts';

/** The URL prefix the stored `avatarPath` carries, and the mount the files are served under. */
const AVATAR_URL_PREFIX = '/avatars/';
/** 5 MiB. */
const AVATAR_MAX_BYTES = 5_242_880;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The image types accepted, and the extension each is stored under. The client's file name is never used. */
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** What the guard leaves on `res.locals` for the handlers behind it. */
interface AvatarLocals {
  userId: string;
  personId: string;
  /** The avatar the caller already has for this person, as stored. */
  avatarPath: string | null;
}

/** What the avatar routes are built from. */
export interface AvatarRouterDeps {
  /** Drizzle client. */
  db: DB;
  /** Reads the caller's session. */
  auth: Auth;
  /** The directory avatars are stored in. */
  avatarDir: string;
}

/**
 * Lets a request through only when the caller is signed in. Reading an avatar needs this too:
 * a file name is random, but it is not a credential.
 *
 * @param auth - The auth instance.
 * @param req - The request, carrying `Authorization: Bearer`.
 * @param res - The response; `res.locals.userId` receives the caller's id.
 * @param next - Continues to the handler.
 * @returns Nothing.
 */
async function requireSession(auth: Auth, req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await sessionUserId(auth, fromNodeHeaders(req.headers));
  if (userId === null) {
    res.status(HttpStatus.Unauthorized).json({ error: 'Unauthenticated' });
    return;
  }
  res.locals.userId = userId;
  next();
}

/**
 * Lets a request through only when the caller has the person in their own list. It runs before
 * the upload is parsed, so nothing is written to disk for anyone else. A person that belongs to
 * another user answers "not found", as the resolvers do.
 *
 * @param db - Drizzle client.
 * @param req - The request, with `personId` in its path.
 * @param res - The response; `res.locals` holds the caller's id and receives the {@link AvatarLocals}.
 * @param next - Continues to the handler.
 * @returns Nothing.
 */
async function requireOwnPerson(db: DB, req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = String(res.locals.userId);

  const personId = String(req.params.personId);
  // Postgres rejects a malformed uuid with an error, which would answer 500 where 404 is meant.
  const isUuid = UUID_PATTERN.test(personId);
  const rows: Array<{ avatarPath: string | null }> = isUuid
    ? await db
        .select({ avatarPath: dbSchema.userPersons.avatarPath })
        .from(dbSchema.userPersons)
        .where(and(eq(dbSchema.userPersons.personId, personId), eq(dbSchema.userPersons.userId, userId)))
    : [];

  const [link] = rows;
  if (!link) {
    res.status(HttpStatus.NotFound).json({ error: 'Person not found' });
    return;
  }

  const locals: AvatarLocals = { userId, personId, avatarPath: link.avatarPath };
  Object.assign(res.locals, locals);
  next();
}

/**
 * Deletes a stored avatar's file. A file that is already gone is not an error.
 *
 * @param avatarDir - The directory avatars are stored in.
 * @param avatarPath - The path as stored on the row, such as `/avatars/<name>`.
 * @returns Nothing.
 */
async function removeAvatarFile(avatarDir: string, avatarPath: string): Promise<void> {
  // `basename` keeps a stored path from ever pointing outside the avatar directory.
  await unlink(join(avatarDir, basename(avatarPath))).catch(() => {});
}

/**
 * Stores the avatar path on the caller's own link to the person.
 *
 * @param db - Drizzle client.
 * @param locals - Who is asking, and about which person.
 * @param avatarPath - The new path, or `null` to clear it.
 * @returns Nothing.
 */
async function saveAvatarPath(db: DB, locals: AvatarLocals, avatarPath: string | null): Promise<void> {
  await db
    .update(dbSchema.userPersons)
    .set({ avatarPath })
    .where(and(eq(dbSchema.userPersons.personId, locals.personId), eq(dbSchema.userPersons.userId, locals.userId)));
}

/**
 * Builds the routes that upload and remove a person's avatar.
 *
 * Each file gets a random name, so two users who share a person never overwrite each other's
 * picture and a name cannot be guessed from a person id.
 *
 * @param deps - The database, the auth instance and the avatar directory.
 * @returns The router, to mount at `/avatars`.
 */
export function createAvatarRouter(deps: AvatarRouterDeps): Router {
  const { db, auth, avatarDir } = deps;
  const guard = (req: Request, res: Response, next: NextFunction) => requireOwnPerson(db, req, res, next);
  const storage = multer.diskStorage({
    destination: avatarDir,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${EXTENSION_BY_MIME_TYPE[file.mimetype]}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      cb(null, Object.hasOwn(EXTENSION_BY_MIME_TYPE, file.mimetype));
    },
  }).single('file');

  const router = Router();
  router.use((req, res, next) => requireSession(auth, req, res, next));
  router.use(express.static(avatarDir));

  router.post('/:personId', guard, (req, res) => {
    upload(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        res.status(HttpStatus.BadRequest).json({ error: 'The file could not be uploaded' });
        return;
      }

      if (!req.file) {
        res.status(HttpStatus.BadRequest).json({ error: 'No image file uploaded' });
        return;
      }

      const locals = res.locals as AvatarLocals;
      const avatarUrl = `${AVATAR_URL_PREFIX}${req.file.filename}`;
      await saveAvatarPath(db, locals, avatarUrl);
      if (locals.avatarPath) {
        await removeAvatarFile(avatarDir, locals.avatarPath);
      }

      res.json({ url: avatarUrl });
    });
  });

  router.delete('/:personId', guard, async (_req, res) => {
    const locals = res.locals as AvatarLocals;

    if (locals.avatarPath) {
      await removeAvatarFile(avatarDir, locals.avatarPath);
      await saveAvatarPath(db, locals, null);
    }

    res.json({ success: true });
  });

  return router;
}
