/** A photo picked to become a person's avatar. */
export interface PickedPhoto {
  /** The file's name, which the server reads the image type from. */
  name: string;
  /** The file as a form part, in the shape the platform it was picked on uploads. */
  part: Blob;
}

/** The image types the avatar endpoint accepts, in the form a file picker's `accept` takes. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
