// The browser's half of `phone-scan-task.ts`: a browser has no call log, so there is nothing to schedule.

/**
 * Does nothing: a browser reads no call log.
 *
 * @returns At once.
 */
export async function syncBackgroundScan(): Promise<void> {}
