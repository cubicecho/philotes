import { ApolloProvider } from '@apollo/client';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteError } from '@/components/route-error';
import { Button } from '@/components/ui/button';
import { PaletteProvider, useThemePreference } from '@/components/ui/theme-preference';
import { client, RESTORES_CACHE, restoreCachedData } from '@/lib/apollo';
import '../global.css';

/** Fills the screen. A style, because the safe area view is not one of the views a class name reaches. */
const SAFE_AREA = { flex: 1 } as const;

if (RESTORES_CACHE) {
  // The splash screen stays up while the cache is read back, so the first screen drawn has its data.
  SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
    console.error('Could not hold the splash screen', error);
  });
}

/**
 * Fills the cache from the device's copy before anything reads it.
 *
 * @returns Whether the cache is ready. Always true in a browser, which keeps no copy.
 */
function useRestoredCache(): boolean {
  const [isReady, setIsReady] = useState(RESTORES_CACHE === false);

  useEffect(() => {
    if (RESTORES_CACHE === false) {
      return;
    }
    let isMounted = true;
    void restoreCachedData().then(() => {
      if (isMounted) {
        setIsReady(true);
      }
      SplashScreen.hide();
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return isReady;
}

/** The root layout: the theme, the palette and the Apollo client around every route. */
export default function RootLayout() {
  // `public/index.html` has already painted the right theme; this keeps it that
  // way on every screen, not only Settings, and repaints a `system` user when
  // the OS switches between light and dark.
  useThemePreference();
  const isCacheReady = useRestoredCache();

  if (isCacheReady === false) {
    // A query that ran now would miss the stored copy and paint an empty page over it.
    return null;
  }

  return (
    <PaletteProvider>
      <ApolloProvider client={client}>
        {/* On a phone the app draws under the status bar and the navigation bar; this keeps it clear of both. */}
        <View className="flex-1 bg-background">
          <SafeAreaView style={SAFE_AREA}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
          </SafeAreaView>
        </View>
      </ApolloProvider>
    </PaletteProvider>
  );
}

/**
 * The last thing between a thrown render and a white page. Expo Router wraps
 * every route in this named export; it sits outside the providers above, so it
 * uses nothing that needs Apollo.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="h-full flex-1 bg-background">
      <SafeAreaView style={SAFE_AREA}>
        <RouteError
          error={error}
          reset={() => void retry()}
          details
          // Only a browser has a page to load again; on a device "Try again" is the way back.
          actionsSlot={
            Platform.OS === 'web' ? (
              <Button variant="outline" size="sm" onPress={() => window.location.reload()} content="Reload" />
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}
