import { useState } from 'react';
import type { PickedFile } from '@/components/ui/file-picker-base';
import { API_URL } from '@/lib/api-url';
import { getToken } from '@/lib/auth';

/** What the avatar endpoint accepts, in the form a file picker's `accept` takes. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

const UPLOAD_FAILED = 'The photo could not be uploaded. Use a JPEG, PNG, GIF or WebP image under 5 MB.';

interface AvatarUpload {
  /** `accept` for the picker that feeds `upload`. */
  accept: string;
  /** Hand to a file picker's `onPickMany`; the picker must read with `read="bytes"`. */
  upload: (files: PickedFile[]) => Promise<void>;
  /** Why the last upload failed, in words to show, or `null` when it did not. */
  error: string | null;
}

/**
 * Uploads a picked file to `/avatars/:personId`. The avatar endpoint is a
 * plain multipart POST rather than a GraphQL mutation, so it carries the bearer
 * token itself, and the caller refetches once it resolves.
 *
 * @param personId - Whose avatar this is.
 * @param onUploaded - Called after the server has stored the file.
 * @returns The picker's `accept`, the upload handler and the last failure.
 */
export function useAvatarUpload(personId: string, onUploaded: () => void): AvatarUpload {
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: PickedFile[]) => {
    const file = files[0];
    if (!file?.bytes) {
      return;
    }

    const formData = new FormData();
    // Copied into a fresh buffer: the picker's view may sit on a shared one, which a Blob part cannot be.
    formData.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
    const token = getToken();
    // A rejected fetch is the network failing; a response that is not ok is the server refusing.
    const response = await fetch(`${API_URL}/avatars/${personId}`, {
      method: 'POST',
      body: formData,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }).catch(() => null);

    const isStored = response?.ok === true;
    if (isStored === false) {
      setError(UPLOAD_FAILED);
      return;
    }

    setError(null);
    onUploaded();
  };

  return { accept: AVATAR_ACCEPT, upload, error };
}
