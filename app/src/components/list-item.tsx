import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { cn, type SlotNode } from '@/lib/utils';

type ListItemProps = {
  /** What the row is: a person's name, a todo's text. One line, truncated when it runs long. */
  title: ReactNode;
  /** The line under the title — an email, the first line of the notes. Two lines at most. */
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
   * The chosen row: the one open beside the list. Tinted in `active`, it stays that under the
   * pointer, and a pressable row says so with `aria-current`.
   */
  selected?: boolean | undefined;
  className?: string | undefined;
  titleClassName?: string | undefined;
};

/** A string on its own is a crash on device, so a string `meta` gets a `Text` around it. */
function asText(node: ReactNode, className: string) {
  return typeof node === 'string' || typeof node === 'number' ? <Text className={className}>{node}</Text> : node;
}

/**
 * One row of a list: something at the start, a title with a line under it, small facts and
 * buttons at the far end, and optionally the whole middle pressable. One source for both
 * platforms.
 *
 * It is here because six web apps and five Expo apps wrote this row by hand — philotes'
 * `PersonRow`, telos' `TodoRow`, min-agent's settings rows, mcp-router's `ServerRow` — and
 * `@cubeui/item`, the shadcn primitive that covers it on the web, has no React Native half. The
 * copies agree on the shape (`gap-3`, `px-3 py-2.5`, a `text-sm font-medium` title over an
 * `text-xs` muted line) and disagree on the part that matters: where the press goes.
 *
 * **The pressed area is the middle, and only the middle.** A row that opens *and* has buttons is
 * the common case, and the hand-written answer was either a button wrapping buttons (invalid
 * HTML, and every inner click also opens the row) or a stretched overlay whose inner controls
 * need `pointer-events` juggling on two platforms. So the row is three siblings — `leadingSlot`,
 * the pressable middle, `actionSlot` — and each control is reached, pressed and announced on its
 * own. On the web the middle is a real `<button>`, named by the text inside it.
 *
 * No surface: a row lives in a list, a card or a section, and that owns the border. Pass
 * `className="rounded-lg border border-foreground/10 bg-secondary"` for the telos look.
 */
export function ListItem({
  title,
  description,
  leadingSlot,
  meta,
  actionSlot,
  onPress,
  selected = false,
  className,
  titleClassName,
}: ListItemProps) {
  const body = (
    <>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          testID="list-item-title"
          className={cn(
            'font-medium text-foreground text-sm',
            // `truncate` is the ellipsis on the web; on device it is `numberOfLines`, which is
            // what `line-clamp-1` becomes and what `truncate` does not.
            Platform.select({ web: 'truncate', default: 'line-clamp-1' }),
            titleClassName,
          )}
        >
          {title}
        </Text>
        {description ? (
          <Text testID="list-item-description" className="line-clamp-2 text-foreground/60 text-xs">
            {description}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <View testID="list-item-meta" className="shrink-0 flex-row items-center gap-1">
          {asText(meta, 'text-foreground/60 text-xs tabular-nums')}
        </View>
      ) : null}
    </>
  );

  return (
    <View
      testID="list-item"
      className={cn(
        'min-w-0 flex-row items-center gap-3 rounded-md px-3 py-2.5',
        selected
          ? 'bg-active/40'
          : onPress &&
              Platform.select({
                web: 'transition-colors hover:bg-hover has-[:focus-visible]:bg-hover',
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

      {onPress ? (
        <Pressable
          testID="list-item-body"
          role="button"
          aria-current={selected ? true : undefined}
          onPress={onPress}
          className={cn(
            'min-w-0 flex-1 flex-row items-center gap-3 rounded-sm',
            Platform.select({
              web: 'text-left focus-visible:outline-none',
              default: 'active:opacity-70',
            }),
          )}
        >
          {body}
        </Pressable>
      ) : (
        <View testID="list-item-body" className="min-w-0 flex-1 flex-row items-center gap-3">
          {body}
        </View>
      )}

      {actionSlot ? (
        <View testID="list-item-action" className="shrink-0 flex-row items-center gap-1">
          {actionSlot}
        </View>
      ) : null}
    </View>
  );
}
