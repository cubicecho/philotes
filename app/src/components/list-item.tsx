import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { cn, type SlotNode } from "@/lib/utils";

type ListItemProps = {
  /**
   * What the row is: a person's name, a todo's text. A string is one line, truncated when it runs
   * long; an element — a name with a badge beside it — is placed as it is and styles itself.
   */
  title: ReactNode;
  /**
   * The line under the title — an email, the first line of the notes. A string is two lines at
   * most; an element is placed as it is.
   */
  description?: ReactNode | undefined;
  /**
   * The start of the row, before the title: an avatar, a checkbox, an icon. Placed as given — not
   * sized or recoloured the way `iconSlot` is, because a checkbox or an avatar is not a glyph. It
   * sits **outside** the pressed area, so a checkbox here stays its own control.
   */
  leadingSlot?: SlotNode | undefined;
  /**
   * The small grey facts at the row's far end, before `actionSlot`: "2 days ago", "12", a badge. A
   * string is drawn muted and extra small; an element is placed as it is. Inside the pressed area.
   */
  meta?: ReactNode | undefined;
  /**
   * The row's far end, **outside** the pressed area: an edit button, a menu, a delete. One control
   * or a fragment of them. A control nested in a button is invalid HTML and, in practice, a click
   * that also opens the row.
   */
  actionSlot?: SlotNode | undefined;
  /**
   * Makes the row something you press — open the person, edit the todo. The title, description and
   * `meta` become one button between `leadingSlot` and `actionSlot`, so neither of those is nested
   * in it.
   */
  onPress?: (() => void) | undefined;
  /**
   * Where the row goes, for a URL no router owns. The middle is a link — an `<a href>` on the web,
   * so it opens in a new tab and shows its URL on hover — and `onPress` still runs beside it. On
   * device there is no URL to open, so `onPress` is what navigates.
   */
  href?: string | undefined;
  /**
   * The router's link the row is, as an element with no children — `<Link href="/people/1" />` —
   * which the middle is drawn inside, as `Button`'s and `FileTree`'s is. On the web that element
   * *is* the middle, so it stays the router's own `<a>`; on device it is expo-router's `Link`,
   * which takes the middle `asChild`. Given this, `href` and `onPress` are the link's to say.
   */
  linkSlot?: ReactElement | undefined;
  /**
   * The chosen row: the one open beside the list. Tinted in `active`, it stays that under the
   * pointer, and a pressable row says so with `aria-current`.
   */
  selected?: boolean | undefined;
  className?: string | undefined;
  titleClassName?: string | undefined;
};

/**
 * A string on its own is a crash on device, so a string gets a `Text` around it. An element does
 * not: a `View` inside a `Text` lays out inline on device and loses most of its own styling.
 */
function asText(node: ReactNode, className: string, testID?: string) {
  return typeof node === "string" || typeof node === "number" ? (
    <Text testID={testID} className={className}>
      {node}
    </Text>
  ) : (
    node
  );
}

/** The pressed part of a row, whichever of a button or a link it is. */
const BODY_CLASS = cn(
  "min-w-0 flex-1 flex-row items-center gap-3 rounded-sm",
  Platform.select({
    web: "text-left focus-visible:outline-none",
    default: "active:opacity-70",
  }),
);

/**
 * The middle as the router's link. On the web the caller's element *is* the middle — cloned with
 * its classes and what is inside it, so it stays the router's own `<a>`. On device a link is
 * expo-router's, which takes the middle the other way round: given `asChild`, it wraps the
 * `Pressable`.
 */
