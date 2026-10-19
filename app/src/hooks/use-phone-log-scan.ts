import { useEffect } from 'react';
import { AppState } from 'react-native';
import { CAN_READ_PHONE_LOG, scanPhoneSources } from '@/lib/phone-scan';
import { syncBackgroundScan } from '@/lib/phone-scan-task';

/** Scans the phone's call log and texts, and keeps the background scan registered to match the settings. */
function scanNow(): void {
  scanPhoneSources().catch((error: unknown) => {
    console.error('[phone-log] The scan failed', error);
  });
  syncBackgroundScan().catch((error: unknown) => {
    console.error('[phone-log] Could not schedule the background scan', error);
  });
}

/**
 * Scans the sources the user turned on whenever the app is opened or brought back to the front. Does
 * nothing on a device that cannot read them, or when every source is off.
 */
export function usePhoneLogScan(): void {
  useEffect(() => {
    if (CAN_READ_PHONE_LOG === false) {
      return;
    }
    scanNow();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scanNow();
      }
    });
    return () => subscription.remove();
  }, []);
}
