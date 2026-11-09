import { AccessibilityInfo, Platform } from "react-native";

/** Has VoiceOver say `message`, now when `interrupt`, or after what it is saying. */
export function announceToast(message: string, interrupt: boolean): void {
  if (Platform.OS !== "ios") {
    return;
  }
  if (interrupt) {
    AccessibilityInfo.announceForAccessibility(message);
    return;
  }
  AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
}
