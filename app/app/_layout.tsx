import { ApolloProvider } from '@apollo/client';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteError } from '@/components/route-error';
import { Button } from '@/components/ui/button';
import { PaletteProvider, useThemePreference } from '@/components/ui/theme-preference';
import { client } from '@/lib/apollo';
import '../global.css';

/** Fills the screen. A style, because the safe area view is not one of the views a class name reaches. */
const SAFE_AREA = { flex: 1 } as const;

/** The root layout: the theme, the palette and the Apollo client around every route. */
export default function RootLayout() {
  // `public/index.html` has already painted the right theme; this keeps it that
  // way on every screen, not only Settings, and repaints a `system` user when
  // the OS switches between light and dark.
  useThemePreference();

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
