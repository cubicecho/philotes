import { useMemo } from 'react';
import type { AvatarSource } from '@/hooks/use-avatar-image-base';
import { avatarUrl } from '@/lib/api-url';
import { authHeaders } from '@/lib/auth';

/** Does nothing on a device: the image loader keeps the photos, and they are no use without a session. */
export function forgetAvatarImages(): void {}

/**
 * Says where a stored avatar is loaded from. Avatars sit behind the session, and a device's image
 * loader sends the bearer token itself, so there is nothing to fetch here.
 *
 * @param avatarPath - The path as the API returns it, or null when the person has no photo.
 * @returns What to hand an `Image`, or null when there is no photo.
 */
export function useAvatarImage(avatarPath: string | null): AvatarSource | null {
  return useMemo(
    () => (avatarPath === null ? null : { uri: avatarUrl(avatarPath), headers: authHeaders() }),
    [avatarPath],
  );
}
