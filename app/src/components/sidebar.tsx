import type { ReactNode } from 'react';
import * as React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { type HeaderContentFooterProps, StickyHeaderContentFooter } from '@/components/header-content-footer';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { IconClassContext } from '@/components/ui/icons-base';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, type SlotNode } from '@/lib/utils';

/**
 * Hidden under the breakpoint, shown from it up. `flex` is what the root is on both platforms: a
 * compiled view is a flex column by its reset, and every view on device is one already.
 *
 * Literal classes rather than a composed one, per rule 3: Tailwind's scanner reads source text, so
 * `` `${bp}:flex` `` names a class that is never generated. It is a media query in the stylesheet,
 * not one in JavaScript, so the first paint is already right — no frame with the rail drawn and
 * then taken away.
 */
const HIDE_BELOW = {
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
  xl: 'hidden xl:flex',
} as const;

/** What a sidebar tells what is inside it: whether it is folded, and which edge it is on. */
type SidebarState = {
  /** Folded down to a rail of icons. `false` outside a `Sidebar`. */
  collapsed: boolean;
  /** The `Sidebar`'s own `onCollapsedChange`: call it to fold or open the sidebar. */
  onCollapsedChange?: ((collapsed: boolean) => void) | undefined;
  side: 'start' | 'end';
};

const SidebarContext = React.createContext<SidebarState>({ collapsed: false, side: 'start' });

/**
 * The state of the `Sidebar` this is drawn in, for a header or footer that is a different thing
 * folded: a brand that becomes its mark, a "New chat" button that becomes an icon button. The rows
 * and sections read it themselves.
 */
export function useSidebar(): SidebarState {
  return React.useContext(SidebarContext);
}

export type SidebarProps = {
  /** The body: sections, rows, whatever the rail lists. The only part that scrolls. */
  contentSlot: SlotNode;
  /** The brand, a primary action. Stays put while the body scrolls. Absent, no row is drawn. */
  headerSlot?: SlotNode | undefined;
  /** Quiet rows — settings, sign out, the account. Drawn over a hairline. */
  footerSlot?: SlotNode | undefined;
  /**
   * What the sidebar is called — "Main", "Projects". It names the `<aside>` on the web, which is
   * what tells a screen reader's landmark list one complementary region from another.
   */
  label?: string | undefined;
  /**
   * Which edge of the screen the sidebar sits against, which decides the edge its border is on.
   * `start` (the default) draws it on the right, facing the content.
   */
  side?: 'start' | 'end' | undefined;
  /**
   * Under this width the sidebar is not drawn at all; from it up, it is. For a rail that has no
   * room on a phone, where the page puts its furniture in a bar of its own instead. Absent, it is
   * drawn at every width.
   *
   * Hidden is `display: none`, so it leaves the accessibility tree too, rather than staying a
   * landmark with nothing visible in it.
   *
   * Inside a `SidebarLayout`, pass `sidebarHideBelow` to the layout instead: it hides the pane at
   * the same breakpoint and draws the bar that stands in for the rail, from the one value.
   */
  hideBelow?: keyof typeof HIDE_BELOW | undefined;
  /**
   * Folded down to a rail of icons: every row is its icon, named and tooltipped by its label, and
   * a section's title is read but not drawn. Controlled — the sidebar keeps no state, so where the
   * choice is remembered is the app's.
   */
  collapsed?: boolean | undefined;
  /**
   * Called with the state the reader asked for, by a `SidebarCollapseButton` anywhere inside. Left
   * out, that button does nothing.
   */
  onCollapsedChange?: ((collapsed: boolean) => void) | undefined;
  /** The scrolling body, for restoring a scroll position — see `HeaderContentFooter`. */
  contentRef?: HeaderContentFooterProps['contentRef'];
  /** On the root. A different width is a `w-*` here. */
  className?: string | undefined;
  headerClassName?: string | undefined;
  contentClassName?: string | undefined;
  footerClassName?: string | undefined;
};

