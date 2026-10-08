import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { WifiOff } from '@/components/app-icons';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { probeServer, useIsOffline } from '@/lib/connection';
import { CONNECTION_DEFAULTS } from '@/lib/defaults';

/**
 * Says the server cannot be reached, over every page, for as long as that is so. While it shows, it
 * keeps asking whether the server is back: on a timer, and whenever the app returns to the front.
 */
export function OfflineBanner() {
  const isOffline = useIsOffline();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOffline === false) {
      return;
    }
    const timer = setInterval(() => void probeServer(), CONNECTION_DEFAULTS.probeIntervalMs);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void probeServer();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [isOffline]);

  if (isOffline === false) {
    return null;
  }

  /** Asks now, for someone who has just fixed their connection. */
  async function checkNow() {
    setIsChecking(true);
    await probeServer();
    setIsChecking(false);
  }

  return (
    <View className="px-4 pt-3">
      <Alert
        variant="warning"
        iconSlot={<WifiOff />}
        title="You're offline"
        description="The server can't be reached. You can read what is already here; changes can be saved once it is back."
        actionSlot={
          <Button
            variant="outline"
            size="sm"
            content="Try again"
            loading={isChecking}
            onPress={() => void checkNow()}
          />
        }
      />
    </View>
  );
}
