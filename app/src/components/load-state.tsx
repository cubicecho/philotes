import { useState } from "react";
import { Text, View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, TriangleAlert } from "@/components/ui/icons";
import { cn, type SlotNode } from "@/lib/utils";

/** What a list screen needs off its query, and nothing more. */
type QueryLike = {
  isPending: boolean;
  isError: boolean;
  /**
   * `unknown` because that is what a failure is: TanStack types it `Error | null`, Apollo hands
   * over its own error class, and a thrown string is still a throw. An `Error | null` fits.
   */
  error: unknown;
  refetch: () => unknown;
};

/** What a failure says when neither the caller nor the error has anything to say. */
const FALLBACK = "The server did not answer.";

/**
 * The error's own `message`, which is the transport's wording rather than the app's. Empty when it
 * has none, so the caller's `|| FALLBACK` speaks; the forms' `messageOf` prints the value instead.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message: unknown };
    if (typeof message === "string") {
      return message;
    }
  }
  return "";
}

const settles = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function";

/** What every screen passes, whether it draws a list or one record. */
type LoadStateCommon = {
  query: QueryLike;
  /** What could not be fetched, in the reader's words: "your agents", "the archive". */
  what: string;
  /** How many placeholder rows stand in for the list while it loads. */
  rows?: number | undefined;
  /**
   * The rungs drawn small enough for a rail: the failure as two lines and a text-sized retry, and
   * the placeholders as bars the height of a nav row rather than cards. For a list that lives in a
   * sidebar, where a card-sized error would be taller than the list it replaced.
   */
  compact?: boolean | undefined;
  /** What the failure means, in the app's words — handed through to `LoadError`. */
  describe?: ((error: unknown) => string) | undefined;
  className?: string | undefined;
};

/** A list screen: the last rung is empty. */
type LoadStateList = {
  /**
   * How many rows the screen is about to draw. Pass this or `record`.
   *
   * Passed rather than derived, because the rows a screen draws are usually a filtered or paged
   * view of what came back: an empty *result* and an empty *view* are different states, and only
   * the screen knows which one it is showing.
   */
  count: number;
  /** What to say when there are none — whatever invites the first one. */
  emptySlot?: SlotNode | undefined;
  record?: never;
  notFoundLabel?: never;
  level?: never;
};

/** A detail screen: the last rung is a record that is not there. */
type LoadStateRecord = {
  /**
   * The one record the screen asked for, once the query has answered. `null` or `undefined` is a
   * record that is not there. Pass this or `count`.
   */
  record: unknown;
  /**
   * What the screen says when `record` is not there: "Project not found". It is drawn as the
   * screen's heading — an `EmptyState` with the Search icon, at `level` — because the whole screen
   * is that state.
   */
  notFoundLabel: string;
  /**
   * Which heading `notFoundLabel` is. `1`, the default, is a guard that is the whole screen. `2` is
   * a guard inside a page that already has its level-1 title — a `PageLayout`'s body — so the
   * page does not have two `h1`s. The size is the same at every level.
   */
  level?: 1 | 2 | 3 | undefined;
  count?: never;
  emptySlot?: never;
};

export type LoadStateProps = LoadStateCommon & (LoadStateList | LoadStateRecord);

/**
 * Draws a query's failed, loading or empty state, and nothing once there is something to draw.
 *
 * A detail screen passes `record` and `notFoundLabel` instead of `count`, and the last rung is
 * then "not found" rather than "empty".
 */
export function LoadState({
  query,
  what,
  count,
  emptySlot,
  record,
  notFoundLabel,
  level = 1,
  rows = 3,
  compact = false,
  describe,
  className,
}: LoadStateProps) {
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        onRetry={() => query.refetch()}
        what={what}
        compact={compact}
        {...(describe === undefined ? {} : { describe })}
        {...(className === undefined ? {} : { className })}
      />
    );
  }
  if (query.isPending) {
    return (
      <RowSkeleton
        rows={rows}
        compact={compact}
        {...(className === undefined ? {} : { className })}
      />
    );
  }
  if (notFoundLabel !== undefined) {
    if (record !== null && record !== undefined) {
      return null;
    }
    return compact ? (
      <EmptyState
        compact
        title={notFoundLabel}
        {...(className === undefined ? {} : { className })}
      />
    ) : (
      <EmptyState
        icon={Search}
        title={notFoundLabel}
        level={level}
        {...(className === undefined ? {} : { className })}
      />
    );
  }
  if (count === 0) {
    return <>{emptySlot}</>;
  }
  return null;
}

/**
 * A request that failed, said out loud.
 *
 * Its own export because a screen that draws one object rather than a list needs this rung and
 * neither of the others. It is also the rung most often left out entirely: with retries off, a
 * failed query stays failed, and a screen that renders a failure as an absence tells somebody
 * whose server has gone away that they have no data — which is an invitation to rebuild
 * something that is fine.
 *
 * The retry is awaited when it hands back a promise, as every refetch does: the button is disabled
 * and says "Retrying…" until it settles, so a second press does not stack a second request on a
 * slow server, and a rejected refetch is caught here rather than escaping as an unhandled
 * rejection. What the retry failed with is the query's to report, not the button's.
 *
 * The root is `role="alert"` in both forms — the counterpart of the loading rung's `role="status"`.
 * An alert rather than a polite live region, because it replaces the content the reader asked for:
 * somebody who triggered a load and cannot see the screen hears that it failed, rather than finding
 * the card later by moving through the page.
 */
