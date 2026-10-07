import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorageConfig } from '../core/config.ts';
import { HttpStatus } from '../core/wire.ts';
import type { AvatarStore } from './avatar-store.ts';

/** The error S3 names when a key holds nothing. */
const NO_SUCH_KEY = 'NoSuchKey';
/** The errors S3 names when the bucket is already there, made by this account, between the check and the create. */
const BUCKET_EXISTS = new Set(['BucketAlreadyOwnedByYou', 'BucketAlreadyExists']);

/**
 * The name S3 gave an error.
 *
 * @param error - What was thrown.
 * @returns The error's name, or an empty string for something that is not an error.
 */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

/**
 * Whether an error is S3 answering 404. A HEAD has no body, so a missing bucket carries no name to match on.
 *
 * @param error - What was thrown.
 * @returns True for a 404.
 */
function isNotFound(error: unknown): boolean {
  const isObject = typeof error === 'object' && error !== null && '$metadata' in error;
  if (isObject === false) {
    return false;
  }
  const { $metadata: metadata } = error as { $metadata?: { httpStatusCode?: number } };
  return metadata?.httpStatusCode === HttpStatus.NotFound;
}

/**
 * Keeps avatars in a bucket of an S3-compatible store, such as MinIO. The bucket stays private:
 * the server reads from it and streams the image to the caller itself.
 *
 * @param config - Where the store is, the bucket, and the credentials.
 * @returns The store.
 */
export function createS3AvatarStore(config: ObjectStorageConfig): AvatarStore {
  const { bucket } = config;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async prepare() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return;
      } catch (error) {
        const isOtherFailure = isNotFound(error) === false;
        if (isOtherFailure) {
          throw error;
        }
      }

      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (error) {
        const isOtherFailure = BUCKET_EXISTS.has(errorName(error)) === false;
        if (isOtherFailure) {
          throw error;
        }
      }
    },

    async put(name, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: name, Body: body, ContentType: contentType }));
    },

    async read(name) {
      try {
        const { Body: body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: name }));
        // In Node the SDK hands the body back as a stream. Anything else has no bytes to send.
        return body instanceof Readable ? body : null;
      } catch (error) {
        if (errorName(error) === NO_SUCH_KEY) {
          return null;
        }
        throw error;
      }
    },

    async remove(name) {
      // S3 answers a delete of a key that holds nothing as a success.
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: name }));
    },
  };
}
