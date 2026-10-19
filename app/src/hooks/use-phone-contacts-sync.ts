import { useQuery } from '@apollo/client';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { isPhoneContactsSupported, refreshPhoneContactsSync, requestPhoneContactsRefresh } from '@/lib/phone-contacts';

/** The signed-in user's email, which names the phone's contacts account. */
export const PHONE_CONTACTS_USER = graphql(`
  query PhoneContactsUser {
    user {
      id
      email
    }
  }
`);

/**
 * Keeps the phone's contacts account in step while the app is signed in: it gets the current session
 * when the app opens, and a sync whenever the app goes to the background, so what was changed in the app
 * reaches the phone's contacts without waiting for Android's own schedule. Does nothing off Android.
 */
export function usePhoneContactsSync(): void {
  const isSupported = isPhoneContactsSupported();
  const { data } = useQuery(PHONE_CONTACTS_USER, { skip: isSupported === false });
  const email = data?.user?.email ?? null;

  useEffect(() => {
    if (email === null) {
      return;
    }
    refreshPhoneContactsSync(email).catch((error: unknown) => {
      console.error('Could not bring the phone’s contacts account up to date', error);
    });
  }, [email]);

  useEffect(() => {
    if (isSupported === false) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        requestPhoneContactsRefresh();
      }
    });
    return () => subscription.remove();
  }, [isSupported]);
}
