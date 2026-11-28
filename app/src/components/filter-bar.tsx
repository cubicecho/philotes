import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { actionGap, cn, hasSlot, type SlotNode } from "@/lib/utils";

type FilterBarProps = {
  /**
   * The filter controls — a `SearchInput`, a `Combobox` or two, `ToggleChip`s — laid out in a row
   * that wraps onto a second line when the bar is too narrow for them. Give each control a width:
   * a search box and a select are full width by default, and in a row one would take the line.
   */
  contentSlot: SlotNode;
  /**
   * One muted line on what the filters leave: "12 of 40 runs", "No todos match". Announced
   * politely as it changes, so a screen reader hears the count after each keystroke settles.
   * Drawn at the far end, before `actionSlot`.
   */
  status?: string | undefined;
  /**
   * Whether any filter is set, which is when the Clear filters button shows. The caller's to
   * say, never worked out here: an unfiltered bar has no button to press.
   */
  isFiltered?: boolean | undefined;
  /** Puts every filter back. With `isFiltered`, it is what the Clear filters button calls. */
  onClear?: (() => void) | undefined;
  /**
   * The clear button's label.
   *
   * @defaultValue "Clear filters"
   */
  clearLabel?: string | undefined;
  /** The far end: what acts on the list itself rather than filtering it — a view toggle, an Export. */
  actionSlot?: SlotNode;
  /** On the bar, the wrapping row. */
  className?: string | undefined;
};

/**
 * The row of filters over a list, with a count and a Clear filters button while one is set.
 *
 * @param props - The controls, what they leave, and how to clear them.
 * @returns The bar.
 */
export function FilterBar({
  contentSlot,
  status,
  isFiltered = false,
  onClear,
  clearLabel = "Clear filters",
  actionSlot,
  className,
}: FilterBarProps) {
  const hasStatus = hasSlot(status);
  const hasActions = hasSlot(actionSlot);
  const canClear = isFiltered && onClear !== undefined;

  return (
    <View
      testID="filter-bar"
      className={cn("min-w-0 flex-row flex-wrap items-center gap-2", className)}
    >
      {contentSlot}
      {canClear ? <Button variant="outline" onPress={onClear} content={clearLabel} /> : null}
      {/* A live region is read only once it is in the tree, so the box is always drawn; while it
          is empty it is taken out of the row's flow, so it costs the row no gap. */}
      <View
        testID="filter-bar-status"
        role="status"
        aria-live="polite"
        className={hasStatus ? "ms-auto min-w-0" : "absolute"}
      >
        {hasStatus ? <Text className="text-foreground/60 text-sm">{status}</Text> : null}
      </View>
      {hasActions ? (
        <View
          testID="filter-bar-actions"
          className={cn(
            "flex-row flex-wrap items-center",
            actionGap(actionSlot),
            hasStatus === false && "ms-auto",
          )}
        >
          {actionSlot}
        </View>
      ) : null}
    </View>
  );
}
