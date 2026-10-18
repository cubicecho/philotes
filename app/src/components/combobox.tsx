import type { ComponentProps, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/color-dot";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { matchesEveryWord } from "@/components/ui/command-base";
import { Check, ChevronsUpDown, Plus, X } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  Select as SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readableTextColor } from "@/lib/readable-text-color";
import {
  blocksOf,
  isAddableOptionName,
  isNote,
  isSeparator,
  optionText,
  type SelectEntry,
  type SelectNoteEntry,
  type SelectOption,
  type SelectSeparatorEntry,
  withOrphanOptions,
} from "@/lib/select-options";
import { cn } from "@/lib/utils";

/** Off the screen and still read. `sr-only` is a clip, which the device does not have. */
const SR_ONLY = Platform.select({
  web: "sr-only",
  default: "absolute -m-px h-px w-px overflow-hidden",
});

/** Never seen, but react-native-web gives every `Text` its own black `color` all the same. */
const NOTE_INK = "text-foreground";

/**
 * A note in the menu is a row, and one `Text` rather than a box around one, because the element
 * carrying the words is the one that has to be `aria-hidden`. On device a `Text` in a column is
 * already a row; the compiled `<span>` is inline, where its padding takes no room, so it says so.
 */
const NOTE_ROW = Platform.select({ web: "block", default: undefined });

/**
 * The muted lines answering the highlight. cmdk paints the highlighted row `bg-hover`, and muted
 * text on it is 4.34:1, under the 4.5 a body-size string needs, so whichever row the arrow keys
 * are on is the one that cannot be read. There is no highlight on device.
 */
const ON_HIGHLIGHT = Platform.select({
  web: "group-data-[selected=true]:text-foreground",
  default: "",
});

/** Chips drawn before a `multiple` trigger collapses to a count. */
const DEFAULT_MAX_DISPLAY = 3;

// The trigger's props, because the rest is spread onto the trigger: the field wiring (`id`, the
// `aria-*` props, `disabled`, `onBlur`) and anything else a call site already passes. Taken from
// `SelectTrigger` rather than spelled out, so each half gets its own: on the web that trigger is
// radix's `<button>` and honours every attribute one does, and on device it is the subset
// `select-base.ts` names.
type ComboboxSharedProps = Omit<
  ComponentProps<typeof SelectTrigger>,
  "value" | "onChange" | "type" | "children" | "className" | "disabled"
> & {
  className?: string | undefined;
  disabled?: boolean | undefined;
  options: readonly SelectEntry[];
  /** What the trigger says with nothing chosen. */
  placeholder?: string | undefined;
  /**
   * Whether the menu is open, and being told when that changes. The same controlled pair as
   * everywhere else in the set; pass `onOpenChange` on its own to be told without taking over.
   *
   * This is what a menu that fills when it opens needs. The fetch is `enabled: opened`, so a
   * form of twenty fields asks the server nothing for the eighteen the reader never touches.
   */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** The dropdown's class. `className` still goes to the trigger, which is the control. */
  contentClassName?: string | undefined;
  /**
   * A box to type in above the list. It matches the label, the group heading and an option's
   * `keywords`, every typed word in any order.
   *
   * @defaultValue `false`, and `true` when `multiple`
   */
  searchable?: boolean | undefined;
  /** The search box's placeholder. Read only when `searchable`. */
  searchPlaceholder?: string | undefined;
  /**
   * The search box's accessible name. cmdk points its input at a hidden `<label>` it renders from
   * `Command`'s `label`, and the native half makes it the input's `aria-label`: a placeholder is
   * not a name.
   */
  searchLabel?: string | undefined;
  /**
   * What the search menu is called. On the web it is a `role="dialog"`, and a dialog needs a
   * name. Rendered inside it rather than borrowed from the trigger: a label outside the dialog
   * resolves to nothing the moment the thing it points at is hidden or re-keyed.
   */
  popoverLabel?: string | undefined;
  /** What the list says when the search matches nothing and there is nothing to add. */
  emptyMessage?: string | undefined;
  /**
   * Offer to create what was typed, as a row at the end of the search menu. The handler owns the
   * creation *and* the selection: it is usually a mutation, and only the caller knows the id the
   * new row came back with. Passing it draws the search menu, since the name has to be typed.
   */
  onCreateOption?: ((name: string) => void) | undefined;
  /**
   * What the create row says, before the quoted name.
   *
   * @defaultValue `"Use"` for one value with `freeText`, `"Add"` otherwise
   */
  createLabel?: string | undefined;
  /**
   * Hold what was typed, not only what is listed: the options are suggestions, not a closed set.
   * The create row writes the typed text as the value itself, so no `onCreateOption` is needed
   * (and one passed beside it is not called), and a held value no option covers is drawn as its
   * own text. With `multiple` it is a tag input: each typed value is a chip, and one already held
   * (ignoring case) is refused, with the reason said in the menu.
   */
  freeText?: boolean | undefined;
  /**
   * What the menu says when the text typed into a `freeText` `multiple` combobox is already held.
   *
   * @defaultValue “text” is already added.
   */
  duplicateMessage?: ((text: string) => string) | undefined;
  /**
   * Told the refusal's message when the menu starts refusing what was typed, and `undefined` when
   * it stops. What `ComboboxField` puts on the field as its error.
   */
  onRefusalChange?: ((message: string | undefined) => void) | undefined;
};

