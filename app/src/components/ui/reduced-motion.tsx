import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

let reduced = false;
const listeners = new Set<() => void>();
let subscription: { remove: () => void } | null = null;

function publish(value: boolean) {
  reduced = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (subscription === null) {
    subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", publish);
    // Asked again on every first subscriber: the setting may have changed while nothing listened.
    AccessibilityInfo.isReduceMotionEnabled().then(publish);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

/**
 * `true` when the reader has turned on Reduce Motion (iOS) or Remove animations (Android), kept up
 * to date as they change it. `false` until the system has answered, a frame or so after mount.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reduced,
    () => false,
  );
}
