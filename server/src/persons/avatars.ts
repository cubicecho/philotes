import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { db, schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import { extractUserId } from '../auth/resolvers.ts';

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

/**
 * Lets a request through only when the caller is signed in and has the person in their own list.
 * It runs before the upload is parsed, so nothing is written to disk for anyone else. A person
 * that belongs to another user answers "not found", as the resolvers do.
 *
 * @param req - The request, with `personId` in its path.
 * @param res - The response; `res.locals` receives the {@link AvatarLocals}.
 * @param next - Continues to the handler.
 * @returns Nothing.
 */
async function requireOwnPerson(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

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
    res.status(404).json({ error: 'Person not found' });
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
 * @param locals - Who is asking, and about which person.
 * @param avatarPath - The new path, or `null` to clear it.
 * @returns Nothing.
 */
async function saveAvatarPath(locals: AvatarLocals, avatarPath: string | null): Promise<void> {
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
 * @param avatarDir - The directory avatars are stored in.
 * @returns The router, to mount at `/avatars`.
 */
export function createAvatarRouter(avatarDir: string): Router {
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

  router.post('/:personId', requireOwnPerson, (req, res) => {
    upload(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        res.status(400).json({ error: 'The file could not be uploaded' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No image file uploaded' });
        return;
      }

      const locals = res.locals as AvatarLocals;
      const avatarUrl = `${AVATAR_URL_PREFIX}${req.file.filename}`;
      await saveAvatarPath(locals, avatarUrl);
      if (locals.avatarPath) {
        await removeAvatarFile(avatarDir, locals.avatarPath);
      }

      res.json({ url: avatarUrl });
    });
  });

  router.delete('/:personId', requireOwnPerson, async (_req, res) => {
    const locals = res.locals as AvatarLocals;

    if (locals.avatarPath) {
      await removeAvatarFile(avatarDir, locals.avatarPath);
      await saveAvatarPath(locals, null);
    }

    res.json({ success: true });
  });

  return router;
}
