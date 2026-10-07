import { ApolloProvider } from '@apollo/client';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { View } from 'react-native';
import { RouteError } from '@/components/route-error';
import { Button } from '@/components/ui/button';
import { PaletteProvider, useThemePreference } from '@/components/ui/theme-preference';
import { client } from '@/lib/apollo';
import '../global.css';

/** The root layout: the theme, the palette and the Apollo client around every route. */
export default function RootLayout() {
  // `public/index.html` has already painted the right theme; this keeps it that
  // way on every screen, not only Settings, and repaints a `system` user when
  // the OS switches between light and dark.
  useThemePreference();

  return (
    <PaletteProvider>
      <ApolloProvider client={client}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
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
      <RouteError
        error={error}
        reset={() => void retry()}
        details
        actionsSlot={<Button variant="outline" size="sm" onPress={() => window.location.reload()} content="Reload" />}
      />
    </View>
  );
}