function bodyLink(link: ReactElement, selected: boolean, body: ReactNode) {
  if (Platform.OS !== "web") {
    return cloneElement(
      link as ReactElement<{ asChild?: boolean }>,
      { asChild: true },
      <Pressable
        testID="list-item-body"
        role="link"
        accessibilityState={{ selected }}
        className={BODY_CLASS}
      >
        {body}
      </Pressable>,
    );
  }

  const element = link as ReactElement<Record<string, unknown>>;
  return cloneElement(
    element,
    {
      "data-slot": "list-item-body",
      className: cn("flex", BODY_CLASS, element.props.className as string | undefined),
      "aria-current": selected ? "page" : undefined,
    },
    body,
  );
}

/**
 * One row of a list: something at the start, a title with a line under it, small facts and
 * buttons at the far end. It draws no surface; the list, card or section around it owns the
 * border.
 *
 * The pressed area is the middle and only the middle, so the row is three siblings
 * (`leadingSlot`, the middle, `actionSlot`) and no button wraps another. `href` or `linkSlot`
 * makes the middle a link, and `onPress` alone keeps it a button.
 */
export function ListItem({
  title,
  description,
  leadingSlot,
  meta,
  actionSlot,
  onPress,
  href,
  linkSlot,
  selected = false,
  className,
  titleClassName,
}: ListItemProps) {
  // The muted grey is measured against the page. On the selected row's tint it falls short of
  // 4.5:1 at this size, so there the small lines are drawn in the full colour.
  const muted = selected ? "text-foreground" : "text-foreground/60";
  const body = (
    <>
      <View className="min-w-0 flex-1 gap-0.5">
        {asText(
          title,
          cn(
            "font-semibold text-foreground text-sm",
            // `truncate` is the ellipsis on the web; on device it is `numberOfLines`, which is
            // what `line-clamp-1` becomes and what `truncate` does not.
            Platform.select({ web: "truncate", default: "line-clamp-1" }),
            titleClassName,
          ),
          "list-item-title",
        )}
        {description
          ? asText(description, cn("line-clamp-2 text-xs", muted), "list-item-description")
          : null}
      </View>
      {meta ? (
        <View testID="list-item-meta" className="shrink-0 flex-row items-center gap-1">
          {asText(meta, cn("text-xs tabular-nums", muted))}
        </View>
      ) : null}
    </>
  );

  // The body in the one form its props ask for: the caller's link, a link, a button, or plain.
  const pressableBody = () => {
    if (linkSlot) {
      return bodyLink(linkSlot, selected, body);
    }
    if (href !== undefined) {
      return (
        <Pressable
          testID="list-item-body"
          role="link"
          accessibilityState={{ selected }}
          // React Native has no `href` and no `aria-current`; the web has both, and needs both.
          {...(Platform.OS === "web"
            ? ({ href, "aria-current": selected ? "page" : undefined } as const)
            : {})}
          {...(onPress ? { onPress } : {})}
          className={BODY_CLASS}
        >
          {body}
        </Pressable>
      );
    }
    if (onPress) {
      return (
        <Pressable
          testID="list-item-body"
          role="button"
          aria-current={selected ? true : undefined}
          onPress={onPress}
          className={BODY_CLASS}
        >
          {body}
        </Pressable>
      );
    }
    return (
      <View testID="list-item-body" className="min-w-0 flex-1 flex-row items-center gap-3">
        {body}
      </View>
    );
  };

  return (
    <View
      testID="list-item"
      className={cn(
        "min-w-0 flex-row items-center gap-3 rounded-md px-3 py-2.5",
        selected
          ? "bg-active/40"
          : (onPress || href !== undefined || linkSlot) &&
              Platform.select({
                web: "transition-colors hover:bg-hover has-[:focus-visible]:bg-hover",
                default: undefined,
              }),
        className,
      )}
    >
      {leadingSlot ? (
        <View testID="list-item-leading" className="shrink-0 flex-row items-center">
          {leadingSlot}
        </View>
      ) : null}

      {pressableBody()}

      {actionSlot ? (
        <View testID="list-item-action" className="shrink-0 flex-row items-center gap-1">
          {actionSlot}
        </View>
      ) : null}
    </View>
  );
}