/** A combobox holding one value. */
type ComboboxSingleProps = ComboboxSharedProps & {
  multiple?: false | undefined;
  value?: string | undefined;
  onValueChange: (value: string) => void;
};

/** A combobox holding several. */
type ComboboxMultipleProps = ComboboxSharedProps & {
  multiple: true;
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  /**
   * Chips to draw before collapsing to a count. `0` always shows the count.
   *
   * @defaultValue `3`
   */
  maxDisplay?: number | undefined;
  /**
   * A Clear button at the foot of the menu, while anything is chosen.
   *
   * @defaultValue `true`
   */
  clearable?: boolean | undefined;
};

type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

/** The words a search is matched against. */
function searchTextOf(option: SelectOption): string {
  return [optionText(option), option.group, ...(option.keywords ?? [])].filter(Boolean).join(" ");
}

/**
 * The two colour props a tag-coloured chip needs, as a spread. `Badge` takes them as props rather
 * than as a `style`, because the same component renders a `<Text>` on native and there is no
 * inheritance to carry the label colour down to it.
 */
function chipColors(color: string | undefined) {
  if (!color) {
    return {};
  }
  return { backgroundColor: color, textColor: readableTextColor(color) };
}

/** The note rows in either menu: hidden there, and announced from the live region by the trigger. */
function NoteRow({ entry }: { entry: SelectNoteEntry }) {
  return (
    <Text
      // A listbox may own only options and groups, which is why radix hides its own separator
      // the same way.
      aria-hidden
      className={cn(NOTE_ROW, "px-2 py-1.5 text-foreground/60 text-sm", entry.className)}
    >
      {entry.note}
    </Text>
  );
}

/**
 * Where the notes are announced from. It sits beside the trigger rather than in the menu because
 * the menu is the listbox and a listbox may own only options and groups, and because the menu is
 * unmounted on close (radix's popper, the device's sheet), while a live region has to be in the
 * tree *before* its text is to be read out at all.
 */
function NoteAnnouncer({ options }: { options: readonly SelectEntry[] }) {
  const notes = useMemo(() => options.filter(isNote), [options]);
  return (
    <View role="status" aria-live="polite" className={SR_ONLY}>
      {notes.map((entry, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a message about the list has no id
        <Text key={`note-${index}`} className={NOTE_INK}>
          {entry.note}
        </Text>
      ))}
    </View>
  );
}

/**
 * One line of an option that is not its name, the hint under it or the meta at its end, with the
 * id the row's `aria-describedby` points at. A string gets its own `Text`, since colour does not
 * inherit on native; anything else (a `Badge`) is placed as it is, in a box carrying the id.
 */
function OptionLine({
  id,
  slot,
  className,
  children,
}: {
  id: string | undefined;
  slot: string;
  className: string;
  children: ReactNode;
}) {
  if (typeof children === "string" || typeof children === "number") {
    return (
      <Text nativeID={id} testID={slot} className={cn("text-xs text-foreground/60", className)}>
        {children}
      </Text>
    );
  }
  return (
    <View nativeID={id} testID={slot} className={className}>
      {children}
    </View>
  );
}

/**
 * One option of the search menu, which is up to four things: the tick, the colour dot, what it is
 * called, and what else is true of it. Everything about the row that is not the label is a
 * *description*, which takes two ids, an explicit name, and a layout that changes when there is
 * a second line.
 */
