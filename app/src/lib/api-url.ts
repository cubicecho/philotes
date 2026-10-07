/**
 * Where the server is. Empty when the app is served by the server itself, so paths stay relative;
 * set `EXPO_PUBLIC_API_URL` when the app runs on another origin, such as a device build.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * The address of a stored avatar. The server stores the path with its `/avatars/` prefix, so it
 * is used as it is and only the origin is added.
 *
 * @param avatarPath - The path as the API returns it, such as `/avatars/<name>.png`.
 * @returns The URL to load the image from.
 */
export function avatarUrl(avatarPath: string): string {
  return `${API_URL}${avatarPath}`;
}
