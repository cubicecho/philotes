import { mkdir, open, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

/** The error code Node gives for a file that is not there. */
const FILE_NOT_FOUND = 'ENOENT';

/**
 * Where avatar images are kept. A name is the file's own name, such as `<uuid>.png`, with no
 * directory in it: the routes check that before a store ever sees it.
 */
export interface AvatarStore {
  /**
   * Makes the store ready to take files. Called once, at boot.
   *
   * @returns Nothing.
   * @throws When the place the files go cannot be reached or created.
   */
  prepare(): Promise<void>;
  /**
   * Stores an image under a name, replacing whatever held it.
   *
   * @param name - The file's name.
   * @param body - The image's bytes.
   * @param contentType - The image's MIME type.
   * @returns Nothing.
   */
  put(name: string, body: Buffer, contentType: string): Promise<void>;
  /**
   * Opens a stored image.
   *
   * @param name - The file's name.
   * @returns The image's bytes as a stream, or `null` when nothing is stored under the name.
   */
  read(name: string): Promise<Readable | null>;
  /**
   * Deletes a stored image. A name that holds nothing is not an error.
   *
   * @param name - The file's name.
   * @returns Nothing.
   */
  remove(name: string): Promise<void>;
}

/**
 * Whether an error is Node's "no such file".
 *
 * @param error - What was thrown.
 * @returns True for a missing file.
 */
function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === FILE_NOT_FOUND;
}

/**
 * Keeps avatars as files in one directory. The default: a single-container install needs nothing else.
 *
 * @param directory - The directory, as an absolute path.
 * @returns The store.
 */
export function createDiskAvatarStore(directory: string): AvatarStore {
  return {
    async prepare() {
      await mkdir(directory, { recursive: true });
    },

    async put(name, body) {
      await writeFile(join(directory, name), body);
    },

    async read(name) {
      try {
        // Opened first, so a missing file is answered here and not as an error on the stream.
        const file = await open(join(directory, name));
        return file.createReadStream();
      } catch (error) {
        if (isFileNotFound(error)) {
          return null;
        }
        throw error;
      }
    },

    async remove(name) {
      try {
        await unlink(join(directory, name));
      } catch (error) {
        const isOtherFailure = isFileNotFound(error) === false;
        if (isOtherFailure) {
          throw error;
        }
      }
    },
  };
}
