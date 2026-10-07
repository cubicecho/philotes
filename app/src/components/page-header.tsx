import type { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { cn, type SlotNode } from '@/lib/utils';

/**
 * How each heading level is drawn.
 *
 * The level is a prop rather than a hardcoded tag because this block is the same shape at three
 * depths and only the caller knows which one it is in: `<h1>` is right for the page it names and
 * wrong inside a card that already sits under one, and `<h2>` is the reverse. A shell that picks
 * for you is wrong on half the screens, and a shell that takes `title={<h1 className="…">…}` has
 * handed the size back to the caller — which is the drift, not the fix. The same page `<h1>` is
 * `text-lg`, `text-xl`, `text-2xl` and `text-3xl` in four of these projects, and two headers in
 * *one* project disagree with each other. This map is what ends that.
 *
 * - `row` is the floor under the title row. It holds the row to one height whether or not the
 *   page has an action and whether or not it has a description, so `contentSlot` beneath it starts
 *   at the same place on every page.
 * - `bar` is the height of one line of `title`, so a loading header is exactly as tall as the
 *   header it becomes.
 *
 * A literal map, per rule 3 — every class here is a class Tailwind can find in this file. The tag
 * is not in it: the compiler emits `<h1>`–`<h3>` from a literal `aria-level`, so {@link Heading}
 * spells each one out.
 */
const LEVELS = {
  1: {
    title: 'text-xl',
    icon: Platform.select({ web: '[&_svg]:size-5', default: undefined }),
    row: 'min-h-14',
    bar: 'h-7',
  },
  2: {
    title: 'text-lg',
    icon: Platform.select({ web: '[&_svg]:size-5', default: undefined }),
    row: 'min-h-12',
    bar: 'h-7',
  },
  3: {
    title: 'text-base',
    icon: Platform.select({ web: '[&_svg]:size-4', default: undefined }),
    row: 'min-h-10',
    bar: 'h-6',
  },
} as const;

/** The heading levels a {@link PageHeader} can be. */
export type PageHeaderLevel = keyof typeof LEVELS;

/** Off the screen and still read. `sr-only` is a clip, which the device does not have. */
const SR_ONLY = Platform.select({
  web: 'sr-only',
  default: 'absolute -m-px h-px w-px overflow-hidden',
});

/**
 * The title's colour, on every platform. The compiled `<h1>` would inherit it, but react-native-web
 * is web too and gives every `Text` its own black `color` — so leaving it to inheritance on web
 * drew the title black on the dark theme under Expo web. `titleClassName` comes later in the `cn`
 * and still wins.
 */
const INK = 'text-foreground';

/**
 * A wrapper around a caller's node, not layout of its own: a block box on the web, where a compiled
 * view would otherwise be a flex column and lay a sentence and its link out as two rows.
 */
const SLOT = Platform.select({ web: 'block', default: undefined });

/** A bar standing in for text that has not arrived — `Skeleton`'s look, on both platforms. */
const BAR = cn('max-w-full rounded-md bg-hover', Platform.OS === 'web' && 'animate-pulse');

export type PageHeaderProps = {
  /**
   * The row under the title block: a search field, a filter row, a set of tabs — stacked, each
   * on its own line, in the order they are passed.
   *
   * One slot rather than `search`, `filters` and `tabs`. The prior art grew all three, plus a
   * `searchZone` and an `actionsZone` escape hatch beside two of them, and three of those five
   * words have one live call site between them. They buy nothing the order of the nodes does not
   * already say, and none of them poses a question for the shell to settle the way `loading` and
   * `emptySlot` do on a card. A word added to this vocabulary is added to every component in the
   * set.
   *
   * It is also what decides the rule under the header — see the component comment.
   */
  contentSlot?: SlotNode | undefined;
  /**
   * What the page is called. Required, because a header with no title is a toolbar, and a
   * toolbar is a row of nodes the caller can place without help. It is also the heading
   * assistive technology navigates the page by.
   *
   * A node, not a string: a title composed from a verb and an entity ("Edit Workspace") is composed
   * by the caller. The prior art derived that inside the component from `useLocation()`, which
   * is routing in a shell — rule 8 — and it renders "Edit undefined" when the guess is wrong. On
   * device it is rendered inside a `Text`, so pass text or inline text nodes.
   */
  title: ReactNode;
  /**
   * One line on what the page is for. It wraps; it is not clipped.
   *
   * `text-sm text-foreground/60` is the one thing every hand-written header in these apps
   * already agrees on, so the only question left was truncation — and the headers that truncate
   * are the ones that lose the end of the sentence with no way to read it.
   */
  description?: ReactNode | undefined;
  /**
   * Sits before the title. On the web it is sized from the level — pass a bare `<Users />`, not a
   * sized one. On device an icon cannot be sized from outside it, so pass it at the size you want.
   *
   * Also where a status dot goes. Four of these apps put a coloured dot, a live indicator or a
   * category swatch in front of a title, each at its own size and its own muted colour.
   */
  iconSlot?: SlotNode | undefined;
  /**
   * The header's far end: the page's buttons, a status pill, a menu. A fragment of them is fine
   * — the shell rows and gaps them, so two pages never disagree about the space between New and
   * Import, and a caller never has to know whether this slot wraps its children (in one app it
   * does and in its sibling it does not, which is why their spacing differs by 4px).
   *
   * They sit here rather than beside the search field, so a page with no search puts them where
   * a page with one does.
   */
  actionSlot?: SlotNode | undefined;
  /**
   * The line above the title: a breadcrumb trail, or a back link, which is a one-step trail.
   *
   * A slot rather than the caller's own node above the header, because that node would not carry
   * the header's inset, and a trail starting 16px left of the title it belongs to is exactly the
   * drift this set exists to stop.
   *
   * Above the title, not beside it. Both placements are in use; above is the one that also holds
   * a trail, and a back button beside the title competes with `iconSlot` for the same spot and
   * takes width from the page's name for a control that is not part of it. It is a node, not a
   * route — no shell routes.
   */
  breadcrumbsSlot?: SlotNode | undefined;
  /**
   * Whether the title is still being fetched. On, a bar of the title's own height stands in for
   * it — and for the description, when one was passed — so the page beneath does not jump when
   * the name lands.
   *
   * The jump is real and it is invisible on a warm cache: one detail page in these apps replaces
   * its whole header with a single muted "Loading…" line, so a cold load swaps 16px of text for
   * a heading, a back button and two buttons, and everything below it moves.
   *
   * The same word `CardLayout` uses, and deliberately not the same target. A card keeps its real
   * title while loading, because a card's title is a fact about the screen and only its body is
   * waiting. A page header's title usually *is* what the request returned, so here the title is
   * the part that waits — and everything that does not depend on the fetch (the trail, the
   * buttons, the search field) is left alone and stays usable while it does.
   *
   * A caller wanting its own placeholder passes it as `title`, which is a node, and leaves this
   * off. What it should not do is hand-roll a bar per page: that is how two pages end up jumping
   * by different amounts.
   */
  loading?: boolean | undefined;
  /**
   * Which heading this is. `1` names a page; `2` names a section, a pane in a split, or a card
   * that already sits under a page title; `3` goes a level below that. See {@link LEVELS}.
   */
  level?: PageHeaderLevel | undefined;
  className?: string | undefined;
  titleClassName?: string | undefined;
  contentClassName?: string | undefined;
};

/**
 * The heading itself, one arm per level.
 *
 * Three near-identical arms because the compiler emits the tag from a *literal* `aria-level` — a
 * level held in a variable would be a tag chosen at runtime, which it refuses for the same reason
 * it refuses an element chosen at runtime.
 */
function Heading({ level, className, children }: { level: PageHeaderLevel; className: string; children: ReactNode }) {
  if (level === 1) {
    return (
      <Text testID="page-header-title" role="heading" aria-level={1} className={className}>
        {children}
      </Text>
    );
  }
  if (level === 2) {
    return (
      <Text testID="page-header-title" role="heading" aria-level={2} className={className}>
        {children}
      </Text>
    );
  }
  return (
    <Text testID="page-header-title" role="heading" aria-level={3} className={className}>
      {children}
    </Text>
  );
}

/**
 * The title block a page wears in a header slot.
 *
 * Every list page in these apps writes this out: a name, a line under it, the page's buttons at
 * the far end, and a search or filter row beneath. Written out each time, they disagree about
 * all of it — the same `<h1>` is four different sizes across four projects and two different
 * sizes inside one of them, it is `font-semibold` in three and `font-bold` in the fourth, the
 * description truncates on the detail pages and wraps everywhere else, and "what happens to a
 * long title next to three buttons" has four answers, one of which is "nothing".
 *
 * **The padding seam.** `HeaderContentFooter` deliberately leaves its header slot unpadded
 * and gives the body `px-4`, because the page header carries its own inset — this component is
 * the one that comment means. So the inset lives here, exactly once, and the two edges line up
 * beneath a `width="page"` chassis.
 *
 * The other model, where a `<main>` owns the inset and the header inherits it, is what the rest
 * of these apps do, and it is why one route in one of them is inset 12px while every other page
 * is 16px: the page shell merged a caller's `className` over its own padding and nobody saw.
 * Dropped into a chassis that already pads, this header passes `className="px-0"` and the seam
 * stays owned by exactly one of the two.
 *
 * The *cap* does not live here. The prior art applied `PAGE_COLUMN` in both places so a header
 * dropped somewhere else still read as a page header, but that makes a header inside a
 * `width="full"` chassis cap itself while the body under it does not — the header contradicting
 * the chassis it was handed. The chassis owns the column, the header owns the inset, and each
 * seam is decided in one file.
 *
 * **Narrow widths.** The title row wraps rather than stacking at a breakpoint: the title block
 * asks for 16rem, and when that plus the action will not fit on one line, the action drops to
 * its own. A breakpoint is the wrong instrument, because the variable is how wide the *action*
 * is, not how wide the window is — one header here has a search field and two buttons in its
 * action and was squeezing its title at 1100px, which no phone breakpoint would have caught,
 * and another is a pane inside a split, narrow on a wide screen.
 *
 * The title wraps; it does not truncate. A card title truncates because it is one of many on a
 * screen that gives it context — a page title *is* the context, and half of one names nothing.
 */
export function PageHeader({
  contentSlot,
  title,
  description,
  iconSlot,
  actionSlot,
  breadcrumbsSlot,
  loading = false,
  level = 1,
  className,
  titleClassName,
  contentClassName,
}: PageHeaderProps) {
  const { title: titleSize, icon: iconSize, row: rowFloor, bar: barHeight } = LEVELS[level];

  // The rule these apps already follow without having named it: a page header draws a line under
  // itself exactly when nothing else separates it from the body. The list headers, which all
  // carry a search row, draw none. The edit headers, the detail pages and one app's whole page
  // shell — none of which has anything between the title and the first field — all grew one by
  // hand, in three different border colours. Deriving it here decides it once instead of per
  // screen, and a caller who disagrees says so in one class: `className="border-b-0"`.
  //
  // Level 1 only. A section heading inside a card sits above a body the card has already fenced,
  // and not one of the section headings in these apps draws a second line.
  const rule = level === 1 && !contentSlot ? 'border-b border-foreground/10' : undefined;

  return (
    // `px-4` is the seam: the body of a `width="page"` chassis carries the same, and nothing else
    // in this tree adds to it, so the title sits above the body's first column.
    <View
      testID="page-header"
      aria-busy={loading || undefined}
      className={cn('min-w-0 flex-col gap-3 px-4 py-4', rule, className)}
    >
      {breadcrumbsSlot ? (
        <View testID="page-header-breadcrumbs" className={cn(SLOT, 'min-w-0')}>
          {breadcrumbsSlot}
        </View>
      ) : null}

      <View
        testID="page-header-title-row"
        // `content-center`: a wrapping row packs its lines at the start on device and under
        // react-native-web, so the floor was left as an empty band under a lone title (#248).
        className={cn('flex-row flex-wrap content-center items-center justify-between gap-x-4 gap-y-2', rowFloor)}
      >
        {/* `basis-64` is the threshold, and the only number here that is a judgement rather than
            a measurement: the title keeps at least 16rem or the action wraps under it. `min-w-0`
            is what then lets the block shrink below its longest word. */}
        <View testID="page-header-titles" className="min-w-0 flex-1 basis-64 flex-col gap-1">
          <View className="min-w-0 flex-row items-center gap-2">
            {iconSlot ? (
              // Sized here on the web rather than by the caller, so an icon passed as `<Users />`
              // and one passed as `<Users className="size-6" />` land at the same size — and so the
              // size follows the level instead of being guessed once per page.
              <View className={cn('shrink-0 text-foreground/60', iconSize)}>{iconSlot}</View>
            ) : null}
            {loading ? (
              <>
                {/* The heading keeps a name while it waits. A heading whose only child is a
                    decorative bar is an empty heading, which axe reports and which leaves a
                    screen reader nothing to land on between the trail and the buttons. */}
                <Heading level={level} className={SR_ONLY}>
                  Loading…
                </Heading>
                <View aria-hidden className={cn(BAR, 'w-48', barHeight)} />
              </>
            ) : (
              // `break-words` is what a title does when it runs out of room — an unbroken id or
              // url otherwise holds the block above its floor and pushes the action off the edge.
              <Heading
                level={level}
                className={cn(
                  'min-w-0 shrink break-words font-semibold tracking-tight',
                  INK,
                  titleSize,
                  titleClassName,
                )}
              >
                {title}
              </Heading>
            )}
          </View>

          {description ? (
            loading ? (
              <View testID="page-header-description" aria-hidden className={cn(BAR, 'h-5 w-72')} />
            ) : (
              <Text testID="page-header-description" webAs="p" className="text-foreground/60 text-sm">
                {description}
              </Text>
            )
          ) : null}
        </View>

        {actionSlot ? (
          <View testID="page-header-action" className="shrink-0 flex-row flex-wrap items-center gap-2">
            {actionSlot}
          </View>
        ) : null}
      </View>

      {contentSlot ? (
        <View testID="page-header-content" className={cn('min-w-0 flex-col gap-2', contentClassName)}>
          {contentSlot}
        </View>
      ) : null}
    </View>
  );
}
