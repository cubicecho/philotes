import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn, type SlotNode } from '@/lib/utils';

/**
 * How much of the split one pane claims. The other takes the rest.
 *
 * Fixed rungs (`sm`/`md`/`lg`) are for an inspector — a thing whose useful width is set by its
 * contents, not by the window. Proportional rungs are for a second working surface that should
 * grow with the screen. `auto` is the icon strip: as wide as what is in it.
 *
 * The scale is named rungs rather than a free number because the widths it replaces were spelled
 * every way to hand — `60%`, `320px`, `2fr`, `22rem`, `3fr/2fr`, `1fr/4fr`, `minmax(16rem,20rem)`,
 * `min-content`, `w-56`, `w-72 lg:w-80`, `w-14 lg:w-56` — with no way to read which differences
 * were decisions and which were the nearest number at the time. A width that falls between two
 * rungs is a call site choosing the nearer one, not a case for a ninth rung.
 */
export type SplitWidth = 'auto' | 'sm' | 'md' | 'lg' | 'fifth' | 'two-fifths' | 'half' | 'two-thirds';

/**
 * The width below which the second pane stacks under the first instead of sitting beside it: a
 * column below it, a row from it up.
 *
 * Literal classes rather than a composed one, per rule 3: Tailwind's scanner reads source text, so
 * `` `${bp}:flex-row` `` names a class that is never generated. That is also why the two tables
 * below repeat themselves once per breakpoint.
 */
const STACK_BELOW = {
  never: 'flex-row',
  md: 'flex-col md:flex-row',
  lg: 'flex-col lg:flex-row',
  xl: 'flex-col xl:flex-row',
} as const;

/**
 * What the pane that carries the width wears once the two sit side by side.
 *
 * The fixed rungs are a width that may shrink (`minmax(0,20rem)` was the grid's word for it) with
 * a floor where the grid had one (`minmax(16rem,22rem)`); the proportional rungs are a flex
 * factor, with the other pane's in {@link REST}. `auto` neither grows nor shrinks, which is as
 * wide as what is in it.
 *
 * Below the breakpoint none of this applies and both panes are full-width rows.
 */
const SIZED: Record<keyof typeof STACK_BELOW, Record<SplitWidth, string>> = {
  never: {
    auto: 'grow-0',
    sm: 'w-80 grow-0 shrink',
    md: 'w-[22rem] min-w-64 grow-0 shrink',
    lg: 'w-[28rem] min-w-72 grow-0 shrink',
    fifth: 'flex-1',
    'two-fifths': 'flex-[2]',
    half: 'flex-1',
    'two-thirds': 'flex-[2]',
  },
  md: {
    auto: 'md:grow-0',
    sm: 'md:w-80 md:grow-0 md:shrink',
    md: 'md:w-[22rem] md:min-w-64 md:grow-0 md:shrink',
    lg: 'md:w-[28rem] md:min-w-72 md:grow-0 md:shrink',
    fifth: 'md:flex-1',
    'two-fifths': 'md:flex-[2]',
    half: 'md:flex-1',
    'two-thirds': 'md:flex-[2]',
  },
  lg: {
    auto: 'lg:grow-0',
    sm: 'lg:w-80 lg:grow-0 lg:shrink',
    md: 'lg:w-[22rem] lg:min-w-64 lg:grow-0 lg:shrink',
    lg: 'lg:w-[28rem] lg:min-w-72 lg:grow-0 lg:shrink',
    fifth: 'lg:flex-1',
    'two-fifths': 'lg:flex-[2]',
    half: 'lg:flex-1',
    'two-thirds': 'lg:flex-[2]',
  },
  xl: {
    auto: 'xl:grow-0',
    sm: 'xl:w-80 xl:grow-0 xl:shrink',
    md: 'xl:w-[22rem] xl:min-w-64 xl:grow-0 xl:shrink',
    lg: 'xl:w-[28rem] xl:min-w-72 xl:grow-0 xl:shrink',
    fifth: 'xl:flex-1',
    'two-fifths': 'xl:flex-[2]',
    half: 'xl:flex-1',
    'two-thirds': 'xl:flex-[2]',
  },
};

