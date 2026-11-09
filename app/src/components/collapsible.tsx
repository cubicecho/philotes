import type { ReactNode } from "react";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { ChevronRight } from "@/components/ui/icons";
import {
  actionGap,
  cn,
  HEADING_DESCRIPTION,
  HEADING_GAP,
  HEADING_TITLE,
  HEADING_WRAP_FLOOR,
  HEADING_WRAP_GAP,
  hasSlot,
  type SlotNode,
  touchRowClass,
} from "@/lib/utils";

type CollapsibleProps = {
  /**
   * What the button says: "Completed (3)", "Raw output". It is the button's accessible name. A
   * string is drawn as the title; an element is placed as it is and styles itself.
   */
  title: ReactNode;
  /** One line under the title, inside the button, drawn whether open or shut. */
  description?: ReactNode | undefined;
  /**
   * The header's far end, **outside** the button: a copy button, a count, a clear-all. A control
   * nested in a button is invalid HTML and, in practice, a click that also toggles the section.
   */
  actionSlot?: SlotNode | undefined;
  /** What opening shows. Not mounted while shut, so a long list behind it costs nothing. */
  contentSlot?: SlotNode | undefined;
  /**
   * Whether it is open, when the caller holds that — a deep link, a "show the failure" button
   * elsewhere, a title that reads "Hide" once open. Leave it out and the collapsible holds its own.
   */
  open?: boolean | undefined;
  /** Told on every toggle, controlled or not. Given alone, it listens without taking over. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Where an uncontrolled collapsible starts. Shut by default, the way `<details>` is. */
  defaultOpen?: boolean | undefined;
  /** On the whole collapsible, the header and what it opens onto together. */
  className?: string | undefined;
  /** On the header row: the chevron, the title and description, and the action. */
  headerClassName?: string | undefined;
  /** On a string title's own `Text`: its size, its colour. */
  titleClassName?: string | undefined;
  /** On the box that holds `contentSlot`, indented under the title. */
  contentClassName?: string | undefined;
};

/**
 * A string gets a `Text` around it; an element is placed as it is, because a `View` inside a
 * `Text` lays out inline on device and loses most of its own styling.
 */
function asText(node: ReactNode, className: string, testID: string) {
  return typeof node === "string" || typeof node === "number" ? (
    <Text testID={testID} className={className}>
      {node}
    </Text>
  ) : (
    node
  );
}

type CollapsibleTriggerProps = {
  /** Whether what it opens is showing: `aria-expanded`, and which way the chevron points. */
  open: boolean;
  onPress: () => void;
  /**
   * The `nativeID` of the body it opens, given only while that body is mounted. It becomes
   * `aria-controls` on the web; React Native has none, and an id that is not in the document is a
   * broken reference rather than a hint.
   */
  controls?: string | undefined;
  /** What the button holds after the chevron: a title, or a folder's icon and name. */
  contentSlot: SlotNode;
  testID: string;
  className?: string | undefined;
  chevronClassName?: string | undefined;
  /** A style the row sets itself, such as a tree's indent. */
  style?: { paddingLeft: number } | undefined;
  /** Further props for the web's button only, such as what lets a folder be dragged. */
  webProps?: object | undefined;
};

/**
 * The button that opens and shuts something, for `Collapsible`, `CollapsibleRow` and `FileTree`'s
 * folders: a chevron that turns down while open, then `contentSlot`, with `aria-expanded` and,
 * while the body is there, `aria-controls`. Anything else on the row sits beside it, because a
 * button in a button is invalid.
 */
export function CollapsibleTrigger({
  open,
  onPress,
  controls,
  contentSlot,
  testID,
  className,
  chevronClassName,
  style,
  webProps,
}: CollapsibleTriggerProps) {
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-expanded={open}
      accessibilityState={{ expanded: open }}
      {...(Platform.OS === "web" && controls !== undefined ? { "aria-controls": controls } : {})}
      onPress={onPress}
      className={cn(
        "min-w-0 flex-1 flex-row items-start gap-2 rounded-sm",
        Platform.select({
          // Under the pointer as focused: hovered, and no ring.
          web: "text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
          // Pressed looks hovered, as a row's pressed part does.
          default: "active:bg-hover",
        }),
        className,
      )}
      style={style}
      {...webProps}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0 text-foreground/60",
          Platform.select({
            web: "transition-transform motion-reduce:transition-none",
            default: undefined,
          }),
          open && "rotate-90",
          chevronClassName,
        )}
      />
      {contentSlot}
    </Pressable>
  );
}

/**
 * A titled part of a screen whose body shows and hides: "Show completed (3)" under a list. The
 * heading is the rhythm every block and row shares — a 14px semibold title, a quieter line of the
 * same size under it, the action level with the title's top — with the chevron before it.
 *
 * The whole header is one `CollapsibleTrigger`, and `actionSlot` sits outside it, because a button
 * in a button is invalid. Open is uncontrolled with `defaultOpen` or controlled with `open`, and
 * `onOpenChange` is heard either way.
 */
export function Collapsible({
  title,
  description,
  actionSlot,
  contentSlot,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  className,
  headerClassName,
  titleClassName,
  contentClassName,
}: CollapsibleProps) {
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const contentId = React.useId();
  const shown = open && hasSlot(contentSlot);

  const toggle = () => {
    if (openProp === undefined) {
      setOwnOpen(!open);
    }
    onOpenChange?.(!open);
  };

  // On device the button is a finger's 44pt tall (#470). A title alone is one line, which sits in
  // the middle of that, and the action with it; a title over a description already fills it.
  const centred = Platform.OS !== "web" && (description === undefined || description === null);

  return (
    <View testID="collapsible" className={cn("min-w-0 gap-2", className)}>
      <View
        testID="collapsible-header"
        // The rhythm's wrap: the action drops under the title once the title would have less
        // than the floor beside it.
        className={cn(
          "min-w-0 flex-row flex-wrap items-start gap-x-2",
          centred && "items-center",
          HEADING_WRAP_GAP,
          headerClassName,
        )}
      >
        <CollapsibleTrigger
          testID="collapsible-trigger"
          className={cn(HEADING_WRAP_FLOOR, touchRowClass(), centred && "items-center")}
          open={open}
          onPress={toggle}
          controls={shown ? contentId : undefined}
          contentSlot={
            <View className={cn("min-w-0 flex-1", HEADING_GAP)}>
              {asText(title, cn(HEADING_TITLE, titleClassName), "collapsible-title")}
              {description
                ? asText(description, HEADING_DESCRIPTION, "collapsible-description")
                : null}
            </View>
          }
        />
        {hasSlot(actionSlot) ? (
          <View
            testID="collapsible-action"
            className={cn("shrink-0 flex-row items-center", actionGap(actionSlot))}
          >
            {actionSlot}
          </View>
        ) : null}
      </View>

      {shown ? (
        <View
          testID="collapsible-content"
          nativeID={contentId}
          // Indented to the title (the 16px chevron and its 8px gap), so the body reads as the
          // title's and not as the next thing on the page.
          className={cn("min-w-0 gap-2 pl-6", contentClassName)}
        >
          {contentSlot}
        </View>
      ) : null}
    </View>
  );
}

/** @deprecated Use `Collapsible`; this name goes in the next release. */
export const Disclosure = Collapsible;
/** @deprecated Use `CollapsibleTrigger`; this name goes in the next release. */
export const DisclosureTrigger = CollapsibleTrigger;
