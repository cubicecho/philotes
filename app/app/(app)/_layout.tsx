import { Redirect, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppShell } from '@/components/layouts/app-shell';
import { isAuthenticated } from '@/lib/auth';

/** The signed-in area: the app shell around its routes, or a redirect to /login when there is no token. */
export default function AppLayout() {
  // The token lives in localStorage, which the first render cannot read during
  // hydration — so decide after mount rather than redirecting a signed-in user
  // to /login for one frame.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setSignedIn(isAuthenticated());
  }, []);

  if (signedIn === null) {
    return <View className="flex-1 bg-background" />;
  }
  const isSignedOut = signedIn === false;
  if (isSignedOut) {
    return <Redirect href="/login" />;
  }

  return <AppShell contentSlot={<Slot />} />;
}