/**
 * What the other pane wears side by side: the rest. `flex-1` is a zero basis, so it takes what is
 * left rather than what its content asks for — the `minmax(0,1fr)` the grid spelled out.
 */
const REST: Record<keyof typeof STACK_BELOW, Record<'fifth' | 'two-fifths' | 'other', string>> = {
  never: { fifth: 'flex-[4]', 'two-fifths': 'flex-[3]', other: 'flex-1' },
  md: { fifth: 'md:flex-[4]', 'two-fifths': 'md:flex-[3]', other: 'md:flex-1' },
  lg: { fifth: 'lg:flex-[4]', 'two-fifths': 'lg:flex-[3]', other: 'lg:flex-1' },
  xl: { fifth: 'xl:flex-[4]', 'two-fifths': 'xl:flex-[3]', other: 'xl:flex-1' },
};

/**
 * Every pane's floor. `min-w-0` is rule 4: a flex item's minimum is its content, so one wide
 * table in one pane would otherwise widen it and shove the other off the screen. `grow` is what
 * lets the panes share a height the layout was given, stacked or alone, the way grid rows did.
 */
const PANE = 'min-h-0 min-w-0 grow';

/**
 * The rule turns where the panes do: a hairline column between two panes side by side, a hairline
 * row between the same two stacked. Keyed by the same breakpoint as {@link STACK_BELOW} so the two
 * can never disagree about where the layout flips.
 */
const DIVIDER_AT: Record<keyof typeof STACK_BELOW, string> = {
  never: 'w-px',
  md: 'h-px w-full md:h-auto md:w-px',
  lg: 'h-px w-full lg:h-auto lg:w-px',
  xl: 'h-px w-full xl:h-auto xl:w-px',
};

/** What sits between the panes. A rule is drawn flush; space is drawn with nothing in it. */
const DIVIDERS = { space: 'gap-4', line: 'gap-0', none: 'gap-0' } as const;

/**
 * Which pane carries the width, and how much it claims. The other takes the rest.
 *
 * Two props rather than one, because a split has no main pane to measure from: naming the width
 * on the pane it applies to is the only spelling that stays true when the panes are equals. The
 * union is what stops both being set — the pair would then have to disagree about the leftover,
 * and one of them would have to silently lose.
 *
 * Neither set is an even split, which is the honest default for two surfaces with no ranking.
 */
type SplitWidths = { firstWidth?: SplitWidth; secondWidth?: never } | { firstWidth?: never; secondWidth?: SplitWidth };

type SplitLayoutProps = {
  /** The leading pane. Alone, it is the whole width, so a caller never special-cases un-split. */
  firstSlot: SlotNode;
  /**
   * The trailing pane.
   *
   * Absent, the layout is one full-width column and neither a second cell nor a divider is
   * drawn. That absence is also how a pane collapses — see the component note — which is why
   * there is no `collapsed` prop and no state held here.
   */
  secondSlot?: SlotNode | undefined;
  /**
   * Below this width the two stack rather than sit side by side. `never` keeps them side by side
   * at every width — an icon strip, a kiosk, a pane already inside a media query the caller owns.
   *
   * Stacking, not hiding, is the narrow-width answer: a phone has no room for two panes, but it
   * has room for one after the other. A screen where the second pane is genuinely meaningless on
   * a phone wants a separate route for it, not a pane that is present and off-screen.
   */
  stackBelow?: keyof typeof STACK_BELOW | undefined;
  /**
   * What separates the panes.
   *
   * - `space` — a gap. Two surfaces on a page, which is what most content splits are.
   * - `line` — flush, with a hairline rule between them. The app shell: a navigation column
   *   against a working surface. Every hand-written one draws this as a `border-r` on one pane,
   *   which is right until the layout stacks and the border becomes a line down one side of the
   *   screen instead of a line between the two panes.
   * - `none` — flush, nothing drawn. The panes carry their own edges.
   *
   * One prop rather than a `gap` and a `bordered`, because they are the same decision: a rule
   * with a gap on both sides is a line floating in the middle of nothing.
   */
  divider?: keyof typeof DIVIDERS | undefined;
  className?: string | undefined;
  firstClassName?: string | undefined;
  secondClassName?: string | undefined;
} & SplitWidths;