/**
 * The sidebar frame: header, a body that scrolls, footer, on the sidebar palette.
 *
 * **Fixed width, `w-64`.** A navigation rail's width is set by the longest name it has to show,
 * not by the window, so it does not grow with the screen — shadcn's own sidebar is the same
 * `16rem`. Inside a `SidebarLayout`, pass `sidebarWidth="auto"` so the pane is as wide as this and
 * no wider; a narrower or wider rail is one `w-*` in `className`, not a width scale of its own.
 *
 * **It draws its own border**, in `sidebar-border`, on the edge that faces the content. That is
 * the one thing `SidebarLayout`'s `divider="line"` warns against — but a sidebar that sits beside
 * the content at every width is not a pane that stacks, and the border is part of the palette the
 * sidebar owns. Under a layout that does stack, use `divider="none"` and `className="border-r-0"`
 * and let the layout draw the rule, or leave the layout at `stackBelow="never"`.
 *
 * It needs a height, like any sticky chassis: `h-full`, so the ancestors up to the viewport have
 * to give it one or the body grows instead of scrolling.
 *
 * **`hideBelow` is its narrow-width answer.** A rail is not a pane that stacks, so under a phone's
 * width it goes rather than landing on top of the page. `hidden md:flex` in `className` did the
 * same only while the root's display came from a class merged before the caller's; these are the
 * same two classes, owned here. Inside a `SidebarLayout` the layout's `sidebarHideBelow` is the
 * same switch one level up — it hides the pane rather than leaving an empty one, and draws the
 * bar that stands in for the rail under the same breakpoint.
 *
 * **`collapsed` folds it to a rail**, `w-14`, without taking a destination away. A split layout's
 * collapsed pane is an absent one, and that is right for a detail pane; a navigation sidebar still
 * has to show every place it goes, so folded it is the rows' icons. The state is here and not on
 * `SidebarLayout`, which only places panes: with `sidebarWidth="auto"` the pane follows this width.
 * The rows and sections fold themselves from context, and `useSidebar` hands the same state to
 * whatever the app put in the header and footer.
 */
export function Sidebar({
  contentSlot,
  headerSlot,
  footerSlot,
  label,
  side = 'start',
  hideBelow,
  collapsed = false,
  onCollapsedChange,
  contentRef,
  className,
  headerClassName,
  contentClassName,
  footerClassName,
}: SidebarProps) {
  const state = React.useMemo(() => ({ collapsed, onCollapsedChange, side }), [collapsed, onCollapsedChange, side]);

  return (
    // `complementary` rather than `webAs="aside"`: it is the same `<aside>` once compiled, and it
    // is also what react-native-web renders, where a bare `div` would carry an `aria-label` that
    // ARIA prohibits on an element with no role.
    <View
      role="complementary"
      testID="sidebar"
      aria-label={label}
      className={cn(
        'h-full min-h-0 shrink-0 border-foreground/10 bg-secondary',
        collapsed ? 'w-14' : 'w-64',
        side === 'start' ? 'border-r' : 'border-l',
        hideBelow ? HIDE_BELOW[hideBelow] : undefined,
        className,
      )}
    >
      <SidebarContext.Provider value={state}>
        <StickyHeaderContentFooter
          headerSlot={headerSlot}
          contentSlot={contentSlot}
          footerSlot={footerSlot}
          contentRef={contentRef}
          // `flex-1` rather than the preset's `h-full` alone: the frame's own border is inside its
          // height, and a percentage height would overflow it by the border's width.
          className="min-h-0 flex-1"
          // Folded, the header's inset is the rows', so what is in it lines up with their icons.
          headerClassName={cn('gap-2', collapsed ? 'p-2' : 'p-3', headerClassName)}
          contentClassName={cn('gap-4 p-2', contentClassName)}
          footerClassName={cn('gap-0.5 border-foreground/10 border-t p-2', footerClassName)}
        />
      </SidebarContext.Provider>
    </View>
  );
}

/**
 * A section is a navigation landmark (`as="nav"`, which `label` can name) or it is not, and a
 * `label` with no landmark to name is a type error rather than a name nothing reads.
 */
