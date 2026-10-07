import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Platform, Pressable, type Role, ScrollView, Text, View } from 'react-native';
import {
  COMMAND_DIALOG_DESCRIPTION,
  COMMAND_DIALOG_TITLE,
  COMMAND_LIST_LABEL,
  type CommandDialogProps,
  type CommandEmptyProps,
  type CommandFilter,
  type CommandGroupProps,
  type CommandInputProps,
  type CommandItemProps,
  type CommandListProps,
  type CommandProps,
  type CommandSeparatorProps,
  type CommandShortcutProps,
  commandItemText,
  matchesEveryWord,
} from '@/components/ui/command-base';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search } from '@/components/ui/icons';
import { IconClassContext } from '@/components/ui/icons-base';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Off the screen and still read. `sr-only` is a clip, which the device does not have. */
const SR_ONLY = Platform.select({
  web: 'sr-only',
  default: 'absolute -m-px h-px w-px overflow-hidden',
});

type Entry = { matches: boolean; shown: boolean; group: string | undefined };

/**
 * What every item said about itself. A store rather than state in `Command`, so an item reporting
 * re-renders only the parts that read a count — the empty message and the groups — and not every
 * other item in the list.
 */
function createItemStore() {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    set(id: string, entry: Entry) {
      const was = entries.get(id);
      if (was && was.matches === entry.matches && was.shown === entry.shown) return;
      entries.set(id, entry);
      notify();
    },
    remove(id: string) {
      if (entries.delete(id)) notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Items that match the search: what cmdk calls the filtered count. */
    matching() {
      let count = 0;
      for (const entry of entries.values()) if (entry.matches) count++;
      return count;
    },
    /** Items drawn in one group, forced or matching. */
    shownIn(group: string) {
      let count = 0;
      for (const entry of entries.values()) if (entry.group === group && entry.shown) count++;
      return count;
    },
  };
}

type ItemStore = ReturnType<typeof createItemStore>;

type CommandState = {
  label: string | undefined;
  search: string;
  setSearch: (search: string) => void;
  filter: CommandFilter;
  shouldFilter: boolean;
  store: ItemStore;
};

const CommandContext = createContext<CommandState>({
  label: undefined,
  search: '',
  setSearch: () => {},
  filter: matchesEveryWord,
  shouldFilter: true,
  store: createItemStore(),
});

const CommandGroupContext = createContext<string | undefined>(undefined);

function Command({ label, filter = matchesEveryWord, shouldFilter = true, className, children }: CommandProps) {
  const [search, setSearch] = useState('');
  const store = useMemo(createItemStore, []);
  return (
    <CommandContext.Provider value={{ label, search, setSearch, filter, shouldFilter, store }}>
      <View className={cn('w-full flex-col overflow-hidden rounded-md bg-secondary', className)}>{children}</View>
    </CommandContext.Provider>
  );
}

