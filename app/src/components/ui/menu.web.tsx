import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cloneElement, createContext, type RefObject, useContext, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check } from '@/components/ui/icons';
import {
  MENU_CONTENT_CLASS,
  MENU_INDICATOR_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_TEXT_CLASS,
  MENU_ITEM_WEB_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_TRAILING_CLASS,
  type MenuCheckboxItemProps,
  type MenuContentProps,
  type MenuItemProps,
  type MenuProps,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  type MenuSeparatorProps,
  type MenuTriggerProps,
} from '@/components/ui/menu-base';
import { cn } from '@/lib/utils';

/** The shared contract, widened to what the radix part underneath accepts. */
type Wide<Base, Radix> = Base & Omit<Radix, keyof Base>;

type MenuState = {
  setOpen: (open: boolean) => void;
  /**
   * Whether the close in progress was caused by a `focusesElsewhere` row. A ref rather than state:
   * it is written when the row is chosen and read in `onCloseAutoFocus` after the close animation,
   * and nothing renders from it.
   */
  skipReturnRef: RefObject<boolean>;
};

const MenuContext = createContext<MenuState>({
  setOpen: () => {},
  skipReturnRef: { current: false },
});

function Menu({
  open,
  onOpenChange,
  defaultOpen = false,
  ...props
}: Wide<MenuProps, React.ComponentProps<typeof MenuPrimitive.Root>>) {
  // The menu holds the open state rather than leaving it to radix, the same arrangement as
  // `menu.tsx`, because a `focusesElsewhere` row has to close the menu itself before its action
  // runs — see `MenuItem`.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const skipReturnRef = useRef(false);
  return (
    <MenuContext.Provider value={{ setOpen, skipReturnRef }}>
      <MenuPrimitive.Root data-slot="menu" {...props} open={isOpen} onOpenChange={setOpen} />
    </MenuContext.Provider>
  );
}

function MenuTrigger({
  asChild,
  ...props
}: Wide<MenuTriggerProps, React.ComponentProps<typeof MenuPrimitive.Trigger>>) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" asChild={asChild ?? false} {...props} />;
}

function MenuContent({
  className,
  align = 'center',
  sideOffset = 4,
  onCloseAutoFocus,
  ...props
}: Wide<MenuContentProps, React.ComponentProps<typeof MenuPrimitive.Content>>) {
  const { skipReturnRef } = useContext(MenuContext);
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          MENU_CONTENT_CLASS,
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-secondary text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          // Radix focuses the trigger unless the event is prevented. A `focusesElsewhere` row
          // has already focused its target by now, and the trigger would take it back.
          if (skipReturnRef.current) event.preventDefault();
          skipReturnRef.current = false;
        }}
      />
    </MenuPrimitive.Portal>
  );
}

function MenuItem({
  iconSlot,
  label,
  trailing,
  destructive = false,
  disabled = false,
  onSelect,
  focusesElsewhere = false,
  className,
  href,
  linkSlot,
  ...props
}: Wide<MenuItemProps, Omit<React.ComponentProps<typeof MenuPrimitive.Item>, 'children'>>) {
  const { setOpen, skipReturnRef } = useContext(MenuContext);
  const row = (
    <>
      {iconSlot}
      <span className={cn(MENU_ITEM_TEXT_CLASS, 'truncate')}>{label}</span>
      {typeof trailing === 'string' ? (
        <span className={cn(MENU_TRAILING_CLASS, 'tracking-widest')}>{trailing}</span>
      ) : (
        trailing
      )}
    </>
  );
  // A link row is radix's item rendered *as* the anchor, not an anchor inside the item: the `<a>`
  // takes `role="menuitem"`, the roving focus and the keys, and the router's link keeps its own
  // hover and focus handlers. The nesting is not `<Link asChild>` because radix composes its
  // select after the item's own `onClick` and skips it once that has called `preventDefault` —
  // which every router's click does — so a menu handed the router's click would never close.
  // Cloned the other way, the router link is handed radix's click and runs it first. A disabled
  // row is no link at all, so nothing can follow it.
  const anchor = disabled ? undefined : linkSlot ? (
    cloneElement(linkSlot, undefined, row)
  ) : href !== undefined ? (
    <a href={href}>{row}</a>
  ) : undefined;
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-variant={destructive ? 'destructive' : 'default'}
      disabled={disabled}
      textValue={label}
      {...props}
      asChild={anchor !== undefined}
      onSelect={(event) => {
        skipReturnRef.current = focusesElsewhere;
        if (focusesElsewhere) {
          // Radix runs this while the menu is still open and trapping focus, so an `autoFocus`
          // the action mounts is pulled straight back into the menu. Close it first — flushed,
          // so the trap is released — and only then hand focus away.
          event.preventDefault();
          flushSync(() => setOpen(false));
        }
        onSelect?.();
      }}
      // Icons inherit `currentColor` here, so the row's text colour is the icon's too — the web
      // half of what `IconClassContext` does on native.
      className={cn(
        MENU_ITEM_CLASS,
        MENU_ITEM_WEB_CLASS,
        destructive ? 'text-negative focus:bg-negative/10 focus:text-negative' : 'text-foreground focus:bg-hover',
        className,
      )}
    >
      {anchor ?? row}
    </MenuPrimitive.Item>
  );
}

