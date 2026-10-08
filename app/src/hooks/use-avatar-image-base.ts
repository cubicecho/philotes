/** What an `Image` is given to draw a stored avatar. */
export interface AvatarSource {
  uri: string;
  /** Sent with the request for the image, where the platform's image loader can send any. */
  headers?: Record<string, string>;
}
