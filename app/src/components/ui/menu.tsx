import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Platform, Pressable, type Role, Text, View } from "react-native";
import { Check } from "@/components/ui/icons";
import { IconClassContext } from "@/components/ui/icons-base";
import {
  MENU_CONTENT_CLASS,
  MENU_ICON_ROOM_CLASS,
  MENU_INDICATOR_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_TEXT_CLASS,
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
} from "@/components/ui/menu-base";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { addHandlers, cn, touchRowClass } from "@/lib/utils";

type MenuState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<View | null>;
  /** Set by a `focusesElsewhere` row, read and cleared on the close edge. */
  skipReturnRef: RefObject<boolean>;
};

const MenuContext = createContext<MenuState>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  skipReturnRef: { current: false },
});

/** Put focus back on the trigger, in whichever sense of focus the platform has. */
function returnFocus(node: View | null) {
  if (!node) {
    return;
  }
  if (Platform.OS === "web") {
    node.focus();
  } else {
    AccessibilityInfo.sendAccessibilityEvent(node, "focus");
  }
}

/** The root of a menu of actions: it holds the open state. */
function Menu({ open, onOpenChange, defaultOpen = false, children }: MenuProps) {
  // Uncontrolled state kept unconditionally and read only when the caller passed no `open`, the
  // same arrangement as `popover.tsx`.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setUncontrolled(next);
    }
    onOpenChange?.(next);
  };

  const triggerRef = useRef<View | null>(null);
  const skipReturnRef = useRef(false);
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    // On the close edge only, however it closed: a row, the backdrop or the back button. A
    // `focusesElsewhere` row has already moved focus to where it belongs, so leave it there.
    if (wasOpen.current && isOpen === false) {
      if (skipReturnRef.current === false) {
        returnFocus(triggerRef.current);
      }
      skipReturnRef.current = false;
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <MenuContext.Provider value={{ open: isOpen, setOpen, triggerRef, skipReturnRef }}>
      <Popover open={isOpen} onOpenChange={setOpen}>
        {children}
      </Popover>
    </MenuContext.Provider>
  );
}

/** The element that opens the menu. */
function MenuTrigger({ asChild, children }: MenuTriggerProps) {
  const { open, setOpen, triggerRef } = useContext(MenuContext);
  if (asChild && isValidElement(children)) {
    // The child's own ref still gets the node; the menu only needs to read it too.
    const own = (children.props as { ref?: Ref<View> }).ref;
    const opens = addHandlers(children, { onPress: () => setOpen(true) });
    return cloneElement(opens as ReactElement<{ ref?: Ref<View>; "aria-expanded"?: boolean }>, {
      "aria-expanded": open,
      ref: (node: View | null) => {
        triggerRef.current = node;
        if (typeof own === "function") {
          own(node);
        } else if (own) {
          own.current = node;
        }
      },
    });
  }
  return (
    // The `role` is hand-written because a `<button>` has no native counterpart.
    <Pressable role="button" aria-expanded={open} ref={triggerRef} onPress={() => setOpen(true)}>
      {children}
    </Pressable>
  );
}

type IconColumn = {
  /** Whether any row in the menu draws an icon. */
  drawn: boolean;
  /** Called by a row that draws one; the function it returns is called when it stops. */
  claim: () => () => void;
};

const IconColumnContext = createContext<IconColumn>({ drawn: false, claim: () => () => {} });

/**
 * The room for an icon, for a row with none while another row in the menu draws one. The web half
 * asks the stylesheet with `:has()`; a device has no selector to ask, so each row with an icon says
 * so, before the sheet is painted.
 */
function useIconRoom(hasIcon: boolean) {
  const { drawn, claim } = useContext(IconColumnContext);
  useLayoutEffect(() => (hasIcon ? claim() : undefined), [hasIcon, claim]);
  return hasIcon === false && drawn ? <View className={MENU_ICON_ROOM_CLASS} /> : null;
}

/** The menu's list of rows. */
function MenuContent({ className, "aria-label": ariaLabel, children }: MenuContentProps) {
  const [iconRows, setIconRows] = useState(0);
  const claim = useCallback(() => {
    setIconRows((count) => count + 1);
    return () => setIconRows((count) => count - 1);
  }, []);
  const column = useMemo(() => ({ drawn: iconRows > 0, claim }), [iconRows, claim]);
  return (
    <PopoverContent className={cn(MENU_CONTENT_CLASS, "w-64", className)}>
      <IconColumnContext.Provider value={column}>
        <View role="menu" aria-label={ariaLabel}>
          {children}
        </View>
      </IconColumnContext.Provider>
    </PopoverContent>
  );
}