/**
 * Two surfaces side by side, as equals.
 *
 * The slots are numbered rather than named for a role or a side, because neither survives what
 * this component already does. A role pair (`content`/`sidebar`) is a lie about a genuinely even
 * split, and a side pair (`left`/`right`) is a lie below `stackBelow`, where the panes are above
 * and below, and again under RTL. `firstSlot` and `secondSlot` are true in every one of those:
 * first in reading order, wherever reading is going.
 *
 * {@link SidebarLayout} is this component with the roles put back, for the common case where one
 * pane is the screen and the other is beside it.
 *
 * The floors are the reason this is a component rather than a class string. A flex item's
 * `min-width` is `auto`, so one wide child — a table, a long unbroken string — grows its pane
 * and pushes the other pane off the screen instead of scrolling inside its own. `min-h-0` /
 * `min-w-0` on both panes is what makes a nested scroll container work at all, and it is the same
 * failure `HeaderContentFooter` guards in the other axis: there a wide child pushes the
 * chrome out of the column, here it pushes the neighbouring pane out of the row. Half the panes
 * this replaces are missing one or both.
 *
 * **It is not resizable, and that is a decision rather than a gap.** A draggable divider needs a
 * pointer handler and a stored width, and a stored width is state, which rule 8 keeps out of a
 * shell. The two ways to keep it out both fail on their own terms: expressing the drag in CSS
 * (`resize: horizontal`) gives a handle only a mouse can reach, and lifting the width out to
 * `firstWidth`/`onFirstWidthChange` still leaves the drag itself — behaviour — in here, to be
 * re-derived worse than `react-resizable-panels`, which shadcn already ships as `resizable`.
 * Rule 3 says do not wrap what shadcn ships; this is its other half, do not rebuild it either. A
 * screen that genuinely needs a draggable split is a screen for that primitive. None of the
 * eleven call sites this replaces has one.
 *
 * Because nothing drags, the divider is a rule and not a control: `aria-hidden`, no role, no tab
 * stop. A focus stop that does nothing when you press an arrow key is worse than no focus stop —
 * axe is satisfied and the keyboard user is standing in a dead end. The contrast is
 * `HeaderContentFooter`'s scrolling body, which takes a tab stop precisely because it
 * *does* something once you are there. Scrolling stays there too: a pane that needs to scroll is
 * a `StickyHeaderContentFooter` passed as `firstSlot` or `secondSlot`, so this shell adds no scroll
 * container of its own and no keyboard trap to go with it.
 *
 * **A collapsed pane is an absent one.** Every second pane eventually wants to close, and the
 * whole of that is `secondSlot={open ? nav : undefined}` — the caller already holds the toggle, and
 * the un-split layout is the full-width column that was needed anyway for the inspector with
 * nothing selected. A `collapsed` prop would buy a second way to say it and a piece of state to
 * keep in step with the first.
 *
 * **No `loading`.** `CardLayout` has one because a card has a single body and a precedence to
 * own (`loading` outranks `emptySlot`). A split has neither: it has two panes that arrive at
 * different times, and one boolean across both has to either skeleton a pane that was never
 * waiting or pick one, which is a second prop. The prior art shows the failure directly — the
 * layout this is drawn from had a `loading` that replaced the entire chassis with a bare
 * skeleton, so chrome already on the screen blinked out and came back. Each pane's content owns
 * its own loading state, and a pane that is a `CardLayout` already has the word for it.
 *
 * **Horizontal only.** Stacking below `stackBelow` is the vertical arrangement, and a split that
 * is vertical at every width is two zones in a column with floors between them — which is
 * `HeaderContentFooter`, already. A vertical orientation here would be rule 7's exact bug:
 * a second implementation of a shape another shell owns.
 */
