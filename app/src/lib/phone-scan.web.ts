import type { PhoneSource } from '@/lib/phone-log';

// The browser's half of `phone-scan.ts`: a browser has no call log or texts, so every source stays off
// and Settings shows no switch for them.

/** A browser cannot read a call log. */
export const CAN_READ_PHONE_LOG = false;

/**
 * Whether the user turned a source on.
 *
 * @param _source - The source.
 * @returns Always false.
 */
export function isPhoneSourceEnabled(_source: PhoneSource): boolean {
  return false;
}

/**
 * Whether any source is on.
 *
 * @returns Always false.
 */
export function isAnyPhoneSourceEnabled(): boolean {
  return false;
}

/**
 * Leaves the source off.
 *
 * @param _source - The source.
 * @returns Always false.
 */
export async function enablePhoneSource(_source: PhoneSource): Promise<boolean> {
  return false;
}

/**
 * Does nothing.
 *
 * @param _source - The source.
 */
export function disablePhoneSource(_source: PhoneSource): void {}

/** What a scan did. */
export interface PhoneScanSummary {
  logged: number;
}

/**
 * Reads nothing.
 *
 * @returns Nothing logged.
 */
export async function scanPhoneSources(): Promise<PhoneScanSummary> {
  return { logged: 0 };
}
