import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { type ContactIntent, ContactIntentAction, contactIntentHref } from '@/lib/contact-intent';
import { onContactIntent, takeLaunchIntent } from '@/lib/contacts-native';

/**
 * Sends the app where a contact intent asks: edit a contact, add one, or pick one. Mounted in the
 * signed-in layout, so a signed-out user is asked to sign in and the intent is dropped.
 *
 * A VIEW intent is left alone: React Native's `Linking` hands it to the router, and
 * `app/app/+native-intent.tsx` rewrites it.
 */
export function useContactIntents(): void {
  const router = useRouter();

  useEffect(() => {
    const go = (intent: ContactIntent | null): void => {
      const isLinkingOwn = intent === null || intent.action === ContactIntentAction.View;
      if (isLinkingOwn) {
        return;
      }
      const href = contactIntentHref(intent);
      if (href) {
        router.push(href);
      }
    };
    go(takeLaunchIntent());
    return onContactIntent(go);
  }, [router]);
}
