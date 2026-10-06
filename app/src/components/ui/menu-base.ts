import type { ReactElement, ReactNode } from 'react';
import type { SlotNode } from '@/lib/utils';

export type MenuProps = {
  /** Both optional, together, as on `Popover`: pass neither and the menu keeps its own state. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  defaultOpen?: boolean | undefined;
  children: ReactNode;
};

export type MenuTriggerProps = {
  /**
   * Hand the press handler to the single child element rather than wrapping it. Always pass it
   * around a `Button`: a `Pressable` wrapping a `Button` never fires on native.
   */
  asChild?: boolean | undefined;
  children: ReactNode;
};

export type MenuContentProps = {
  className?: string | undefined;
  /** Web only — the native sheet is centred and has nothing to align to. */
  align?: 'start' | 'center' | 'end' | undefined;
  /**
   * The menu's name. On web radix names it after its trigger already; on native there is no
   * `aria-labelledby` to point at the trigger, so a trigger with no text (a ⋯ button) wants this.
   */
  'aria-label'?: string | undefined;
  children?: ReactNode;
};

export type MenuItemProps = {
  /** An icon from `@cubeui/icons`. It takes the row's colour — `text-negative` on a destructive row. */
  iconSlot?: SlotNode;
  /** The row's text, and what typeahead matches on the web. */
  label: string;
  /** After the label, at the far edge: a shortcut, a count, a check. A string is drawn muted. */
  trailing?: ReactNode;
  /** Draw the row in the destructive colour, for the action that deletes. */
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Runs when the row is chosen. The menu closes itself afterwards; do not close it here. */
  onSelect?: (() => void) | undefined;
  /**
   * The row hands focus to something else — a field it reveals with `autoFocus` — so this close
   * must not put focus back on the trigger, which would blur that target (and close it on `onBlur`
   * before anything is typed). Only for the close this row
   * causes: Escape, a click outside and every other row still return focus to the trigger.
   */
  focusesElsewhere?: boolean | undefined;
  className?: string | undefined;
  /**
   * Where the row goes, with no router: on the web the row is an `<a href>`, so it navigates,
   * opens in a new tab and shows its URL. On device it does nothing more than `onSelect` — a
   * native app navigates through its router, which is `linkSlot`.
   */
  href?: string | undefined;
  /**
   * The app's router link, as an element with no children — `<Link to="/x" preload="intent" />`.
   * The row is drawn inside it, so on the web the menu item *is* the router's `<a>`, and hover and
   * focus reach the link's own handlers (which is what lets a router preload on intent). On
   * device it is cloned with `asChild` around the row, the `<Link asChild>` convention. Wins over
   * `href`; a `disabled` row renders neither and does not navigate.
   */
  linkSlot?: ReactElement | undefined;
};

export type MenuSeparatorProps = {
  className?: string | undefined;
};

export const MENU_CONTENT_CLASS = 'min-w-[8rem] p-1';
export const MENU_ITEM_CLASS = 'w-full flex-row items-center gap-2 rounded-sm px-2 py-1.5';
export const MENU_ITEM_TEXT_CLASS = 'flex-1 text-sm';
export const MENU_TRAILING_CLASS = 'ml-auto text-xs text-foreground/60';
export const MENU_SEPARATOR_CLASS = '-mx-1 my-1 h-px bg-foreground/10';

/**
 * The toggle rows take `MenuItem`'s row — `iconSlot`, `label`, `trailing`, `disabled` — and not its
 * `destructive` or `onSelect`: a row that is on or off is a setting, not an action, and what it
 * reports is its new state.
 */
type MenuToggleRowProps = Omit<MenuItemProps, 'destructive' | 'onSelect'>;

export type MenuCheckboxItemProps = MenuToggleRowProps & {
  checked: boolean;
  /**
   * Runs with the row's new state. The menu stays open, so a list of these is toggled one row
   * after another without reopening it.
   */
  onCheckedChange?: ((checked: boolean) => void) | undefined;
};

export type MenuRadioGroupProps = {
  /** The `value` of the row that is on. */
  value: string;
  /** Runs with the chosen row's `value`. The menu closes afterwards, as radix's does. */
  onValueChange?: ((value: string) => void) | undefined;
  /** What the group chooses — worth passing when the menu holds more than one group. */
  'aria-label'?: string | undefined;
  children?: ReactNode;
};

export type MenuRadioItemProps = MenuToggleRowProps & {
  /** Handed to the group's `onValueChange` when the row is chosen. */
  value: string;
};

/**
 * What a web row adds to `MENU_ITEM_CLASS`: radix's disabled state and the icon sizing that
 * `IconClassContext` does on native. Shared so the toggle rows are `MenuItem`'s row, not a copy.
 */
export const MENU_ITEM_WEB_CLASS =
  'relative flex cursor-default select-none outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';
/**
 * The slot the ✓ sits in, at the row's far edge. It is kept when the row is off, so a column of
 * labels and trailing nodes lines up whichever rows are on.
 */
export const MENU_INDICATOR_CLASS = 'size-4 shrink-0 items-center justify-center';
