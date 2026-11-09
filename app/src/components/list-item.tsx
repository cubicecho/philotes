import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  cn,
  HEADING_TITLE,
  HEADING_WRAP_FLOOR,
  hasSlot,
  type SlotNode,
  touchRowClass,
} from "@/lib/utils";

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
   * The chosen row: the one open beside the list, the current one. Tinted in `active`, a step
   * further under the pointer, and a pressable row says so with `aria-current`. A row with nothing
   * to press has no element to carry that, so the tint is all it shows: say it in the row's words
   * as well — a "Current" badge in `meta` — for a reader who cannot see the colour.
   */
  selected?: boolean | undefined;
  /** On the row, the box around its leading slot, words, meta and action. */
  className?: string | undefined;
  /** On the title's own `Text`, as `CardLayout`'s is: a `line-through`, a weight. */
  titleClassName?: string | undefined;
};

/**
 * A string on its own is a crash on device, so a string gets a `Text` around it. An element does
 * not: a `View` inside a `Text` lays out inline on device and loses most of its own styling.
 */
function asText(node: ReactNode, className: string) {
  return typeof node === "string" || typeof node === "number" ? (
    <Text className={className}>{node}</Text>
  ) : (
    node
  );
}

/**
 * A row's fill for its state, for `ListItem`, `CollapsibleRow` and `FileTree`. Chosen is the
 * `active` tint, and the pointer over a pressable row is `hover`, or over a chosen one the tint a
 * step further. Focused, a row looks hovered: `hover` if it is not chosen, the `/60` step if it is.
 *
 * Only the row's own pressed part lights it: the one focusable child of the row itself. A
 * leading checkbox or a Delete button sits inside a box of its own, and focused it shows its own
 * look and nothing more. `has-[:focus-visible]` lit the row for those too, in the same `hover` as
 * the button's own, so a row and its action could not be told apart (WCAG 2.4.7).
 */
export function rowFillClass(selected: boolean, pressable: boolean) {
  const pointer = selected
    ? "transition-colors hover:bg-active/60 has-[>:focus-visible]:bg-active/60"
    : "transition-colors hover:bg-hover has-[>:focus-visible]:bg-hover";
  return cn(
    selected && "bg-active/40",
    pressable && Platform.select({ web: pointer, default: undefined }),
  );
}

/**
 * The row's middle, pressed or not: the words and `meta`, down to the rhythm's wrap floor. Below
 * it the actions go under the words rather than squeezing them to nothing.
 */
const MIDDLE_CLASS = cn(HEADING_WRAP_FLOOR, "flex-row items-center gap-3");

/**
 * The pressed part of a row, whichever of a button or a link it is. As tall as the row, so a leading
 * avatar or an action taller than the words does not leave a strip above and below it unpressed; it
 * centres its own words, as the row did.
 */
const BODY_CLASS = cn(
  MIDDLE_CLASS,
  "self-stretch rounded-md",
  Platform.select({
    web: "text-left focus-visible:outline-none",
    // Pressed looks hovered, as a menu's or a command's row does: not a fade, which reads disabled.
    default: "active:bg-hover",
  }),
);

/**
 * The pressed part of a row, out to the row's own edges (#470). The row lights as a whole, and its
 * padding — `Item`'s `sm`, `px-3 py-2` in `item-base.ts` — was outside the press: a 54px row was a
 * 38px target. The padding is given back to the pressed part inside a negative margin, so nothing
 * moves and a press anywhere on the lit row opens it. Not over the leading slot or the action,
 * which keep presses of their own. What the padding takes from the wrap floor's basis is added back,
 * so the action wraps at the width it did. On device the pressed part is also 44pt tall.
 *
 * For a pressed part inside an `Item size="sm"`, after its own classes: `ListItem`'s middle and
 * `CollapsibleRow`'s trigger.
 */
export function rowPressInsetClass({
  leading,
  action,
}: {
  leading: boolean;
  action: boolean;
}): string {
  const start = leading === false;
  const end = action === false;
  return cn(
    "-my-2 py-2",
    start && "-ml-3 pl-3",
    end && "-mr-3 pr-3",
    start && end ? "basis-46" : (start || end) && "basis-43",
    touchRowClass(),
  );
}

type RowLinkOptions = {
  /** The pressed part's `testID` on device and `data-slot` on the web: `list-item-body`. */
  slot: string;
  /** The pressed part's classes, laid under any the caller's link carries. */
  className: string;
  /** The chosen row: `aria-current="page"` on the web, `selected` on device. */
  selected: boolean;
  /** A style the row sets itself, such as a tree's indent. Left out, the link keeps its own. */
  style?: { paddingLeft: number } | undefined;
  /** Further props for the web's link only, such as what lets the row be dragged. */
  webProps?: object | undefined;
};

/**
 * A row's pressed part as the router's link, for `ListItem` and `FileTree`. On the web the
 * caller's element *is* the pressed part — cloned with the row's classes and what is inside it,
 * so it stays the router's own `<a>`. On device a link is expo-router's, which takes the row the
 * other way round: given `asChild`, it wraps the `Pressable`.
 */
export function rowLink(
  link: ReactElement,
  { slot, className, selected, style, webProps }: RowLinkOptions,
  inside: ReactNode,
) {
  if (Platform.OS !== "web") {
    return cloneElement(
      link as ReactElement<{ asChild?: boolean }>,
      { asChild: true },
      <Pressable
        testID={slot}
        role="link"
        accessibilityState={{ selected }}
        className={className}
        style={style}
      >
        {inside}
      </Pressable>,
    );
  }

  const element = link as ReactElement<Record<string, unknown>>;
  return cloneElement(
    element,
    {
      "data-slot": slot,
      className: cn("flex", className, element.props.className as string | undefined),
      ...(style ? { style } : {}),
      "aria-current": selected ? "page" : undefined,
      ...webProps,
    },
    inside,
  );
}

type ListItemTextProps = Pick<
  ListItemProps,
  "title" | "description" | "meta" | "selected" | "titleClassName"
>;

/**
 * A row's words as `ListItem` draws them: `Item`'s title over its description, then `meta`. For a
 * row that is a `ListItem` with a press of its own, as `CollapsibleRow` is; it goes inside an
 * `Item size="sm"`, which is what sizes the parts.
 */
export function ListItemText({
  title,
  description,
  meta,
  selected = false,
  titleClassName,
}: ListItemTextProps) {
  // The muted grey is measured against the page. On the selected row's tint it falls short of
  // 4.5:1 at this size, so there the small lines are drawn in the full colour.
  const muted = selected ? "text-foreground" : "text-foreground/60";
  const words = typeof title === "string" || typeof title === "number";
  return (
    <>
      <ItemContent>
        {words ? (
          <ItemTitle>
            {/* The row's own `Text`, not the line's, so it truncates and takes `titleClassName`:
                on a device a class on the line would not reach the words. */}
            <Text
              testID="list-item-title"
              className={cn(
                "min-w-0 shrink",
                HEADING_TITLE,
                // `truncate` is the ellipsis on the web; on device it is `numberOfLines`, which is
                // what `line-clamp-1` becomes and what `truncate` does not.
                Platform.select({ web: "truncate", default: "line-clamp-1" }),
                titleClassName,
              )}
            >
              {title}
            </Text>
          </ItemTitle>
        ) : (
          title
        )}
        {description ? (
          typeof description === "string" || typeof description === "number" ? (
            <ItemDescription testID="list-item-description">{description}</ItemDescription>
          ) : (
            description
          )
        ) : null}
      </ItemContent>
      {meta ? (
        // Centred on the words beside it, even in a press that lines its children up by their
        // tops, as `CollapsibleRow`'s does.
        <View testID="list-item-meta" className="shrink-0 flex-row items-center gap-1 self-center">
          {asText(meta, cn("text-xs tabular-nums", muted))}
        </View>
      ) : null}
    </>
  );
}

/**
 * One row of a list: something at the start, a title with a line under it, small facts and
 * buttons at the far end. It draws no surface; the list, card or section around it owns the
 * border. It is `Item`'s parts at `size="sm"`, so a row composed from them lines up with it, and
 * its words and buttons are the heading rhythm every block and row shares. A long title
 * truncates; only once the middle would be under 10rem do the buttons wrap, to the far end.
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
  const body = (
    <ListItemText
      title={title}
      description={description}
      meta={meta}
      selected={selected}
      titleClassName={titleClassName}
    />
  );

  const bodyClass = cn(
    BODY_CLASS,
    rowPressInsetClass({ leading: Boolean(leadingSlot), action: Boolean(actionSlot) }),
  );

  // The body in the one form its props ask for: the caller's link, a link, a button, or plain.
  const pressableBody = () => {
    if (linkSlot) {
      return rowLink(linkSlot, { slot: "list-item-body", className: bodyClass, selected }, body);
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
          className={bodyClass}
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
          className={bodyClass}
        >
          {body}
        </Pressable>
      );
    }
    return (
      <View testID="list-item-body" className={MIDDLE_CLASS}>
        {body}
      </View>
    );
  };

  return (
    <Item
      testID="list-item"
      size="sm"
      selected={selected}
      // The middle truncates its title first, and only below the wrap floor do the actions wrap.
      className={cn(
        "min-w-0",
        rowFillClass(
          selected,
          onPress !== undefined || href !== undefined || linkSlot !== undefined,
        ),
        className,
      )}
    >
      {hasSlot(leadingSlot) ? (
        <ItemMedia testID="list-item-leading">{leadingSlot}</ItemMedia>
      ) : null}

      {pressableBody()}

      {hasSlot(actionSlot) ? (
        <ItemActions testID="list-item-action">{actionSlot}</ItemActions>
      ) : null}
    </Item>
  );
}