function OptionRow({
  option,
  idPrefix,
  selected,
  onPick,
}: {
  option: SelectOption;
  idPrefix: string;
  selected: boolean;
  onPick: (value: string) => void;
}) {
  const hintId = option.hint ? `${idPrefix}-hint-${option.value}` : undefined;
  const metaId = option.meta ? `${idPrefix}-meta-${option.value}` : undefined;
  // A second line changes the row from centred to top-aligned, and everything on the first line
  // has to be nudged down to sit on it.
  const stacked = Boolean(option.hint);

  return (
    <CommandItem
      // What the filter sees. `value` alone would search ids, which nobody types; the heading is
      // in here so that typing a lane's name still finds the cards in it.
      value={searchTextOf(option)}
      {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
      // `aria-checked`, not `aria-selected`: cmdk uses `aria-selected` for which option is
      // *highlighted* and sets it after the props it is given, so it cannot also carry which
      // options are chosen. `aria-checked` is valid on `role="option"` and is the one cmdk
      // leaves alone.
      aria-checked={selected}
      // The name is the label and nothing else. Without this the badge and the hint would be
      // swept into the accessible name by the contents, and read again as its description. A
      // label that is a node names the row by its own contents.
      {...(typeof option.label === "string" ? { "aria-label": option.label } : {})}
      // In reading order: the end of the row, then the line under it.
      aria-describedby={[metaId, hintId].filter(Boolean).join(" ") || undefined}
      onSelect={() => onPick(option.value)}
      // `group` so the two muted lines can answer the highlight: see `ON_HIGHLIGHT`.
      className={cn(
        Platform.select({ web: "group", default: "" }),
        stacked && "items-start",
        option.className,
      )}
    >
      <Check
        className={cn(
          "size-4 shrink-0",
          stacked && "mt-0.5",
          selected ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      {option.color ? (
        <ColorDot color={option.color} size="sm" className={cn(stacked && "mt-1.5")} />
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="truncate text-foreground text-sm">{option.label}</Text>
        {option.hint ? (
          // Wrapped rather than truncated: a reason cut off at the edge of the popover is the
          // same as no reason.
          <OptionLine id={hintId} slot="combobox-option-hint" className={ON_HIGHLIGHT}>
            {option.hint}
          </OptionLine>
        ) : null}
      </View>
      {option.meta ? (
        <OptionLine
          id={metaId}
          slot="combobox-option-meta"
          className={cn("shrink-0", ON_HIGHLIGHT, stacked && "mt-0.5")}
        >
          {option.meta}
        </OptionLine>
      ) : null}
    </CommandItem>
  );
}

type SearchMenuProps = Pick<
  ComboboxSharedProps,
  | "options"
  | "duplicateMessage"
  | "onRefusalChange"
  | "open"
  | "onOpenChange"
  | "className"
  | "contentClassName"
  | "disabled"
  | "searchPlaceholder"
  | "searchLabel"
  | "popoverLabel"
  | "emptyMessage"
  | "onCreateOption"
  | "createLabel"
> & {
  searchable: boolean;
  /** The values held: one or none for a single combobox. */
  selected: readonly string[];
  onPick: (value: string) => void;
  /** A single combobox is done once a row is chosen; a `multiple` one stays open for the next. */
  closeOnPick: boolean;
  /** Whether typing a held value's text is refused: a `freeText` `multiple` combobox. */
  refuseHeld?: boolean | undefined;
  /** What the trigger shows: the chosen label, the chips, or the placeholder. */
  triggerSlot: ReactNode;
  /** Under the list, inside the menu: the Clear button of a `multiple` combobox. */
  footerSlot?: ReactNode;
  /** The field wiring, for the trigger. */
  trigger: ButtonProps;
};

/**
 * The search menu: a `Popover` over a `Command` on both halves. On the web that is radix over
 * cmdk, which owns the keyboard; on device it is a centred sheet whose rows are pressed.
 *
 * A second menu rather than a box added to the listbox, because radix's listbox owns the
 * keyboard, typing ahead to a row on every key, and a text input inside it never receives the
 * letters.
 */
function SearchMenu({
  options,
  selected,
  onPick,
  closeOnPick,
  triggerSlot,
  footerSlot,
  open,
  onOpenChange,
  className,
  contentClassName,
  disabled,
  searchable,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  popoverLabel = "Options",
  emptyMessage = "No matches.",
  onCreateOption,
  createLabel = "Add",
  refuseHeld = false,
  duplicateMessage = (text) => `“${text}” is already added.`,
  onRefusalChange,
  trigger,
}: SearchMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [search, setSearch] = useState("");
  const titleId = useId();
  const rowId = useId();
  const isOpen = open ?? uncontrolledOpen;
  const blocks = useMemo(() => blocksOf(options), [options]);
  const typed = search.trim();
  // A held value's own text, typed again. Its row is in the list (ticked), so the create row is
  // gone already; what is missing without this is being told why.
  const heldAgain =
    refuseHeld && typed !== ""
      ? options.find(
          (entry): entry is SelectOption =>
            "value" in entry &&
            selected.includes(entry.value) &&
            optionText(entry).trim().toLocaleLowerCase() === typed.toLocaleLowerCase(),
        )
      : undefined;
  const refusal = heldAgain === undefined ? undefined : duplicateMessage(typed);
  const canCreate =
    Boolean(onCreateOption) && refusal === undefined && isAddableOptionName(search, options);

  // An effect, because the refusal is derived from what is typed and the field's error is state
  // the field owns. Closing the menu clears the search, and with it the refusal.
  useEffect(() => {
    onRefusalChange?.(refusal);
  }, [refusal, onRefusalChange]);

  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
    // A menu reopened on the last search hides the row the reader came back for.
    if (next === false) {
      setSearch("");
    }
  };

  const pick = (value: string) => {
    onPick(value);
    if (closeOnPick) {
      setOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          testID="combobox-trigger"
          variant="outline"
          role="combobox"
          // `aria-controls` and `aria-haspopup` are Radix's, through `asChild`, and point at the
          // popover it owns. cmdk mints the listbox id itself and overwrites any id passed to
          // `CommandList`, so there is nothing here that could point at it honestly.
          aria-expanded={isOpen}
          disabled={disabled}
          {...trigger}
          className={cn(
            "h-auto min-h-10 w-full justify-between gap-2 bg-background px-3 py-1.5 font-normal",
            Platform.select({
              web: "whitespace-normal aria-invalid:border-negative disabled:cursor-not-allowed",
              default: "",
            }),
            className,
          )}
          content={triggerSlot}
          trailingSlot={<ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // radix's popover is a `role="dialog"`, and a dialog needs a name; the device's sheet has
        // no role to name, and the title is simply the first thing read in it.
        {...(Platform.OS === "web" ? { "aria-labelledby": titleId } : {})}
        className={cn(
          Platform.select({
            // As wide as the trigger, so the list does not open narrower than what opened it.
            web: "w-[var(--radix-popover-trigger-width)] p-0",
            default: "w-80 max-w-full p-0",
          }),
          contentClassName,
        )}
      >
        <Text nativeID={titleId} className={cn(SR_ONLY, NOTE_INK)}>
          {popoverLabel}
        </Text>
        <Command label={searchLabel} filter={matchesEveryWord} shouldFilter={searchable}>
          {searchable ? (
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
          ) : null}
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {/*
              Keyed by position, and it has to be: a rule has no identity of its own, and a heading
              that appears twice is a caller who meant it, so neither is unique. The list is the
              caller's and is drawn in the order given, so a position is stable enough.
            */}
            {blocks.map((block, index) => {
              if (isSeparator(block)) {
                // biome-ignore lint/suspicious/noArrayIndexKey: a rule has no identity of its own
                return <CommandSeparator key={`block-${index}`} />;
              }
              if (isNote(block)) {
                // biome-ignore lint/suspicious/noArrayIndexKey: nor does a message about the list
                return <NoteRow key={`block-${index}`} entry={block} />;
              }
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: nor does a repeated heading
                <CommandGroup key={`block-${index}`} heading={block.group}>
                  {block.options.map((option) => (
                    <OptionRow
                      key={option.value}
                      option={option}
                      idPrefix={rowId}
                      selected={selected.includes(option.value)}
                      onPick={pick}
                    />
                  ))}
                </CommandGroup>
              );
            })}

            {canCreate ? (
              // An explicit row, not an Enter handler on the input: cmdk already consumes Enter
              // to choose the highlighted item, so a keydown listener races it and wins only
              // sometimes. A row is a thing you can see, arrow to, and press.
              <CommandGroup
                forceMount
                className={cn(
                  "border-foreground/10 border-t bg-secondary",
                  Platform.select({ web: "sticky bottom-0", default: "" }),
                )}
              >
                <CommandItem
                  forceMount
                  value={`__create__${search}`}
                  onSelect={() => {
                    onCreateOption?.(search.trim());
                    setSearch("");
                    if (closeOnPick) {
                      setOpen(false);
                    }
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  <Text className="min-w-0 flex-1 truncate text-foreground text-sm">
                    {createLabel} “{search.trim()}”
                  </Text>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
        {refuseHeld ? (
          // In the tree from the moment the menu opens, so the text arriving is what is read out.
          // Beside the list and not in it: a listbox may own only options and groups.
          <View role="status" aria-live="polite" testID="combobox-refusal">
            {refusal === undefined ? null : (
              <Text className="border-foreground/10 border-t px-3 py-2 text-foreground text-sm">
                {refusal}
              </Text>
            )}
          </View>
        ) : null}
        {footerSlot}
      </PopoverContent>
    </Popover>
  );
}

/** One value: radix's listbox or the device's sheet, and the search menu once it is asked for. */
function SingleCombobox({
  multiple: _multiple,
  options,
  value,
  onValueChange,
  placeholder,
  open,
  onOpenChange,
  className,
  contentClassName,
  disabled,
  searchable = false,
  searchPlaceholder,
  searchLabel,
  popoverLabel,
  emptyMessage,
  onCreateOption,
  createLabel,
  freeText = false,
  duplicateMessage: _duplicateMessage,
  onRefusalChange: _onRefusalChange,
  ...props
}: ComboboxSingleProps) {
  // A typed value is drawn as a row of its own, ticked, so the trigger and the menu read it the
  // way they read a listed one.
  const listed = useMemo(
    () => (freeText && value ? withOrphanOptions(options, [value]) : options),
    [freeText, options, value],
  );
  const blocks = useMemo(() => blocksOf(options), [options]);
  // Handed to `SelectValue` rather than left for the select to find. Radix mirrors the chosen
  // item's text into the trigger by itself, but the device's sheet is not mounted while it is
  // closed and has nothing to mirror from, so the label is looked up here, once, for both.
  const chosen = useMemo(
    () => listed.find((entry): entry is SelectOption => "value" in entry && entry.value === value),
    [listed, value],
  );
  const selected = useMemo(() => (chosen === undefined ? [] : [chosen.value]), [chosen]);

  if (searchable || freeText || onCreateOption !== undefined) {
    return (
      <>
        <SearchMenu
          options={listed}
          selected={selected}
          onPick={onValueChange}
          closeOnPick
          searchable
          open={open}
          onOpenChange={onOpenChange}
          className={className}
          contentClassName={contentClassName}
          disabled={disabled}
          searchPlaceholder={searchPlaceholder}
          searchLabel={searchLabel}
          popoverLabel={popoverLabel}
          emptyMessage={emptyMessage}
          onCreateOption={freeText ? onValueChange : onCreateOption}
          createLabel={createLabel ?? (freeText ? "Use" : undefined)}
          // The select trigger's props are the button's on the web and a subset of them on
          // device, so they are the same wiring on a different element.
          trigger={props as ButtonProps}
          triggerSlot={
            chosen === undefined ? (
              <Text className="min-w-0 flex-1 truncate text-left text-foreground/60 text-sm">
                {placeholder}
              </Text>
            ) : (
              <Text className="min-w-0 flex-1 truncate text-left text-foreground text-sm">
                {chosen.label}
              </Text>
            )
          }
        />
        <NoteAnnouncer options={options} />
      </>
    );
  }

  return (
    <SelectRoot
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      {/* Full width by default, because a select in a field is one and a trigger that shrinks to
          its longest option makes a column of them ragged. `cn` lets a caller say otherwise. */}
      <SelectTrigger {...props} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder}>{chosen?.label}</SelectValue>
      </SelectTrigger>
      <NoteAnnouncer options={options} />
      <SelectContent className={contentClassName}>
        {blocks.map((block, index) => {
          if (isSeparator(block)) {
            // biome-ignore lint/suspicious/noArrayIndexKey: a rule has no identity of its own
            return <SelectSeparator key={`block-${index}`} />;
          }
          if (isNote(block)) {
            // biome-ignore lint/suspicious/noArrayIndexKey: nor does a message about the list
            return <NoteRow key={`block-${index}`} entry={block} />;
          }
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: nor does a repeated heading
            <SelectGroup key={`block-${index}`}>
              {block.group ? <SelectLabel>{block.group}</SelectLabel> : null}
              {block.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className={option.className}
                  {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </SelectRoot>
  );
}

/**
 * Several values: always the search menu, with a chip per value on the trigger.
 *
 * Clearing is in the menu's footer and not on the trigger, because the trigger is a `<button>`
 * and a button inside a button is invalid and unreachable by keyboard. On device each chip is
 * also a removable `Badge`, since a `Pressable` inside a `Pressable` takes the touch.
 */
function MultipleCombobox({
  multiple: _multiple,
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  open,
  onOpenChange,
  className,
  contentClassName,
  disabled,
  searchable = true,
  searchPlaceholder,
  searchLabel,
  popoverLabel,
  emptyMessage,
  onCreateOption,
  createLabel,
  maxDisplay = DEFAULT_MAX_DISPLAY,
  clearable = true,
  freeText = false,
  duplicateMessage,
  onRefusalChange,
  ...props
}: ComboboxMultipleProps) {
  const merged = useMemo(() => withOrphanOptions(options, value), [options, value]);
  const chosen = useMemo(
    () =>
      value.flatMap((held) => {
        const option = merged.find(
          (entry): entry is SelectOption => "value" in entry && entry.value === held,
        );
        return option === undefined ? [] : [option];
      }),
    [merged, value],
  );

  const toggle = (option: string) => {
    onValueChange(
      value.includes(option) ? value.filter((held) => held !== option) : [...value, option],
    );
  };

  const shown = maxDisplay > 0 ? chosen.slice(0, maxDisplay) : [];
  const overflow = chosen.length - shown.length;

  return (
    <>
      <SearchMenu
        options={merged}
        selected={value}
        onPick={toggle}
        closeOnPick={false}
        searchable={searchable}
        open={open}
        onOpenChange={onOpenChange}
        className={className}
        contentClassName={contentClassName}
        disabled={disabled}
        searchPlaceholder={searchPlaceholder}
        searchLabel={searchLabel}
        popoverLabel={popoverLabel}
        emptyMessage={emptyMessage}
        onCreateOption={freeText ? (name) => onValueChange([...value, name]) : onCreateOption}
        createLabel={createLabel}
        refuseHeld={freeText}
        duplicateMessage={duplicateMessage}
        onRefusalChange={onRefusalChange}
        trigger={props as ButtonProps}
        triggerSlot={
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
            {chosen.length === 0 ? (
              <Text className="text-foreground/60 text-sm">{placeholder}</Text>
            ) : (
              <>
                {shown.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    {...chipColors(option.color)}
                    className={Platform.select({
                      web: "max-w-40 truncate",
                      default: "max-w-40",
                    })}
                    // Device only: on the web this would be a button inside the trigger's button.
                    {...(Platform.OS !== "web" && disabled !== true
                      ? { onRemove: () => toggle(option.value) }
                      : {})}
                  >
                    {optionText(option)}
                  </Badge>
                ))}
                {overflow > 0 ? (
                  <Text className="text-foreground/60 text-xs">
                    {shown.length === 0 ? `${overflow} selected` : `+${overflow}`}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        }
        footerSlot={
          clearable && chosen.length > 0 ? (
            <View className="flex-row justify-end border-foreground/10 border-t p-1">
              <Button
                variant="outline"
                size="sm"
                className="text-foreground/60"
                onPress={() => onValueChange([])}
                iconSlot={<X className="size-4" aria-hidden />}
                content="Clear"
              />
            </View>
          ) : null
        }
      />
      <NoteAnnouncer options={options} />
    </>
  );
}

/**
 * A choice from a list of options, one or several, rather than seven primitives to assemble.
 *
 * One value and a short list is radix's listbox on the web and the `Select` sheet on device.
 * `searchable` swaps that for a `Popover` over a `Command` with a box to type in, and `multiple`
 * holds a `string[]`, always in that menu, with a chip per value on the trigger.
 *
 * The rest of the props are the trigger's and are spread there, because neither root renders an
 * element and an `id` or `aria-invalid` on it goes nowhere. That is the shape `FormField`'s
 * function form hands its control:
 *
 * ```tsx
 * <FormField
 *   label="Kind"
 *   controlSlot={(wired) => (
 *     <Combobox {...wired} options={KINDS} value={kind} onValueChange={setKind} />
 *   )}
 * />
 *
 * <Combobox multiple options={TAGS} value={tagIds} onValueChange={setTagIds} />
 * ```
 */
export function Combobox(props: ComboboxProps) {
  return props.multiple === true ? <MultipleCombobox {...props} /> : <SingleCombobox {...props} />;
}

// Local bindings rather than `export … from`: the shadcn CLI rewrites import declarations on
// install and leaves re-export declarations alone. See AGENTS.md.
export type {
  ComboboxMultipleProps,
  ComboboxProps,
  ComboboxSingleProps,
  SelectEntry,
  SelectNoteEntry,
  SelectOption,
  SelectSeparatorEntry,
};