function CommandDialog({
  title = COMMAND_DIALOG_TITLE,
  description = COMMAND_DIALOG_DESCRIPTION,
  className,
  showCloseButton = true,
  children,
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className={cn('overflow-hidden p-0', className)} showCloseButton={showCloseButton}>
        {/* Inside the card, not beside it as shadcn has it: on native everything that is not a
            trigger goes into the `Modal`, and a header outside the card would sit on the
            backdrop. */}
        <DialogHeader className={SR_ONLY}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ value, onValueChange, placeholder, disabled, autoFocus, className }: CommandInputProps) {
  const { label, search, setSearch } = useContext(CommandContext);

  // A controlled box drives the search; an uncontrolled one writes it as it is typed. cmdk's
  // arrangement, so a caller who holds `value` and clears it clears the filter too.
  useEffect(() => {
    if (value !== undefined) setSearch(value);
  }, [value, setSearch]);

  return (
    <View className="border-b border-foreground/10 px-1">
      <Input
        type="search"
        value={value ?? search}
        onChangeText={(text) => {
          if (value === undefined) setSearch(text);
          onValueChange?.(text);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={label}
        leadingSlot={<Search />}
        className={cn('h-11 border-0 bg-transparent', className)}
      />
    </View>
  );
}

function CommandList({ label = COMMAND_LIST_LABEL, className, children }: CommandListProps) {
  return (
    <ScrollView
      // A press on a row while the keyboard is up is a press on the row. The default spends it
      // dismissing the keyboard, so every choice would take two taps.
      keyboardShouldPersistTaps="handled"
      // ARIA's `listbox`, which react-native-web hands the DOM. React Native's `Role` has no such
      // word and drops one it does not know, so on device the rows sit in a plain `list`.
      role={Platform.OS === 'web' ? ('listbox' as Role) : 'list'}
      aria-label={label}
      className={cn('max-h-[300px]', className)}
    >
      {children}
    </ScrollView>
  );
}

function CommandEmpty({ className, children }: CommandEmptyProps) {
  const { store } = useContext(CommandContext);
  const matching = useSyncExternalStore(store.subscribe, store.matching, store.matching);
  if (matching > 0) return null;
  return (
    <View className={cn('py-6', className)}>
      {typeof children === 'string' ? (
        <Text className="text-center text-sm text-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function CommandGroup({ heading, forceMount = false, className, children }: CommandGroupProps) {
  const { store } = useContext(CommandContext);
  const id = useId();
  const shownIn = () => store.shownIn(id);
  const shown = useSyncExternalStore(store.subscribe, shownIn, shownIn);
  const hidden = !forceMount && shown === 0;
  return (
    <CommandGroupContext.Provider value={id}>
      {/* Hidden rather than unmounted: the items inside have to stay mounted to say whether they
          match, or a group that emptied could never come back. */}
      <View
        role="group"
        aria-label={typeof heading === 'string' ? heading : undefined}
        className={cn('p-1', hidden && 'hidden', className)}
      >
        {heading == null ? null : typeof heading === 'string' ? (
          <Text className="px-2 py-1.5 text-xs font-medium text-foreground/60">{heading}</Text>
        ) : (
          heading
        )}
        {children}
      </View>
    </CommandGroupContext.Provider>
  );
}

function CommandSeparator({ alwaysRender = false, className }: CommandSeparatorProps) {
  const { search } = useContext(CommandContext);
  if (search !== '' && !alwaysRender) return null;
  return <View aria-hidden className={cn('-mx-1 h-px bg-foreground/10', className)} />;
}

function CommandItem({
  value,
  keywords,
  disabled = false,
  forceMount = false,
  onSelect,
  className,
  'aria-label': ariaLabel,
  'aria-checked': ariaChecked,
  'aria-describedby': ariaDescribedBy,
  children,
}: CommandItemProps) {
  const { search, filter, shouldFilter, store } = useContext(CommandContext);
  const group = useContext(CommandGroupContext);
  const id = useId();
  const itemValue = (value ?? commandItemText(children)).trim();
  const matches = !shouldFilter || search.trim() === '' || filter(itemValue, search, keywords) > 0;
  const shown = matches || forceMount;

  // Before paint, so `CommandEmpty` does not flash "No results" over a list that has rows.
  useLayoutEffect(() => {
    store.set(id, { matches, shown, group });
  }, [store, id, matches, shown, group]);
  useLayoutEffect(() => () => store.remove(id), [store, id]);

  if (!shown) return null;
  return (
    <Pressable
      role="option"
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      {...(ariaChecked === undefined ? {} : { 'aria-checked': ariaChecked })}
      // React Native has no `aria-describedby`; react-native-web reads it, the same arrangement
      // as `Input`'s.
      {...(Platform.OS === 'web' && ariaDescribedBy !== undefined ? { 'aria-describedby': ariaDescribedBy } : {})}
      onPress={() => onSelect?.(itemValue)}
      className={cn(
        'flex-row items-center gap-2 rounded-sm px-2 py-1.5 active:bg-hover',
        disabled && 'opacity-50',
        className,
      )}
    >
      {/* Colour does not inherit on native: the row's icons take theirs through the context and
          a bare string its own `Text`. */}
      <IconClassContext.Provider value="size-4 shrink-0 text-foreground/60">
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text numberOfLines={1} className="flex-1 text-sm text-foreground">
            {children}
          </Text>
        ) : (
          children
        )}
      </IconClassContext.Provider>
    </Pressable>
  );
}

function CommandShortcut({ className, children }: CommandShortcutProps) {
  return <Text className={cn('ml-auto text-xs tracking-widest text-foreground/60', className)}>{children}</Text>;
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