export function SplitLayout({
  firstSlot,
  secondSlot,
  firstWidth,
  secondWidth,
  stackBelow = 'lg',
  divider = 'space',
  className,
  firstClassName,
  secondClassName,
}: SplitLayoutProps) {
  // Rule 5 — an absent slot draws nothing. Not an empty cell, and not a gap still spent: with one
  // pane there is one column and it has the whole width.
  if (!secondSlot) {
    return (
      <View testID="split-layout" className={cn('min-h-0 min-w-0 flex-col', className)}>
        <View testID="split-layout-first" className={cn(PANE, firstClassName)}>
          {firstSlot}
        </View>
      </View>
    );
  }

  // One pane carries the width and the other takes the rest. Neither given, `half` is two even
  // panes, which is the same classes on both.
  const width = secondWidth ?? firstWidth ?? 'half';
  const sized = SIZED[stackBelow][width];
  const rest = REST[stackBelow][width === 'fifth' || width === 'two-fifths' ? width : 'other'];

  return (
    <View
      testID="split-layout"
      className={cn('min-h-0 min-w-0', STACK_BELOW[stackBelow], DIVIDERS[divider], className)}
    >
      <View testID="split-layout-first" className={cn(PANE, secondWidth ? rest : sized, firstClassName)}>
        {firstSlot}
      </View>
      {divider === 'line' ? (
        // The rule is an element of its own rather than a border on a pane, so that when the
        // panes stack it becomes a row between them instead of a line down one side of the screen.
        <View
          testID="split-layout-divider"
          aria-hidden
          className={cn('shrink-0 self-stretch bg-foreground/10', DIVIDER_AT[stackBelow])}
        />
      ) : null}
      <View testID="split-layout-second" className={cn(PANE, secondWidth ? sized : rest, secondClassName)}>
        {secondSlot}
      </View>
    </View>
  );
}

/**
 * The sidebar pane under {@link SidebarLayout}'s `sidebarHideBelow`: not drawn under the
 * breakpoint, drawn from it up. The same breakpoints, and the same media query in the stylesheet,
 * as `Sidebar`'s `hideBelow`, so the first paint is already right on both halves.
 *
 * A pane is a flex column, so it comes back as `flex`. Literal classes per rule 3.
 */
const SIDEBAR_HIDE_BELOW = {
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
  xl: 'hidden xl:flex',
} as const;

/**
 * The bar's half of the same switch: drawn under the breakpoint, gone from it up. Keyed by the
 * same names as {@link SIDEBAR_HIDE_BELOW} so the two can never disagree about where the sidebar
 * hands over to the bar.
 */
const HEADER_HIDE_FROM = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
} as const;

/** The column the content pane becomes once a bar sits over it. */
const COLUMN = 'min-h-0 min-w-0 flex-1';

/** Under the bar: the caller's node, in the box a pane would have given it (see PANE). */
const BELOW_HEADER = 'min-h-0 min-w-0 flex-1';

/** The bar's navigation is a landmark, and a landmark with no name is one of several `nav`s. */
type SidebarLayoutNav =
  | {
      /**
       * The bar's navigation: the app's places, usually as icon links. Drawn inside a `<nav>` —
       * `role="navigation"` on device — named by `navLabel`, which is the landmark every
       * hand-written bar either forgot or spelled differently.
       */
      navSlot: SlotNode;
      /** What the bar's navigation landmark is called — "Main". Required with `navSlot`. */
      navLabel: string;
    }
  | { navSlot?: undefined; navLabel?: never };

/**
 * Either the sidebar is drawn at every width, and the layout places two panes the way it always
 * has, or it is hidden under `sidebarHideBelow` and a bar stands in for it there.
 */
type SidebarLayoutNarrow =
  | {
      sidebarHideBelow?: undefined;
      /** Below this width the two stack rather than sit side by side. See {@link SplitLayout}. */
      stackBelow?: keyof typeof STACK_BELOW | undefined;
      divider?: keyof typeof DIVIDERS | undefined;
      brandSlot?: never;
      navSlot?: never;
      navLabel?: never;
      status?: never;
      actionSlot?: never;
    }
  | ({
      /**
       * Under this width the sidebar pane is not drawn and the bar — `brandSlot`, `navSlot`,
       * `status`, `actionSlot` — is drawn over `contentSlot` in its place; from it up, the other
       * way round. For an app's navigation rail, which has no room on a phone and does not stack.
       *
       * Hidden is `display: none`, so the rail leaves the accessibility tree rather than staying a
       * landmark with nothing visible in it, and the bar is a banner only where it is on screen.
       * Given this, leave `Sidebar`'s own `hideBelow` off: the layout owns the breakpoint, so the
       * rail and the bar cannot be told two different ones.
       */
      sidebarHideBelow: keyof typeof SIDEBAR_HIDE_BELOW;
      /** A rail that hides does not stack — under the breakpoint there is nothing to stack. */
      stackBelow?: never;
      /**
       * `line` is out: the rule is drawn between the panes, and with the sidebar gone it would be
       * a line down the edge of the screen. A `Sidebar` draws its own border; pass `none`.
       */
      divider?: 'space' | 'none' | undefined;
      /** The bar's start: the app's mark and name, as the rail's header shows them. */
      brandSlot?: SlotNode | undefined;
      /**
       * One line saying what state the app is in — "3/5 servers running" — between the `navSlot`
       * and the `actionSlot`. It gets the width the rest of the bar leaves and no more, so on a
       * narrow bar it is the first thing to give way: a string is cut short with an ellipsis, down
       * to nothing, before the brand, a place or an action loses a pixel. A node is clipped to the
       * same box and truncates itself.
       */
      status?: ReactNode | undefined;
      /** The bar's far end: the theme switch, sign out — the rail's footer, in one row. */
      actionSlot?: SlotNode | undefined;
    } & SidebarLayoutNav);

type SidebarLayoutProps = {
  /**
   * The main surface — the one the screen is about. Alone, it is the whole width, so a caller
   * never has to special-case the un-split state.
   */
  contentSlot: SlotNode;
  /**
   * The second surface: a navigation column, an inspector, a note list, an order panel.
   *
   * Absent, the pane is one full-width column and neither a sidebar cell nor a divider is drawn.
   */
  sidebarSlot?: SlotNode | undefined;
  /** Which side the sidebar sits on. Stacked, it keeps this reading order rather than jumping. */
  sidebarPosition?: 'start' | 'end' | undefined;
  /** {@link SplitWidth}. Naming the width is what stops eight call sites each inventing one. */
  sidebarWidth?: SplitWidth | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  sidebarClassName?: string | undefined;
  /** On the bar, when `sidebarHideBelow` draws one. */
  headerClassName?: string | undefined;
} & SidebarLayoutNarrow;

/**
 * {@link SplitLayout} with the roles put back: a main surface, and a sidebar beside it.
 *
 * This is the common case and it is worth its own name — most splits are not even. `contentSlot` is
 * the main surface in every shell in this set (rule 2), and it keeps that meaning here, so the
 * pair reads the way it does everywhere else and the width is named for the pane a caller
 * actually thinks about: the sidebar.
 *
 * A preset rather than a second implementation, exactly as `StickyHeaderContentFooter` presets
 * `HeaderContentFooter`. When the two panes are genuinely comparable — a diff, two lists side by
 * side, a form beside its preview — reach for `SplitLayout` directly and its numbered slots,
 * rather than calling one of two equals the "sidebar".
 *
 * **`sidebarHideBelow` is the app shell's narrow width.** Six apps drew the same thing by hand: a
 * rail hidden under `md`, and over the page an `md:hidden` bar with the brand, the places as icon
 * links and the rail's footer buttons in a row. The two halves were two class strings that had to
 * name the same breakpoint, and the bar's `<nav>` had a name in some copies and not in others.
 * Here the breakpoint is said once and both halves read it, and the bar is a `header` — the
 * banner — with the navigation landmark inside it, named. The places in it are `BarNavItem`s
 * (`sidebar.tsx`), the rail's rows with only the icon drawn.
 *
 * **`status` is the bar's one line of words**, and the part that yields. The brand, the places and
 * the actions keep their width; the status takes what is left between the `navSlot` and the
 * `actionSlot`, so on a 390px phone it shortens, and on a narrower bar still it is gone, rather
 * than pushing an action off the edge. Without the slot an app put the line in `actionSlot`, which
 * never shrinks.
 *
 * It holds no state: nothing opens, nothing is remembered, and which of the two is drawn is a
 * media query in the stylesheet rather than a width read in JavaScript. On device NativeWind reads
 * the same breakpoint off the window, so a phone draws the bar and a tablet the rail — the answer
 * `Sidebar`'s `hideBelow` already gives there. A drawer that slides the rail in over the page is a
 * different component, with an open state, and not this one.
 */
