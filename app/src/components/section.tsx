import type { ReactNode } from 'react';
import * as React from 'react';
import { Platform, Text, View } from 'react-native';
import { cn, type SlotNode } from '@/lib/utils';

type SectionProps = {
  /** The body: the fields, the rows, whatever the heading is over. */
  contentSlot?: SlotNode | undefined;
  /** The overline. A short noun phrase — "Pomodoro", "Danger zone", "Notifications". */
  title?: ReactNode | undefined;
  /** One line under the title, in sentence case, on what the group is for. */
  description?: ReactNode | undefined;
  /** The heading row's far end: an add button, a count, a switch that disables the group. */
  actionSlot?: SlotNode | undefined;
  /** A hairline under the heading. Off by default; on, the group reads as one block. */
  divider?: boolean | undefined;
  /**
   * The title's heading rank. `2` by default, because a page's `PageHeader` owns the one `h1` and
   * these are the sections under it. A section nested in a section is `3`; a section in a dialog
   * whose title is the `h2` is `3` as well. Pick it by where the section sits, never by how big
   * the text should look — the text is the same size at every level.
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
  /**
   * `card` draws the group on a card: the border, background and shadow `Card` has, with the
   * padding inside it. `none` (the default) is a label and a gap and nothing else.
   */
  surface?: 'none' | 'card' | undefined;
  className?: string | undefined;
  titleClassName?: string | undefined;
  contentClassName?: string | undefined;
};

/**
 * The title and description. `basis-48` is the floor the heading row wraps on: the text asks for
 * 12rem — `SettingRow`'s number, for the same two sizes of type — and an action that cannot sit
 * beside that much drops to its own line. A basis rather than a `min-w`, so in a column narrower
 * than the floor the text still shrinks to it instead of running out of the section.
 */
const TEXT = 'min-w-0 flex-1 basis-48';

/**
 * The action. It never shrinks, which is what keeps one button or a badge at its own width and
 * where it always sat. `max-w-full` is for the action wider than the section: on a line of its
 * own it is held to the section's width, so what is in it wraps — a fragment of buttons on this
 * row, a caller's own row inside it — rather than running out past the edge.
 */
const ACTION = 'max-w-full shrink-0 flex-row flex-wrap items-center gap-2';

/**
 * What makes the caller's own row wrap in a browser. A flex item's width there starts from its
 * content, and a react-native-web view does not shrink, so a `flex-row flex-wrap` view handed in
 * as the action stayed as wide as its buttons and ran out of the section. Yoga measures a child
 * against the width its parent has, so the device needs nothing — and NativeWind has no child
 * selector to give it.
 */
const ACTION_FIT = Platform.select({ web: '[&>*]:max-w-full', default: undefined });

/**
 * A heading over a group of fields or rows — one source for both platforms.
 *
 * It is here because three projects wrote it separately and got *almost* the same: `text-xs
 * font-semibold uppercase` and a muted foreground in all three, then `tracking-wider` in one and
 * `tracking-wide` in another, and a `border-b pb-1` in the third. Nobody copied anybody — they each
 * typed the same five tokens from memory, which is why the sixth is different. The fourth copy was
 * a React Native one, which is why this is no longer a web-only item.
 *
 * The surface is a prop, not a wrapper. Some apps put every section on a card and some put none
 * on one, and the version that said "wrap it yourself" is the one that got rewritten locally with
 * the card inside, the title in a card header, and a `role="region"` that nobody else had.
 *
 * The semantics, both platforms:
 *
 * - The title is a heading of rank `level`. On device that is `role="heading"`, which VoiceOver and
 *   TalkBack both navigate by. On the web it is `role="heading"` + `aria-level` on the title's
 *   `<span>` rather than an `<h2>`: the rank is a prop, and the compiler writes the tag once, so a
 *   rank known only at runtime keeps its ARIA — which is the same heading to assistive technology.
 * - The root is a `<section>` on the web (`webAs`), named by its title through `aria-labelledby`,
 *   which is what makes it a `region` landmark. An untitled section has no name and so is not a
 *   landmark, which is correct: a landmark nobody can name is noise in the landmark list.
 *
 * **The heading row wraps rather than squeezing.** The action never shrinks, and the row used not
 * to wrap, so a five-button toolbar on a phone left the description one character to a line. Now
 * it is `SettingRow`'s rule: the action sits beside the text while both fit and drops under it,
 * at the start, when they do not — by the width the section is given, not the window's. Plain
 * flex-wrap, so Yoga does the same on device.
 *
 * No state, no data, no `children` — the body is `contentSlot`, like every other shell here.
 */
export function Section({
  contentSlot,
  title,
  description,
  actionSlot,
  divider = false,
  level = 2,
  surface = 'none',
  className,
  titleClassName,
  contentClassName,
}: SectionProps) {
  const titleId = React.useId();
  const hasText = Boolean(title || description);
  const hasHeading = Boolean(hasText || actionSlot);

  return (
    <View
      webAs="section"
      testID="section"
      {...(title ? { 'aria-labelledby': titleId } : {})}
      className={cn(
        'min-w-0 gap-3',
        surface === 'card' && 'rounded-lg border border-foreground/10 bg-secondary p-4 text-foreground shadow-sm',
        className,
      )}
    >
      {hasHeading ? (
        <View
          testID="section-heading"
          className={cn(
            'min-w-0 flex-row flex-wrap items-center gap-2',
            // With no text there is no column to push the action along, so the row does it.
            !hasText && 'justify-end',
            divider && 'border-b border-foreground/10 pb-1',
          )}
        >
          {hasText ? (
            <View className={TEXT}>
              {title ? (
                // biome-ignore lint/a11y/useSemanticElements: React Native has no heading element; role="heading" is the cross-platform form
                <Text
                  testID="section-title"
                  nativeID={titleId}
                  role="heading"
                  aria-level={level}
                  className={cn(
                    'truncate font-semibold text-foreground/60 text-xs uppercase tracking-wider',
                    titleClassName,
                  )}
                >
                  {title}
                </Text>
              ) : null}
              {description ? (
                <Text webAs="p" testID="section-description" className="mt-1 text-foreground/60 text-sm">
                  {description}
                </Text>
              ) : null}
            </View>
          ) : null}
          {actionSlot ? (
            <View testID="section-action" className={cn(ACTION, ACTION_FIT)}>
              {actionSlot}
            </View>
          ) : null}
        </View>
      ) : null}

      {contentSlot ? (
        <View testID="section-content" className={cn('min-w-0 gap-4', contentClassName)}>
          {contentSlot}
        </View>
      ) : null}
    </View>
  );
}
