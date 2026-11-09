import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CircleAlert } from "@/components/ui/icons";
import { describeError } from "@/lib/error-message";
import type { SlotNode } from "@/lib/utils";

type ErrorPageProps = {
  /** What was thrown, as the boundary caught it: an `Error`, a string, anything at all. */
  error: unknown;
  /** What Try again calls: the boundary's reset, which draws the tree below it again. */
  reset: () => void;
  /**
   * Turns a thrown value into a line worth reading. Without it the line is
   * `describeError`'s (`@cubeui/error-message`), the same as `LoadError`'s: it
   * knows the two failures every networked app has. Extend it with the ones
   * yours has, handing the rest to `describeError`, rather than letting a
   * stack-trace message reach the screen. An empty answer hands the error on.
   */
  describe?: (error: unknown) => string;
  /**
   * The heading, and the screen's `h1`. The default fits a failed fetch and a
   * render crash alike, which is why it is not "Failed to load" — a boundary
   * catches both. 16px, as every empty block's title is at any rank.
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
  describe,
  title = "Something went wrong",
  details,
  actionSlot,
  actionsSlot,
}: ErrorPageProps) {
  const actions = actionSlot ?? actionsSlot;
  const summary = describe?.(error) || describeError(error);
  const detail = details === true ? rawMessage(error) : details || undefined;
  // A plain `Error` is described by its own message, so the default block would print it twice.
  const shown = detail === summary ? undefined : detail;

  // `flex-1` and a side inset because it is the whole screen, with no page around it to give it
  // either; every other size is the empty block's.
  return (
    <Empty role="alert" testID="error-page" className="flex-1 px-4">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-negative/10">
          <CircleAlert className="text-negative" />
        </EmptyMedia>
        <EmptyTitle testID="error-page-title" level={1}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{summary}</EmptyDescription>
      </EmptyHeader>
      {/* The details are as wide as the description's cap, so the text and the block under it are
          one column rather than two centred ones. */}
      <EmptyContent>
        {shown ? (
          <View
            testID="error-page-details"
            className="w-full rounded-md border border-foreground/10 px-3 py-2"
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
      </EmptyContent>
    </Empty>
  );
}

/** @deprecated Use `ErrorPage`; this name goes in the next release. */
export const RouteError = ErrorPage;