export function SidebarLayout({
  contentSlot,
  sidebarSlot,
  sidebarPosition = 'end',
  sidebarWidth = 'sm',
  sidebarHideBelow,
  stackBelow = 'lg',
  divider = 'space',
  brandSlot,
  navSlot,
  navLabel,
  status,
  actionSlot,
  className,
  contentClassName,
  sidebarClassName,
  headerClassName,
}: SidebarLayoutProps) {
  // Rule 5 — the bar, and the column it sits in, are drawn only when there is something in the
  // bar. Without one the content pane holds the caller's node exactly as it always has.
  const main =
    sidebarHideBelow && (brandSlot || navSlot || status || actionSlot) ? (
      <View testID="sidebar-layout-main" className={COLUMN}>
        <View
          role="banner"
          testID="sidebar-layout-header"
          className={cn(
            'min-h-14 shrink-0 flex-row items-center gap-2 border-foreground/10 border-b bg-background px-4 py-2',
            HEADER_HIDE_FROM[sidebarHideBelow],
            headerClassName,
          )}
        >
          {brandSlot ? (
            <View testID="sidebar-layout-brand" className="min-w-0 shrink-0 flex-row items-center gap-2">
              {brandSlot}
            </View>
          ) : null}
          {navSlot ? (
            <View
              role="navigation"
              aria-label={navLabel}
              testID="sidebar-layout-nav"
              className="min-w-0 flex-row items-center gap-1"
            >
              {navSlot}
            </View>
          ) : null}
          {status ? (
            // `flex-1` is a zero basis: the status asks for no width of its own and is handed
            // what the others leave, which is what makes it the one that gives way. Everything
            // else in the bar is `shrink-0` or a view, which does not shrink either.
            <View testID="sidebar-layout-status" className="min-w-0 flex-1 overflow-hidden">
              {typeof status === 'string' || typeof status === 'number' ? (
                <Text className="truncate text-right text-foreground/60 text-sm">{status}</Text>
              ) : (
                status
              )}
            </View>
          ) : null}
          {actionSlot ? (
            // `ml-auto` rather than a spacer, so the action keeps the far end with no `navSlot`
            // before it.
            <View testID="sidebar-layout-action" className="ml-auto shrink-0 flex-row items-center gap-1">
              {actionSlot}
            </View>
          ) : null}
        </View>
        <View testID="sidebar-layout-content" className={BELOW_HEADER}>
          {contentSlot}
        </View>
      </View>
    ) : (
      contentSlot
    );

  // No sidebar is one pane, and `firstSlot` is the one that is there — passing an absent
  // `firstSlot` with a present `secondSlot` would be a hole in the middle of the row.
  if (!sidebarSlot) {
    return <SplitLayout firstSlot={main} firstClassName={contentClassName} className={className} />;
  }

  const atStart = sidebarPosition === 'start';
  const railClassName = sidebarHideBelow
    ? cn(SIDEBAR_HIDE_BELOW[sidebarHideBelow], sidebarClassName)
    : sidebarClassName;

  return (
    <SplitLayout
      firstSlot={atStart ? sidebarSlot : main}
      secondSlot={atStart ? main : sidebarSlot}
      firstClassName={atStart ? railClassName : contentClassName}
      secondClassName={atStart ? contentClassName : railClassName}
      {...(atStart ? { firstWidth: sidebarWidth } : { secondWidth: sidebarWidth })}
      stackBelow={sidebarHideBelow ? 'never' : stackBelow}
      divider={divider}
      className={className}
    />
  );
}