/** One action in the menu, which closes it when chosen. */
function MenuItem({
  iconSlot,
  label,
  trailing,
  destructive = false,
  disabled = false,
  onSelect,
  focusesElsewhere = false,
  className,
  linkSlot,
}: MenuItemProps) {
  const { setOpen, skipReturnRef } = useContext(MenuContext);
  const iconRoom = useIconRoom(Boolean(iconSlot));
  const ink = destructive ? "text-negative" : "text-foreground";
  const row = (
    <Pressable
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled}
      onPress={() => {
        skipReturnRef.current = focusesElsewhere;
        onSelect?.();
        setOpen(false);
      }}
      className={cn(
        MENU_ITEM_CLASS,
        // A finger's 44pt on device, rather than the web's 32px row (#470).
        touchRowClass(),
        destructive ? "active:bg-negative/10" : "active:bg-hover",
        disabled && "opacity-50",
        className,
      )}
    >
      {/* Colour does not inherit on native, so the row's ink reaches the icon through the
          context and the label through its own class. The icon is quieter than the label
          except on a destructive row, where both are `negative`. */}
      <IconClassContext.Provider
        value={cn("size-4 shrink-0", destructive ? ink : "text-foreground/60")}
      >
        {iconSlot}
        {iconRoom}
        <Text numberOfLines={1} className={cn(MENU_ITEM_TEXT_CLASS, ink)}>
          {label}
        </Text>
        {typeof trailing === "string" ? (
          <Text className={MENU_TRAILING_CLASS}>{trailing}</Text>
        ) : (
          trailing
        )}
      </IconClassContext.Provider>
    </Pressable>
  );
  // `href` alone is only the web's: there is no URL to open on device, and the app's router is
  // what navigates. Its link takes the row the way it takes a `Button` — `asChild`, which hands
  // the row its press handler beside the row's own `onSelect`. A disabled row is not handed over.
  return linkSlot && disabled === false
    ? cloneElement(linkSlot as ReactElement<{ asChild?: boolean }>, { asChild: true }, row)
    : row;
}

/** A rule between groups of rows. */
function MenuSeparator({ className }: MenuSeparatorProps) {
  return <View role="separator" className={cn(MENU_SEPARATOR_CLASS, className)} />;
}

type ToggleRowProps = Pick<
  MenuCheckboxItemProps,
  "iconSlot" | "label" | "trailing" | "disabled" | "className"
> & {
  kind: "checkbox" | "radio";
  checked: boolean;
  onPress: () => void;
};

/**
 * The row's role. ARIA's is `menuitemcheckbox` / `menuitemradio`, and react-native-web hands the
 * string to the DOM, so that is what an Expo web app gets. React Native's `Role` has neither:
 * on device an unknown role is dropped, and the row would lose the one word that makes
 * `aria-checked` read as "checked", so there it is the plain `checkbox` / `radio`.
 */
function toggleRole(kind: ToggleRowProps["kind"]): Role {
  if (Platform.OS !== "web") {
    return kind;
  }
  return (kind === "checkbox" ? "menuitemcheckbox" : "menuitemradio") as Role;
}

/**
 * `MenuItem`'s row with a ✓ slot at the far edge, and `aria-checked` for the state. What it does
 * when pressed — toggle and stay open, or choose and close — is the caller's.
 */
function ToggleRow({
  kind,
  checked,
  onPress,
  iconSlot,
  label,
  trailing,
  disabled = false,
  className,
}: ToggleRowProps) {
  const iconRoom = useIconRoom(Boolean(iconSlot));
  const ink = "text-foreground";
  // The quiet icon and trailing text, lifted to `foreground` on a row that is on: muted on the
  // chosen tint is under 4.5:1.
  const quiet = checked ? "text-foreground" : "text-foreground/60";
  return (
    <Pressable
      role={toggleRole(kind)}
      aria-checked={checked}
      disabled={disabled}
      aria-disabled={disabled}
      onPress={onPress}
      className={cn(
        MENU_ITEM_CLASS,
        touchRowClass(),
        // On, the row is the chosen tint, a step further while pressed.
        checked ? "bg-active/40 active:bg-active/60" : "active:bg-hover",
        disabled && "opacity-50",
        className,
      )}
    >
      {/* The icon quieter than the label, as MenuItem's. */}
      <IconClassContext.Provider value={cn("size-4 shrink-0", quiet)}>
        {iconSlot}
        {iconRoom}
        <Text numberOfLines={1} className={cn(MENU_ITEM_TEXT_CLASS, ink)}>
          {label}
        </Text>
        {typeof trailing === "string" ? (
          <Text className={cn(MENU_TRAILING_CLASS, quiet)}>{trailing}</Text>
        ) : (
          trailing
        )}
        <View className={MENU_INDICATOR_CLASS}>{checked ? <Check /> : null}</View>
      </IconClassContext.Provider>
    </Pressable>
  );
}

/** Pressed, it reports its new state and leaves the menu open, so a list is toggled in one go. */
function MenuCheckboxItem({ checked, onCheckedChange, ...row }: MenuCheckboxItemProps) {
  return (
    <ToggleRow
      {...row}
      kind="checkbox"
      checked={checked}
      onPress={() => onCheckedChange?.(!checked)}
    />
  );
}

type RadioGroupState = Pick<MenuRadioGroupProps, "value" | "onValueChange">;

const RadioGroupContext = createContext<RadioGroupState | null>(null);

/** A set of `MenuRadioItem`s of which one is chosen. */
function MenuRadioGroup({
  value,
  onValueChange,
  "aria-label": ariaLabel,
  children,
}: MenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <View role="group" aria-label={ariaLabel}>
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}

/** Chosen, it closes the menu, as the web half's radix item does: a one-of-N choice is made once. */
function MenuRadioItem({ value, ...row }: MenuRadioItemProps) {
  const group = useContext(RadioGroupContext);
  const { setOpen } = useContext(MenuContext);
  return (
    <ToggleRow
      {...row}
      kind="radio"
      checked={group?.value === value}
      onPress={() => {
        group?.onValueChange?.(value);
        setOpen(false);
      }}
    />
  );
}

export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
};
