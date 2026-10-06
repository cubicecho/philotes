import { VariableContextProvider } from 'nativewind';
import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import {
  DARK_ONLY_PALETTES,
  isPalettePreference,
  isThemePreference,
  PALETTE_STORAGE_KEY,
  type PalettePreference,
  type PalettePreferenceState,
  THEME_STORAGE_KEY,
  type ThemePreference,
  type ThemePreferenceOptions,
  type ThemePreferenceState,
  type ThemeStorage,
} from '@/components/ui/theme-preference-base';
import { cssVariables, paletteFor } from '@/lib/cubeui-theme';

/**
 * One preference per app, held here rather than per hook: the picker's hook and the one at the
 * app's root are the same choice. There is no device to read at import, so nothing does.
 */
let current: ThemePreference = 'system';
let currentPalette: PalettePreference = 'default';
/** The adapter the most recent hook that passed one was given, so a hook without one writes too. */
let storage: ThemeStorage | null = null;
/** Whether each stored value has been read, or overtaken by a choice made before it arrived. */
const settled = { theme: false, palette: false };
/** Whether the stored values have been asked for, so a second hook does not ask again. */
let loading = false;
const listeners = new Set<() => void>();

/**
 * "Follow the device", in the spelling both sides of React Native 0.82 accept at runtime. From 0.82
 * `setColorScheme` takes `"unspecified"` and hands `null` to the native module as is; before it,
 * `null` was the typed spelling but was turned into `"unspecified"` on the way down anyway. The
 * cast is for the 0.81 types, which do not list the string — it keeps one call compiling on both.
 */
const FOLLOW_SYSTEM = 'unspecified' as unknown as Parameters<typeof Appearance.setColorScheme>[0];

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function snapshot() {
  return current;
}

function paletteSnapshot() {
  return currentPalette;
}

/** Both choices at once: a dark-only palette decides the appearance, whatever the theme says. */
function apply() {
  const scheme = DARK_ONLY_PALETTES.includes(currentPalette) ? 'dark' : current;
  Appearance.setColorScheme(scheme === 'system' ? FOLLOW_SYSTEM : scheme);
  for (const listener of listeners) listener();
}

function persist(key: string, value: string) {
  if (!storage) return;
  Promise.resolve(storage.setItem(key, value)).catch(() => {
    // Not persisted, but still applied: the app should not ignore the tap.
  });
}

/** Module-level, so every caller's setter is the same function and safe in a dependency list. */
function setPreference(next: ThemePreference) {
  settled.theme = true;
  current = next;
  apply();
  persist(THEME_STORAGE_KEY, next);
}

function setPalette(next: PalettePreference) {
  settled.palette = true;
  currentPalette = next;
  apply();
  persist(PALETTE_STORAGE_KEY, next);
}

/** Read both stored choices once, the first time a hook is handed somewhere to read them from. */
function load(adapter: ThemeStorage) {
  storage = adapter;
  if (loading) return;
  loading = true;
  Promise.all([adapter.getItem(THEME_STORAGE_KEY), adapter.getItem(PALETTE_STORAGE_KEY)])
    .then(([theme, palette]) => {
      // A choice made while the read was in flight is newer than what it will return.
      let changed = false;
      if (!settled.theme && isThemePreference(theme) && theme !== current) {
        current = theme;
        changed = true;
      }
      if (!settled.palette && isPalettePreference(palette) && palette !== currentPalette) {
        currentPalette = palette;
        changed = true;
      }
      settled.theme = settled.palette = true;
      if (changed) apply();
    })
    .catch(() => {
      // Nothing readable is the same as nothing stored: follow the system, in the default palette.
      settled.theme = settled.palette = true;
    });
}

/**
 * The stored light / dark / system choice, and a setter that stores and applies it. Call it with
 * `storage` where the app starts; the `ThemePicker` and any other caller share that choice. It
 * reads the stored palette too, so the one call at the root covers both.
 */
export function useThemePreference(options: ThemePreferenceOptions = {}): ThemePreferenceState {
  const adapter = options.storage;
  const preference = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (adapter) load(adapter);
  }, [adapter]);

  return [preference, setPreference] as const;
}

/**
 * The stored palette — `default` or one of `PALETTE_PREFERENCES` — and a setter that stores and
 * applies it, through the same `storage` as the theme. Painting it is `PaletteProvider`'s.
 */
export function usePalettePreference(options: ThemePreferenceOptions = {}): PalettePreferenceState {
  const adapter = options.storage;
  const palette = useSyncExternalStore(subscribe, paletteSnapshot, paletteSnapshot);

  useEffect(() => {
    if (adapter) load(adapter);
  }, [adapter]);

  return [palette, setPalette] as const;
}

/** Stable, so the default palette hands the context the same nothing every render. */
const NO_VARIABLES = {};

/**
 * Wrap the app's root in it — inside nothing that draws — and the chosen palette's colours reach
 * every component under it, a `Modal`'s included, since they travel as React context and not as
 * a stylesheet. The default palette is the stylesheet's own, so it passes no variables; the
 * provider is always there, so a change of palette never remounts the app.
 */
export function PaletteProvider({ children }: { children?: ReactNode }) {
  const palette = useSyncExternalStore(subscribe, paletteSnapshot, paletteSnapshot);
  const scheme = useColorScheme();
  const value = useMemo(
    () =>
      palette === 'default' ? NO_VARIABLES : cssVariables(paletteFor(scheme === 'dark' ? 'dark' : 'light', palette)),
    [palette, scheme],
  );
  return <VariableContextProvider value={value}>{children}</VariableContextProvider>;
}
