import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "@/components/ui/icons";
import type { SlotNode } from "@/lib/utils";

type ErrorPageProps = {
  error: unknown;
  reset: () => void;
  /**
   * Turns a thrown value into a line worth reading. The default recognises the
   * two failures every networked app has; extend it with the ones yours has
   * rather than letting a stack-trace message reach the screen.
   */
  describe?: (error: unknown) => string;
  /**
   * The heading. The default fits a failed fetch and a render crash alike,
   * which is why it is not "Failed to load" — a boundary catches both.
   */
  title?: string;
  /**
   * The raw message, in a muted monospace block the user can select and paste
   * into a bug report. `true` shows `error.message`; a node replaces the block's
   * contents. Left out when it would say exactly what `describe` already said.
   * Selectable on device too (`selectable`), where text is not by default. The
   * block is bordered rather than filled: muted text on `bg-foreground/10` fails contrast.
   */
  details?: ReactNode | boolean;
  /** More buttons beside "Try again" — a reload is the usual one. */
  actionSlot?: SlotNode;
  /** @deprecated Use `actionSlot`; this name goes in the next release. `actionSlot` wins. */
  actionsSlot?: SlotNode;
};

function friendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("network")
    ) {
      return "Could not reach the server. Check your connection and try again.";
    }
    if (error.message.includes("Not authenticated")) {
      return "Your session has expired. Please sign in again.";
    }
    return error.message;
  }
  return "An unexpected error occurred.";
}

/** What `details={true}` shows: the message as thrown, for whoever files the bug. */
function rawMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message || undefined;
  }
  if (typeof error === "string") {
    return error || undefined;
  }
  return undefined;
}

/**
 * The whole-screen message shown when the tree below a route has thrown. `actionsSlot` is the old
 * name of `actionSlot`, kept for one release; the new name wins when both are passed.
 */
export function ErrorPage({
  error,
  reset,
  describe = friendlyMessage,
  title = "Something went wrong",
  details,
  actionSlot,
  actionsSlot,
}: ErrorPageProps) {
  const actions = actionSlot ?? actionsSlot;
  const summary = describe(error);
  const detail = details === true ? rawMessage(error) : details || undefined;
  // A plain `Error` is described by its own message, so the default block would print it twice.
  const shown = detail === summary ? undefined : detail;

  return (
    <View
      role="alert"
      testID="error-page"
      className="flex-1 items-center justify-center gap-4 px-8 py-20"
    >
      <View className="rounded-full bg-negative/10 p-4">
        <CircleAlert className="h-7 w-7 text-negative" />
      </View>
      {/* One width for the text and the details under it, not two centred columns. The title is
          the screen's heading: `role`/`aria-level` because an `<h1>` has no native counterpart. */}
      <View className="max-w-md items-center">
        <Text
          testID="error-page-title"
          role="heading"
          aria-level={1}
          className="font-semibold text-foreground"
        >
          {title}
        </Text>
        <Text className="mt-1 text-center text-sm text-foreground/60">{summary}</Text>
      </View>
      {shown ? (
        <View
          testID="error-page-details"
          className="w-full max-w-md rounded-md border border-foreground/10 px-3 py-2"
        >
          {typeof shown === "string" ? (
            <Text
              {...(Platform.OS === "web" ? {} : { selectable: true })}
              className="font-mono text-xs text-foreground/60"
            >
              {shown}
            </Text>
          ) : (
            shown
          )}
        </View>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onPress={reset} content="Try again" />
        {actions}
      </View>
    </View>
  );
}

/** @deprecated Use `ErrorPage`; this name goes in the next release. */
export const RouteError = ErrorPage;
