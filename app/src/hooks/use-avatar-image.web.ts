import { useEffect, useState } from 'react';
import type { AvatarSource } from '@/hooks/use-avatar-image-base';
import { avatarUrl } from '@/lib/api-url';
import { authHeaders } from '@/lib/auth';

/** Object URLs of the avatars fetched so far, by stored path, so a list fetches each photo once. */
const images = new Map<string, Promise<string | null>>();

/**
 * Fetches a stored avatar as the signed-in user and wraps it in an object URL.
 *
 * @param avatarPath - The path as the API returns it, such as `/avatars/<name>.png`.
 * @returns The object URL, or null when the server refused or could not be reached.
 */
async function fetchAvatarImage(avatarPath: string): Promise<string | null> {
  const response = await fetch(avatarUrl(avatarPath), { headers: authHeaders() }).catch(() => null);
  const isImage = response?.ok === true;
  if (isImage === false) {
    return null;
  }
  return URL.createObjectURL(await response.blob());
}

/** Releases every fetched avatar. Called on sign-out, so the next user starts with none. */
export function forgetAvatarImages(): void {
  for (const image of images.values()) {
    void image.then((uri) => {
      if (uri !== null) {
        URL.revokeObjectURL(uri);
      }
    });
  }
  images.clear();
}

/**
 * Loads a stored avatar for display. Avatars sit behind the session, and a browser's image element can't
 * send a bearer token, so the photo is fetched here and shown from an object URL.
 *
 * @param avatarPath - The path as the API returns it, or null when the person has no photo.
 * @returns What to hand an `Image`, or null while it loads, when it fails and when there is no photo.
 */
export function useAvatarImage(avatarPath: string | null): AvatarSource | null {
  const [image, setImage] = useState<{ path: string; uri: string | null } | null>(null);

  useEffect(() => {
    if (avatarPath === null) {
      return;
    }
    let isCurrent = true;
    const pending = images.get(avatarPath) ?? fetchAvatarImage(avatarPath);
    images.set(avatarPath, pending);
    void pending.then((uri) => {
      // A failure isn't kept, so the next mount tries again.
      if (uri === null) {
        images.delete(avatarPath);
      }
      if (isCurrent) {
        setImage({ path: avatarPath, uri });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [avatarPath]);

  // A row reused for another person must not show the last one's photo.
  const isForThisPerson = image !== null && image.path === avatarPath;
  const uri = isForThisPerson ? image.uri : null;
  return uri === null ? null : { uri };
}