type SidebarSectionLandmarkProps =
  | {
      /**
       * `nav` makes the section a navigation landmark — `<nav>` on the web, `role="navigation"` on
       * device — so a screen reader's landmark jump reaches its rows. For the sections that are
       * the app's navigation; a list of recent items or pinned searches stays out of it.
       */
      as: 'nav';
      /**
       * What the landmark is called — "Main", "Projects". Absent, the `title` names it; give one
       * when there is no title, or when two navigation sections would otherwise share a name.
       */
      label?: string | undefined;
    }
  | { as?: undefined; label?: never };

export type SidebarSectionProps = SidebarSectionLandmarkProps & {
  /** The overline over the rows. A short noun — "Projects", "Pinned". */
  title?: ReactNode | undefined;
  /**
   * The rows, as an array — `projects.map(…)`, each with its `key`. Each one becomes an item of
   * the list, so pass the rows themselves rather than a fragment or a wrapper around them: a
   * wrapper would be one item holding every row.
   */
  contentSlot?: SlotNode | undefined;
  /**
   * What the section says instead of rows, or before them: failed, loading, empty. Drawn between
   * the title and the list, so it is the place for a `<QueryState compact … />`, which renders
   * nothing once there are rows.
   */
  status?: ReactNode | undefined;
  /** The title row's far end: an add button, a filter. */
  actionSlot?: SlotNode | undefined;
  /**
   * The title's heading rank. `2` by default — the sidebar sits beside the page, not under its
   * `h1`. Pick it by structure, never by size; the text is the same at every level.
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
  className?: string | undefined;
  /** On the list the rows are items of. */
  contentClassName?: string | undefined;
};

/**
 * A titled list of rows in a sidebar.
 *
 * The rows are a real list — `role="list"` and `role="listitem"`, a `<ul>` and its `<li>`s on the
 * web — named by the title, so a screen reader says "Projects, list, 12 items" before the first
 * row rather than reading twelve links with nothing to say where they end. The items are drawn
 * here rather than by `SidebarNavItem`, because the same row stands alone in a footer, where an
 * item with no list around it is markup axe rejects.
 *
 * The title is `Section`'s overline at a rail's inset, not `Section` itself: a section's body is
 * fields with a gap between them, and a sidebar's is rows that butt up against one another.
 *
 * No list is drawn when there are no rows, so an empty or loading section is the title and its
 * `status` and nothing else — not an empty `<ul>` announced as "list, 0 items".
 *
 * **`as="nav"` makes it the navigation landmark.** `Sidebar` is a complementary `<aside>`, and
 * nothing in a sidebar of links is otherwise navigation, so a landmark jump never reached the rows
 * and every app wrapped the section in a hand-written `<nav aria-label>`. The whole section is the
 * landmark — title, status and list — named by the title unless `label` says otherwise.
 *
 * **In a collapsed sidebar** the title is read and not drawn, so the list keeps its name, and the
 * `actionSlot` and `status` are not drawn at all: neither has a rail's width to be in.
 */