function MenuSeparator({
  className,
  ...props
}: Wide<MenuSeparatorProps, React.ComponentProps<typeof MenuPrimitive.Separator>>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn(MENU_SEPARATOR_CLASS, 'pointer-events-none', className)}
      {...props}
    />
  );
}

/**
 * A toggle row's inside: `MenuItem`'s icon, label and trailing node, then the ✓ slot at the far
 * edge. `ItemIndicator` renders only while its row is on; the slot around it stays.
 */
function ToggleRowBody({ iconSlot, label, trailing }: Pick<MenuCheckboxItemProps, 'iconSlot' | 'label' | 'trailing'>) {
  return (
    <>
      {iconSlot}
      <span className={cn(MENU_ITEM_TEXT_CLASS, 'truncate')}>{label}</span>
      {typeof trailing === 'string' ? (
        <span className={cn(MENU_TRAILING_CLASS, 'tracking-widest')}>{trailing}</span>
      ) : (
        trailing
      )}
      <span className={cn(MENU_INDICATOR_CLASS, 'flex')}>
        <MenuPrimitive.ItemIndicator>
          <Check />
        </MenuPrimitive.ItemIndicator>
      </span>
    </>
  );
}

const TOGGLE_ROW_CLASS = cn(MENU_ITEM_CLASS, MENU_ITEM_WEB_CLASS, 'text-foreground focus:bg-hover');

function MenuCheckboxItem({
  iconSlot,
  label,
  trailing,
  checked,
  onCheckedChange,
  disabled = false,
  onSelect,
  className,
  ...props
}: Wide<MenuCheckboxItemProps, Omit<React.ComponentProps<typeof MenuPrimitive.CheckboxItem>, 'children'>>) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      disabled={disabled}
      textValue={label}
      {...props}
      checked={checked}
      onCheckedChange={(next) => onCheckedChange?.(next)}
      // Radix closes the menu on every select; a toggle list stays open between presses.
      onSelect={(event) => {
        onSelect?.(event);
        event.preventDefault();
      }}
      className={cn(TOGGLE_ROW_CLASS, className)}
    >
      <ToggleRowBody iconSlot={iconSlot} label={label} trailing={trailing} />
    </MenuPrimitive.CheckboxItem>
  );
}

function MenuRadioGroup({
  value,
  onValueChange,
  ...props
}: Wide<MenuRadioGroupProps, React.ComponentProps<typeof MenuPrimitive.RadioGroup>>) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="menu-radio-group"
      value={value}
      onValueChange={(next) => onValueChange?.(next)}
      {...props}
    />
  );
}

/** Choosing one closes the menu — radix's default, kept: a one-of-N choice is done once made. */
function MenuRadioItem({
  iconSlot,
  label,
  trailing,
  disabled = false,
  className,
  ...props
}: Wide<MenuRadioItemProps, Omit<React.ComponentProps<typeof MenuPrimitive.RadioItem>, 'children'>>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      disabled={disabled}
      textValue={label}
      {...props}
      className={cn(TOGGLE_ROW_CLASS, className)}
    >
      <ToggleRowBody iconSlot={iconSlot} label={label} trailing={trailing} />
    </MenuPrimitive.RadioItem>
  );
}

export { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger };
