import { useState } from 'react';
import { avatarUploadUrl } from '@/lib/api-url';
import { authHeaders } from '@/lib/auth';
import type { PickedPhoto } from '@/lib/avatar-photo';

const UPLOAD_FAILED = 'The photo could not be uploaded. Use a JPEG, PNG, GIF or WebP image under 5 MB.';

/** What `useAvatarUpload` hands back. */
interface AvatarUpload {
  /** Hand to an `AvatarPickerButton`'s `onPick`. */
  upload: (photo: PickedPhoto) => Promise<void>;
  /** Why the last upload failed, in words to show, or `null` when it did not. */
  error: string | null;
}

/**
 * Uploads a picked photo to `/avatars/:personId`. The avatar endpoint is a
 * plain multipart POST rather than a GraphQL mutation, so it carries the bearer
 * token itself, and the caller refetches once it resolves.
 *
 * @param personId - Whose avatar this is.
 * @param onUploaded - Called after the server has stored the file.
 * @returns The upload handler and the last failure.
 */
export function useAvatarUpload(personId: string, onUploaded: () => void): AvatarUpload {
  const [error, setError] = useState<string | null>(null);

  const upload = async (photo: PickedPhoto) => {
    const formData = new FormData();
    formData.append('file', photo.part, photo.name);
    // A rejected fetch is the network failing; a response that is not ok is the server refusing.
    const response = await fetch(avatarUploadUrl(personId), {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    }).catch(() => null);

    const isStored = response?.ok === true;
    if (isStored === false) {
      setError(UPLOAD_FAILED);
      return;
    }

    setError(null);
    onUploaded();
  };

  return { upload, error };
}
