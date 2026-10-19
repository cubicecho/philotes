import { Redirect, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppShell } from '@/components/layouts/app-shell';
import { useContactIntents } from '@/hooks/use-contact-intents';
import { usePhoneLogScan } from '@/hooks/use-phone-log-scan';
import { isAuthenticated } from '@/lib/auth';

/** Acts on the contact intents another app sends: only once someone is signed in, so it is its own part. */
function ContactIntents() {
  useContactIntents();
  return null;
}

/** The signed-in area: the app shell around its routes, or a redirect to /login when there is no token. */
export default function AppLayout() {
  // In a browser the token lives in localStorage, which the first render cannot
  // read during hydration — so decide after mount rather than redirecting a
  // signed-in user to /login for one frame.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setSignedIn(isAuthenticated());
  }, []);
  // Reads the call log and texts the user turned on, each time the signed-in app is opened.
  usePhoneLogScan();

  if (signedIn === null) {
    return <View className="flex-1 bg-background" />;
  }
  const isSignedOut = signedIn === false;
  if (isSignedOut) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <ContactIntents />
      <AppShell contentSlot={<Slot />} />
    </>
  );
}
