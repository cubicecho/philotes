import type { PickedFile } from '@/components/ui/file-picker-base';
import { getToken } from '@/lib/auth';

/** What the avatar endpoint accepts, in the form a file picker's `accept` takes. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

interface AvatarUpload {
  /** `accept` for the picker that feeds `upload`. */
  accept: string;
  /** Hand to a file picker's `onPickMany`; the picker must read with `read="bytes"`. */
  upload: (files: PickedFile[]) => Promise<void>;
}

/**
 * Uploads a picked file to `/avatars/:personId`. The avatar endpoint is a
 * plain multipart POST rather than a GraphQL mutation, so it carries the bearer
 * token itself, and the caller refetches once it resolves.
 */
export function useAvatarUpload(personId: string, onUploaded: () => void): AvatarUpload {
  const upload = async (files: PickedFile[]) => {
    const file = files[0];
    if (!file?.bytes) return;

    const formData = new FormData();
    // Copied into a fresh buffer: the picker's view may sit on a shared one, which a Blob part cannot be.
    formData.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
    const token = getToken();
    await fetch(`/avatars/${personId}`, {
      method: 'POST',
      body: formData,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

    onUploaded();
  };

  return { accept: AVATAR_ACCEPT, upload };
}