export function LoadError({
  error,
  onRetry,
  what,
  compact = false,
  describe,
  className,
}: {
  error: unknown;
  /** A promise returned here is awaited — see above. */
  onRetry: () => unknown;
  what: string;
  /** No card, smaller type, a small outline retry — see `LoadState`'s `compact`. */
  compact?: boolean | undefined;
  /**
   * What the failure means, in the app's words. Without it the line under the heading is the
   * error's own `message` — the transport's wording, "Failed to fetch" or "Received status code
   * 401" — which is right for a bug report and wrong for somebody whose session has expired.
   */
  describe?: ((error: unknown) => string) | undefined;
  className?: string | undefined;
}) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    const result = onRetry();
    if (settles(result) === false) {
      return;
    }
    setRetrying(true);
    Promise.resolve(result)
      .catch(() => {})
      .finally(() => setRetrying(false));
  };
  const reason = (describe ?? messageOf)(error) || FALLBACK;
  const label = retrying ? "Retrying…" : "Try again";

  // The same three parts — what failed, why, try again — at the size of a nav row. No card, since a
  // bordered box inside a rail reads as one more row, and the retry is a small outline button so the rail's
  // only filled control stays the primary action above it.
  if (compact) {
    return (
      <View role="alert" testID="load-error" className={cn("min-w-0 gap-1 px-2 py-1", className)}>
        <View className="min-w-0 flex-row items-center gap-1.5">
          <TriangleAlert className="size-4 shrink-0 text-negative" aria-hidden />
          <Text className="min-w-0 flex-1 font-semibold text-negative text-xs">
            Could not load {what}
          </Text>
        </View>
        <Text className="text-foreground/60 text-xs">{reason}</Text>
        <View className="flex-row">
          <Button
            variant="outline"
            size="xs"
            onPress={retry}
            disabled={retrying}
            iconSlot={<RefreshCw className="size-4" aria-hidden />}
            content={label}
          />
        </View>
      </View>
    );
  }

  // Alert's destructive callout rather than a second error box of its own: the hue on the tint,
  // the edge and the icon, the words in ink (red text on the red tint is under 4.5:1 in light),
  // and Alert's own `role="alert"`.
  return (
    <View testID="load-error" className={cn("min-w-0", className)}>
      <Alert
        variant="destructive"
        title={`Could not load ${what}`}
        description={reason}
        actionSlot={
          <Button
            variant="outline"
            size="sm"
            onPress={retry}
            disabled={retrying}
            iconSlot={<RefreshCw className="size-4" aria-hidden />}
            content={label}
          />
        }
      />
    </View>
  );
}

/**
 * What a list shows before its first answer.
 *
 * Drawn as the row it stands in for — a title bar over a line bar — so the screen does not change
 * shape underneath the reader when the answer lands: a placeholder that matches the row is the
 * point, rather than which component draws it.
 *
 * The placeholders are `aria-hidden` under one `role="status"` saying "Loading", because three
 * cards' worth of placeholder text is three cards' worth of nothing to a screen reader. `main`
 * hung that status off an `sr-only` sibling in a fragment; a fragment has nothing to attach a
 * live region to on device, so the status is the wrapper itself and the announcement is its
 * `aria-label`. That wrapper is the one structural difference from the DOM version, which is why
 * it carries the `gap` the rows would otherwise have taken from their parent.
 *
 * Only ever on `isPending`: a cache-and-network client keeps rendering what it had while it
 * refetches, and putting this behind `isFetching` flashes a skeleton over a perfectly good list.
 */
export function RowSkeleton({
  rows = 3,
  compact = false,
  className,
}: {
  rows?: number | undefined;
  /** Bars the height of a nav row instead of cards — see `LoadState`'s `compact`. */
  compact?: boolean | undefined;
  className?: string | undefined;
}) {
  if (compact) {
    return (
      <View role="status" aria-label="Loading" className={cn("gap-1", className)}>
        {Array.from({ length: rows }, (_, index) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders, in a list with no identity
            key={index}
            testID="row-skeleton"
            aria-hidden
            className="h-8 animate-pulse rounded-md bg-foreground/10"
          />
        ))}
      </View>
    );
  }

  // Bars in the shape of a row, not a bordered card per row: a list of plain rows that loaded as
  // stacked cards jumped to flat rows when the answer landed.
  return (
    <View role="status" aria-label="Loading" className={cn("gap-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders, in a list with no identity
          key={index}
          testID="row-skeleton"
          aria-hidden
          className="gap-2 py-2"
        >
          {/* `animate-pulse` resolves to nothing on device; the compiled web half needs it. */}
          <View className="h-4 w-1/3 animate-pulse rounded-md bg-foreground/10" />
          <View className="h-3 w-2/3 animate-pulse rounded-md bg-foreground/10" />
        </View>
      ))}
    </View>
  );
}

/** @deprecated Use `LoadState`; this name goes in the next release. */
export const QueryState = LoadState;
/** @deprecated Use `LoadStateProps`; this name goes in the next release. */
export type QueryStateProps = LoadStateProps;
/** @deprecated Use `LoadError`; this name goes in the next release. */
export const QueryError = LoadError;
