import { hrefToPath, isContactUri, openContactHref } from '@/lib/contact-intent';

/**
 * Rewrites a URL the system opens the app with before the router reads it. "Open contact" sends a
 * `content://com.android.contacts/…` URI, which is no route; it becomes `/contacts/open`.
 *
 * Only VIEW intents reach here, as React Native's `Linking` reads no other action. Edit, insert and
 * pick are read from the native module by `useContactIntents`.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return isContactUri(path) ? hrefToPath(openContactHref(path)) : path;
}
