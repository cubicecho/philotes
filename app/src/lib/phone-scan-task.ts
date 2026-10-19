import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { PHONE_LOG_DEFAULTS } from '@/lib/defaults';
import { CAN_READ_PHONE_LOG, isAnyPhoneSourceEnabled, scanPhoneSources } from '@/lib/phone-scan';

// The periodic scan, run by Android's WorkManager through `expo-background-task` while the app is closed.
// The task is defined when this module is imported, which the root layout does, so it exists whenever
// the bundle runs: Android may start the bundle for the task alone. `.web.ts` is the browser's half.

const PHONE_SCAN_TASK = 'philotes-phone-log-scan';

if (CAN_READ_PHONE_LOG) {
  TaskManager.defineTask(PHONE_SCAN_TASK, async () => {
    try {
      await scanPhoneSources();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error: unknown) {
      console.error('[phone-log] The background scan failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Registers the background scan while any source is on, and takes it away once none is.
 *
 * @returns Once the registration matches the settings.
 */
export async function syncBackgroundScan(): Promise<void> {
  if (CAN_READ_PHONE_LOG === false) {
    return;
  }
  const isRegistered = await TaskManager.isTaskRegisteredAsync(PHONE_SCAN_TASK);
  const isWanted = isAnyPhoneSourceEnabled();
  if (isWanted && isRegistered === false) {
    await BackgroundTask.registerTaskAsync(PHONE_SCAN_TASK, {
      minimumInterval: PHONE_LOG_DEFAULTS.backgroundIntervalMinutes,
    });
  }
  const isUnwanted = isWanted === false;
  if (isUnwanted && isRegistered) {
    await BackgroundTask.unregisterTaskAsync(PHONE_SCAN_TASK);
  }
}