export function SidebarSection({
  as,
  label,
  title,
  contentSlot,
  status,
  actionSlot,
  level = 2,
  className,
  contentClassName,
}: SidebarSectionProps) {
  const titleId = React.useId();
  const { collapsed } = React.useContext(SidebarContext);
  const rows = React.Children.toArray(contentSlot);
  const sectionClassName = cn('min-w-0 gap-1', className);

  const body = (
    <>
      {(collapsed ? title : title || actionSlot) ? (
        <View
          testID="sidebar-section-heading"
          // Folded, the whole row is clipped: the title is still what names the list.
          className={collapsed ? SR_ONLY : 'min-h-8 min-w-0 flex-row items-center gap-2 px-2'}
        >
          <View className="min-w-0 flex-1">
            {title ? (
              // biome-ignore lint/a11y/useSemanticElements: React Native has no heading element; role="heading" is the cross-platform form
              <Text
                testID="sidebar-section-title"
                nativeID={titleId}
                role="heading"
                aria-level={level}
                className="truncate font-semibold text-foreground/60 text-xs uppercase tracking-wide"
              >
                {title}
              </Text>
            ) : null}
          </View>
          {actionSlot && !collapsed ? (
            <View testID="sidebar-section-action" className="shrink-0">
              {actionSlot}
            </View>
          ) : null}
        </View>
      ) : null}

      {collapsed ? null : status}

      {rows.length > 0 ? (
        <View
          role="list"
          testID="sidebar-section-list"
          {...(title ? { 'aria-labelledby': titleId } : {})}
          className={cn('min-w-0 gap-0.5', contentClassName)}
        >
          {rows.map((row, index) => (
            <View
              // `toArray` has already keyed every element from the caller's own keys.
              key={React.isValidElement(row) && row.key !== null ? row.key : index}
              role="listitem"
              testID="sidebar-section-item"
              className="min-w-0"
            >
              {row}
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  // Two roots written out rather than one with a chosen role: the compiler picks the tag from the
  // role, and a role it cannot read is one it refuses.
  if (as === 'nav') {
    return (
      <View
        role="navigation"
        testID="sidebar-section"
        {...(label ? { 'aria-label': label } : title ? { 'aria-labelledby': titleId } : {})}
        className={sectionClassName}
      >
        {body}
      </View>
    );
  }

  return (
    <View testID="sidebar-section" className={sectionClassName}>
      {body}
    </View>
  );
}

type PressableProps = React.ComponentProps<typeof Pressable>;

/**
 * A row's status: words, and the glyph that stands for them. An object rather than a node because
 * the words have to reach the row's accessible name on device, and a node's text cannot be read
 * back out into an `accessibilityLabel`.
 */
export type SidebarNavItemStatus = {
  /** What is read, and what is drawn when there is no `iconSlot`. */
  label: string;
  /** What is drawn instead of the label. Decorative: the label is what a screen reader hears. */
  iconSlot?: SlotNode | undefined;
};

/** Off the screen and still read. `sr-only` is a clip, which the device does not have. */
const SR_ONLY = Platform.select({
  web: 'sr-only',
  default: 'absolute -m-px h-px w-px overflow-hidden',
});

/** What both forms of the row take. */
type SidebarNavItemBaseProps = Omit<PressableProps, 'children' | 'className' | 'style'> & {
  /** What the row is called. Truncated to one line, never wrapped. */
  label: string;
  /** Before the label. Pass a bare `<Folder />`; the row sizes and colours it. */
  iconSlot?: SlotNode | undefined;
  /** At the far end: how many things are behind the row. */
  count?: number | string | undefined;
  /**
   * What state the row's thing is in — "MCP on", "offline", "draft" — drawn before the `count`.
   * `label` is required because it is what is read: the row's name becomes "Work, MCP on, 2". With
   * an `iconSlot` the icon is what is seen and the label is read only; without one the label is
   * drawn, small and muted. `SidebarSection`'s `status` is the same word for the section's own
   * state.
   */
  status?: SidebarNavItemStatus | undefined;
  // Re-declared rather than inherited, for `exactOptionalPropertyTypes` — see `segmented.tsx`.
  className?: string | undefined;
};

/** The row that goes somewhere, and says where itself. */
type SidebarNavItemLinkProps = {
  /** Where the row goes. The `<a href>` on the web. */
  href: string;
  /** The row for the page on screen — filled, and `aria-current="page"`. */
  active?: boolean | undefined;
};

/**
 * The row that goes somewhere a router link wrapping it names — TanStack's `createLink`, or
 * expo-router's `<Link href asChild>`. Both hand the row its `href` and its press handler at
 * render, so writing either here as well is the destination said twice, and two copies that can
 * drift: the `<a href>` middle-click opens and the route the click goes to.
 *
 * No handler of its own for the same reason: a row with no `href` that *does* take one is the
 * button below, and a row with both `onPress` and `active` is neither.
 */
type SidebarNavItemRouterLinkProps = {
  href?: undefined;
  /** The row for the page on screen — filled, and `aria-current="page"`. */
  active?: boolean | undefined;
  onPress?: never;
};

/**
 * The row that does something — Sign out. No `href`, so no `active`: a button is never the page
 * on screen, and `aria-current` on one would say it was.
 */
type SidebarNavItemButtonProps = {
  href?: never;
  active?: never;
  /** What the row does. Required: it is what tells a button row from a router's link row. */
  onPress: NonNullable<React.ComponentProps<typeof Pressable>['onPress']>;
};

/**
 * A row is a link (`href`, and `active` for the current page), a link whose router supplies the
 * `href`, or a button (`onPress`, never `active`). `onPress` is what tells the last two apart, so
 * `active` on a button is a type error rather than a row that is quietly half of each.
 */
export type SidebarNavItemProps = SidebarNavItemBaseProps &
  (SidebarNavItemLinkProps | SidebarNavItemRouterLinkProps | SidebarNavItemButtonProps);

/** The row's box, the same for both forms — the classes a hand-drawn Sign out row used to copy. */
function rowClassName(active: boolean, className: string | undefined) {
  return cn(
    'min-h-8 min-w-0 flex-row items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
    'focus-visible:outline-none',
    // The web half's icons size from here, as a `Button`'s do; device's from the context below.
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'bg-active text-active-foreground focus-visible:bg-active/90'
      : 'text-foreground hover:bg-hover focus-visible:bg-hover',
    className,
  );
}

/**
 * A count and a status where there is only an icon to hang them on: the count a small badge on the
 * top corner, the status a dot on the bottom one. Neither is named here — the words are in the
 * name of the link they sit on. `ring` is the fill behind the item, which is what keeps a marker
 * apart from the glyph under it.
 */
function IconMarkers({
  count,
  status,
  ring,
}: {
  count: number | string | undefined;
  status: SidebarNavItemStatus | undefined;
  ring: string;
}) {
  return (
    <>
      {count === undefined ? null : (
        // Hung off the item's top corner, in the 8px the icon leaves above it, so the count sits
        // over the glyph's corner rather than over the glyph — and by little enough that it never
        // reaches a neighbour's icon. The text is its own element because a badge's label is 12px
        // on a 16px line, which is taller than that corner.
        <Badge variant="secondary" className={cn('-right-1.5 -top-1.5 absolute px-1 py-0', ring)}>
          <Text className="font-medium text-[10px] text-foreground leading-3 tabular-nums">{count}</Text>
        </Badge>
      )}
      {status ? <Badge className={cn('-bottom-0.5 -right-0.5 absolute h-2.5 w-2.5', ring)} /> : null}
    </>
  );
}

/** The row's whole name, as device reads it and as a folded row, with no text in it, is named. */
function rowName(label: string, status: SidebarNavItemStatus | undefined, count: number | string | undefined) {
  return [label, status?.label, count].filter((part) => part !== undefined).join(', ');
}

/**
 * A folded row under its tooltip: the label is nowhere on screen, so a pointer or a long press
 * brings it up, on the side the page is on. Its own provider, as `BarNavItem`'s is.
 */
function withTooltip(row: React.ReactElement, label: string, side: 'start' | 'end') {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent side={side === 'start' ? 'right' : 'left'}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type SidebarNavItemBodyProps = {
  label: string;
  iconSlot: SlotNode | undefined;
  count: number | string | undefined;
  status: SidebarNavItemStatus | undefined;
  active: boolean;
  collapsed: boolean;
};

/** What is inside the row, the same for both forms: icon, label, status, count. */
function SidebarNavItemBody({ label, iconSlot, count, status, active, collapsed }: SidebarNavItemBodyProps) {
  // Native inherits no colour, so the label, the count and the icon each carry it. The active
  // count takes the row's foreground rather than muted: muted on the selection fill is under 4.5:1.
  const text = active ? 'text-active-foreground' : 'text-foreground';
  const muted = active ? 'text-active-foreground' : 'text-foreground/60';

  if (collapsed) {
    // The icon alone, as the bar's item draws a place. A row with no icon is its first letter, so
    // it is still something to aim at rather than a gap in the rail.
    return (
      <>
        {iconSlot ? (
          <IconClassContext.Provider value={cn('size-4 shrink-0', text)}>{iconSlot}</IconClassContext.Provider>
        ) : (
          <Text testID="sidebar-nav-item-initial" aria-hidden className={cn('font-medium text-sm', text)}>
            {Array.from(label.trim())[0]?.toUpperCase()}
          </Text>
        )}
        <IconMarkers count={count} status={status} ring="border-secondary" />
      </>
    );
  }

  return (
    <>
      {iconSlot ? (
        <IconClassContext.Provider value={cn('size-4 shrink-0', text)}>{iconSlot}</IconClassContext.Provider>
      ) : null}
      <Text
        testID="sidebar-nav-item-label"
        className={cn('min-w-0 flex-1 truncate text-sm', active && 'font-medium', text)}
      >
        {label}
      </Text>
      {status?.iconSlot ? (
        <View testID="sidebar-nav-item-status-icon" aria-hidden className="shrink-0">
          <IconClassContext.Provider value={cn('size-4 shrink-0', muted)}>{status.iconSlot}</IconClassContext.Provider>
        </View>
      ) : null}
      {/* With an icon the words are read and not seen: a clip, as a loading page title's is. */}
      {status ? (
        <Text testID="sidebar-nav-item-status" className={cn('shrink-0 text-xs', status.iconSlot ? SR_ONLY : muted)}>
          {status.label}
        </Text>
      ) : null}
      {count === undefined ? null : (
        <Text testID="sidebar-nav-item-count" className={cn('shrink-0 text-xs tabular-nums', muted)}>
          {count}
        </Text>
      )}
    </>
  );
}

/**
 * One row of a sidebar: a link with an optional icon, a label that truncates, an optional
 * `status` and an optional count. The current page is filled with `active`, as every chosen
 * control is; hover fills it with `hover`.
 *
 * Wrap it in the router's own link rather than passing a router to it:
 *
 * ```tsx
 * <Link href={`/projects/${id}`} asChild>
 *   <SidebarNavItem label={name} active={id === current} />
 * </Link>
 *
 * const SidebarLink = createLink(SidebarNavItem); // TanStack Router
 * <SidebarLink to="/" label="Documents" active={isCurrent} />
 * ```
 *
 * `Link asChild` clones its child with the `href` and the press handler, and `createLink` renders
 * it with both; this forwards the ref and every prop it does not name to the `Pressable`, which is
 * what lets them land. So neither passes `href` to the row — the router's is the one destination,
 * and the row is a real `<a href>` all the same. A router that hands out only a click handler —
 * react-router's `useLinkClickHandler` — passes it as `onClick` beside the row's own `href`.
 *
 * `role="link"` is what makes it a link on both platforms: TalkBack and VoiceOver say "link", and
 * the compiler emits an `<a>`. The current page is said twice, for the same reason `segmented`
 * says its pill twice — `accessibilityState` on device, `aria-current="page"` on the web, which is
 * the one spelling a web screen reader reads and the one react-native-web would have dropped.
 *
 * **With `onPress` and no `href` it is a button** — `onClick` on the web, and no `active`.
 * That is the footer's Sign out: drawn like the Settings row above it, but it does something
 * rather than going somewhere, so it is `role="button"` on device and a `<button type="button">`
 * on the web, and never carries `aria-current`. What decides the element is the `href` the row
 * *renders* with, so a router's row is a link however it was written; a row written with neither
 * and no router around it has nowhere to go and nothing to do, and is drawn as an inert button.
 *
 * ```tsx
 * <SidebarNavItem label="Sign out" iconSlot={<LogOut />} onPress={signOut} />
 * ```
 *
 * **In a collapsed `Sidebar` it is its icon**, and the same link or button underneath. The label
 * is its accessible name and its tooltip, the count is a badge on the icon and the status a dot,
 * both still in the name — the way `BarNavItem` draws a place. A row with no `iconSlot` is its
 * first letter.
 */
const SidebarNavItem = React.forwardRef<React.ElementRef<typeof Pressable>, SidebarNavItemProps>(
  ({ href, label, iconSlot, count, status, active = false, className, ...props }, ref) => {
    const { collapsed, side } = React.useContext(SidebarContext);
    const name = rowName(label, status, count);
    const rail = (row: React.ReactElement) => (collapsed ? withTooltip(row, label, side) : row);
    // Folded, the row is a square around its icon, and the markers hang off its corners.
    const box = cn(collapsed && 'relative justify-center px-0', className);

    // Two elements written out rather than one with a chosen role: the compiler picks the tag from
    // the role, and a button and a link do not share a prop list anyway.
    if (href === undefined) {
      return rail(
        <Pressable
          ref={ref}
          role="button"
          className={rowClassName(false, box)}
          {...(Platform.OS === 'web' ? {} : { accessibilityLabel: name })}
          // Nothing inside a folded row is text, so the web's name is written out too.
          {...(collapsed ? { 'aria-label': name } : {})}
          {...props}
        >
          <SidebarNavItemBody
            label={label}
            iconSlot={iconSlot}
            count={count}
            status={status}
            active={false}
            collapsed={collapsed}
          />
        </Pressable>,
      );
    }

    return rail(
      <Pressable
        ref={ref}
        role="link"
        accessibilityState={{ selected: active }}
        // React Native has no `href` and no `aria-current`; the web has both, and needs both. The
        // web names the row from the text inside it; device reads a pressable as one element, so
        // its name is joined here — before `props`, so a caller's own label still wins.
        {...(Platform.OS === 'web'
          ? ({ href, 'aria-current': active ? 'page' : undefined } as const)
          : { accessibilityLabel: name })}
        {...(collapsed ? { 'aria-label': name } : {})}
        className={rowClassName(active, box)}
        {...props}
      >
        <SidebarNavItemBody
          label={label}
          iconSlot={iconSlot}
          count={count}
          status={status}
          active={active}
          collapsed={collapsed}
        />
      </Pressable>,
    );
  },
);
SidebarNavItem.displayName = 'SidebarNavItem';

export type SidebarCollapseButtonProps = {
  /** What it is called while the sidebar is open. */
  collapseLabel?: string | undefined;
  /** What it is called while the sidebar is folded. */
  expandLabel?: string | undefined;
  className?: string | undefined;
};

/**
 * The button that folds the sidebar it is in and opens it again: a row like any other, so it sits
 * in the header or the footer without a look of its own, and folded it is its icon under a
 * tooltip like the rows around it.
 *
 * It holds nothing. It calls the `Sidebar`'s `onCollapsedChange` with the other state, and says
 * which state that is with `aria-expanded`. The chevron points the way the sidebar will move, so
 * it turns round on a sidebar at the `end` edge.
 */
export function SidebarCollapseButton({
  collapseLabel = 'Collapse sidebar',
  expandLabel = 'Expand sidebar',
  className,
}: SidebarCollapseButtonProps) {
  const { collapsed, onCollapsedChange, side } = useSidebar();
  return (
    <SidebarNavItem
      testID="sidebar-collapse-button"
      label={collapsed ? expandLabel : collapseLabel}
      iconSlot={(side === 'start') === collapsed ? <ChevronRight /> : <ChevronLeft />}
      aria-expanded={!collapsed}
      onPress={() => onCollapsedChange?.(!collapsed)}
      className={className}
    />
  );
}

export type BarNavItemProps = Omit<PressableProps, 'children' | 'className' | 'style'> & {
  /**
   * What the place is called. Nothing draws it, so it is the link's accessible name — an icon with
   * no name is announced as "link" — and the tooltip a pointer or a long press brings up.
   */
  label: string;
  /** The whole of what is drawn. Pass a bare `<Folder />`; the item sizes and colours it. */
  iconSlot: SlotNode;
  /**
   * Where it goes — the `<a href>` on the web. Left out when a router's link names it: TanStack's
   * `createLink`, or expo-router's `<Link href asChild>`, both of which hand it the `href`.
   */
  href?: string | undefined;
  /** The item for the page on screen — filled, and `aria-current="page"`. */
  active?: boolean | undefined;
  /**
   * How many things are behind the place, as a small badge on the icon's corner and in the name:
   * "Skills, 12". The badge has a corner to fit in, so cap a long one where it is passed — `"99+"`.
   */
  count?: number | string | undefined;
  /**
   * What state the place's thing is in, as a dot on the icon's other corner and in the name:
   * "Servers, 2 failing". The same object `SidebarNavItem` takes, so one array feeds both; the bar
   * has room for neither its words nor its `iconSlot`, so the dot is all that is drawn and the
   * `label` is what is read.
   */
  status?: SidebarNavItemStatus | undefined;
  // Re-declared rather than inherited, for `exactOptionalPropertyTypes` — see `segmented.tsx`.
  className?: string | undefined;
};

/**
 * A place in the bar: `SidebarNavItem` with only its icon drawn, for `SidebarLayout`'s `navSlot`
 * (and `TopBarLayout`'s), where a row's label has no room.
 *
 * It takes the row's props — `label`, `iconSlot`, `active`, `count`, `status`, `href` — so an app's
 * list of places is one array rendered twice, once into the rail and once into the bar:
 *
 * ```tsx
 * const BarLink = createLink(BarNavItem); // beside createLink(SidebarNavItem)
 * navSlot={places.map((p) => (
 *   <BarLink key={p.to} to={p.to} label={p.label} iconSlot={p.icon} count={p.count} active={…} />
 * ))}
 * ```
 *
 * Every app drew this by hand, as a router link with a class string, and the copies drifted on the
 * three things that matter. **The name**: an icon-only link has none unless it is given one, so
 * `label` is required, and it is also the tooltip, since the icon is all a sighted user has. **The
 * current one**: filled with `active` and `aria-current="page"`, where the copies used the grey
 * that means hover. **The count**: a row's count had nowhere to go on the bar, so the bar dropped
 * it — here it is a badge on the icon, a `status` is a dot, and both are in the name the way the
 * row builds it: "Skills, MCP on, 12".
 *
 * It binds to a router exactly as the row does — it forwards its ref and every prop it does not
 * name to the `Pressable`, so `createLink` and `<Link href asChild>` hand it the `href` and the
 * press handling, and react-router's `useLinkClickHandler` goes in as `onClick` beside an `href`.
 *
 * It is always a link. The bar's buttons — the theme switch, sign out — are `ActionButton`s in the
 * bar's `actionSlot`, not places in its `navSlot`.
 *
 * **The provider.** It renders its own `TooltipProvider`, as `ActionButton` does and for the same
 * reason: an installed component cannot assume the app has one at its root.
 */
const BarNavItem = React.forwardRef<React.ElementRef<typeof Pressable>, BarNavItemProps>(
  ({ href, label, iconSlot, count, status, active = false, className, ...props }, ref) => {
    // Native inherits no colour, so the icon carries its own; the web half's takes the link's.
    const text = active ? 'text-active-foreground' : 'text-foreground/60';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Pressable
              ref={ref}
              role="link"
              testID="bar-nav-item"
              // Nothing inside is text, so the name is written out on both platforms — joined the
              // way the row's is, and before `props`, so a caller's own label still wins.
              aria-label={rowName(label, status, count)}
              accessibilityState={{ selected: active }}
              // React Native has no `href` and no `aria-current`; the web has both, and needs both.
              {...(Platform.OS === 'web' ? ({ href, 'aria-current': active ? 'page' : undefined } as const) : {})}
              className={cn(
                'relative size-8 shrink-0 items-center justify-center rounded-md transition-colors',
                'focus-visible:outline-none',
                '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                active
                  ? 'bg-active text-active-foreground focus-visible:bg-active/90'
                  : 'text-foreground/60 hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground',
                className,
              )}
              {...props}
            >
              <IconClassContext.Provider value={cn('size-4 shrink-0', text)}>{iconSlot}</IconClassContext.Provider>
              <IconMarkers count={count} status={status} ring="border-background" />
            </Pressable>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
BarNavItem.displayName = 'BarNavItem';

export { BarNavItem, SidebarNavItem };
