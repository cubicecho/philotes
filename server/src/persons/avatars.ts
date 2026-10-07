import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import { type Auth, sessionUserId } from '../auth/better-auth.ts';
import { HttpStatus } from '../core/wire.ts';
import type { AvatarStore } from './avatar-store.ts';

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

/** The type a stored file is served as, by its extension. `.jpeg` is here for files older installs stored. */
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** A stored file's name: no directory, and no leading dot. */
const FILE_NAME_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** What the guard leaves on `res.locals` for the handlers behind it. */
interface AvatarLocals {
  userId: string;
  personId: string;
  /** The avatar the caller already has for this person, as stored. */
  avatarPath: string | null;
}

/** A response on the person routes: {@link requireSession} leaves the caller's id on it, and the guard the rest. */
type AvatarResponse = Response<unknown, AvatarLocals>;

/** What the avatar routes are built from. */
export interface AvatarRouterDeps {
  /** Drizzle client. */
  db: DB;
  /** Reads the caller's session. */
  auth: Auth;
  /** Where the images are kept. */
  store: AvatarStore;
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
async function requireOwnPerson(db: DB, req: Request, res: AvatarResponse, next: NextFunction): Promise<void> {
  const { userId } = res.locals;

  const personId = String(req.params.personId);
  // Postgres rejects a malformed uuid with an error, which would answer 500 where 404 is meant.
  const isUuid = UUID_PATTERN.test(personId);
  const rows = isUuid
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
 * Deletes a stored avatar's file. A file that is already gone is not an error, and one that cannot
 * be deleted is logged and left: the row no longer points at it either way.
 *
 * @param store - Where the images are kept.
 * @param avatarPath - The path as stored on the row, such as `/avatars/<name>`.
 * @returns Nothing.
 */
async function removeAvatarFile(store: AvatarStore, avatarPath: string): Promise<void> {
  // `basename` keeps a stored path from ever naming anything outside the store.
  const name = basename(avatarPath);
  await store.remove(name).catch((error: unknown) => {
    console.error(`[avatars] could not remove ${name}`, error);
  });
}

/**
 * Sends a stored avatar. Only a plain file name with an image extension is looked up, so a
 * request can never name anything else in the store.
 *
 * @param store - Where the images are kept.
 * @param req - The request, with the file's `name` in its path.
 * @param res - The response the image is streamed to.
 * @returns Nothing.
 */
async function sendAvatar(store: AvatarStore, req: Request, res: Response): Promise<void> {
  const name = String(req.params.name);
  const contentType = MIME_TYPE_BY_EXTENSION[extname(name).toLowerCase()];
  const isServable = FILE_NAME_PATTERN.test(name) && contentType !== undefined;
  const body = isServable ? await store.read(name) : null;
  if (body === null) {
    res.status(HttpStatus.NotFound).json({ error: 'Avatar not found' });
    return;
  }

  res.type(contentType);
  await pipeline(body, res);
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
 * Builds the routes that upload, serve and remove a person's avatar.
 *
 * Each file gets a random name, so two users who share a person never overwrite each other's
 * picture and a name cannot be guessed from a person id.
 *
 * @param deps - The database, the auth instance and the avatar store.
 * @returns The router, to mount at `/avatars`.
 */
export function createAvatarRouter(deps: AvatarRouterDeps): Router {
  const { db, auth, store } = deps;
  const guard = (req: Request, res: AvatarResponse, next: NextFunction) => requireOwnPerson(db, req, res, next);

  // Held in memory until the store takes it: the size limit keeps that to one small image a request.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      cb(null, Object.hasOwn(EXTENSION_BY_MIME_TYPE, file.mimetype));
    },
  }).single('file');

  /** Parses the upload, answering 400 itself when multer refuses it. */
  const parseUpload = (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (uploadError: unknown) => {
      if (uploadError) {
        res.status(HttpStatus.BadRequest).json({ error: 'The file could not be uploaded' });
        return;
      }
      next();
    });
  };

  const router = Router();
  router.use((req, res, next) => requireSession(auth, req, res, next));
  router.get('/:name', (req, res) => sendAvatar(store, req, res));

  router.post('/:personId', guard, parseUpload, async (req, res: AvatarResponse) => {
    if (!req.file) {
      res.status(HttpStatus.BadRequest).json({ error: 'No image file uploaded' });
      return;
    }

    const { locals } = res;
    const name = `${randomUUID()}${EXTENSION_BY_MIME_TYPE[req.file.mimetype]}`;
    await store.put(name, req.file.buffer, req.file.mimetype);

    const avatarUrl = `${AVATAR_URL_PREFIX}${name}`;
    await saveAvatarPath(db, locals, avatarUrl);
    if (locals.avatarPath) {
      await removeAvatarFile(store, locals.avatarPath);
    }

    res.json({ url: avatarUrl });
  });

  router.delete('/:personId', guard, async (_req, res) => {
    const { locals } = res;

    if (locals.avatarPath) {
      await removeAvatarFile(store, locals.avatarPath);
      await saveAvatarPath(db, locals, null);
    }

    res.json({ success: true });
  });

  return router;
}
