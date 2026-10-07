export const light = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  secondary: '#fafafa',
  neutral: '#171717',
  neutralForeground: '#fafafa',
  hover: '#d4eaf0',
  active: '#2d6d7e',
  activeForeground: '#ffffff',
  positive: '#15803d',
  positiveForeground: '#ffffff',
  warning: '#b45309',
  warningForeground: '#ffffff',
  info: '#0369a1',
  infoForeground: '#ffffff',
  negative: '#e7000b',
  negativeForeground: '#ffffff',
  overlay: '#000000',
  card: '#fafafa',
  cardForeground: '#0a0a0a',
  popover: '#fafafa',
  popoverForeground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  secondaryForeground: '#0a0a0a',
  muted: 'rgba(10, 10, 10, 0.1)',
  mutedForeground: 'rgba(10, 10, 10, 0.6)',
  accent: '#d4eaf0',
  accentForeground: '#0a0a0a',
  selection: '#2d6d7e',
  selectionForeground: '#ffffff',
  destructive: '#e7000b',
  destructiveForeground: '#ffffff',
  border: 'rgba(10, 10, 10, 0.1)',
  input: 'rgba(10, 10, 10, 0.15)',
  ring: '#2d6d7e',
  sidebar: '#fafafa',
  sidebarForeground: '#0a0a0a',
  sidebarPrimary: '#2d6d7e',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#d4eaf0',
  sidebarAccentForeground: '#0a0a0a',
  sidebarBorder: 'rgba(10, 10, 10, 0.1)',
  sidebarRing: '#2d6d7e',
} as const;

export const dark = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  secondary: '#262626',
  neutral: '#e5e5e5',
  neutralForeground: '#171717',
  hover: '#2a454c',
  active: '#69a2b3',
  activeForeground: '#0a0a0a',
  positive: '#22c55e',
  positiveForeground: '#0a0a0a',
  warning: '#f59e0b',
  warningForeground: '#0a0a0a',
  info: '#0ea5e9',
  infoForeground: '#0a0a0a',
  negative: '#ff6467',
  negativeForeground: '#0a0a0a',
  overlay: '#000000',
  card: '#262626',
  cardForeground: '#fafafa',
  popover: '#262626',
  popoverForeground: '#fafafa',
  primary: '#e5e5e5',
  primaryForeground: '#171717',
  secondaryForeground: '#fafafa',
  muted: 'rgba(250, 250, 250, 0.1)',
  mutedForeground: 'rgba(250, 250, 250, 0.6)',
  accent: '#2a454c',
  accentForeground: '#fafafa',
  selection: '#69a2b3',
  selectionForeground: '#0a0a0a',
  destructive: '#ff6467',
  destructiveForeground: '#0a0a0a',
  border: 'rgba(250, 250, 250, 0.1)',
  input: 'rgba(250, 250, 250, 0.15)',
  ring: '#69a2b3',
  sidebar: '#262626',
  sidebarForeground: '#fafafa',
  sidebarPrimary: '#69a2b3',
  sidebarPrimaryForeground: '#0a0a0a',
  sidebarAccent: '#2a454c',
  sidebarAccentForeground: '#fafafa',
  sidebarBorder: 'rgba(250, 250, 250, 0.1)',
  sidebarRing: '#69a2b3',
} as const;

export type ColorName = keyof typeof light;
export type Palette = Record<ColorName, string>;

/**
 * Pick a palette from RN's `useColorScheme()`, which returns null before it resolves.
 *
 * Which scheme that hook reports follows the **system** appearance, because the
 * stylesheet beside this file keys its dark palette off
 * `@media (prefers-color-scheme: dark)` — the only form react-native-css honours on
 * device. An in-app theme toggle is therefore
 * `Appearance.setColorScheme("dark")` from react-native, which moves both this and
 * the stylesheet together. It is *not* a `.dark` class on a wrapper: that is the web
 * mechanism, and on native it silently styles nothing.
 */
export const palettes = {
  monokai: {
    dark: {
      background: '#272822',
      foreground: '#f8f8f2',
      secondary: '#2d2e27',
      neutral: '#a6e22e',
      neutralForeground: '#272822',
      hover: '#3e3d32',
      active: '#ae81ff',
      activeForeground: '#272822',
      positive: '#22c55e',
      positiveForeground: '#272822',
      warning: '#fd971f',
      warningForeground: '#272822',
      info: '#66d9ef',
      infoForeground: '#272822',
      negative: '#ff6188',
      negativeForeground: '#272822',
      overlay: '#000000',
      card: '#2d2e27',
      cardForeground: '#f8f8f2',
      popover: '#2d2e27',
      popoverForeground: '#f8f8f2',
      primary: '#a6e22e',
      primaryForeground: '#272822',
      secondaryForeground: '#f8f8f2',
      muted: 'rgba(248, 248, 242, 0.1)',
      mutedForeground: 'rgba(248, 248, 242, 0.6)',
      accent: '#3e3d32',
      accentForeground: '#f8f8f2',
      selection: '#ae81ff',
      selectionForeground: '#272822',
      destructive: '#ff6188',
      destructiveForeground: '#272822',
      border: 'rgba(248, 248, 242, 0.1)',
      input: 'rgba(248, 248, 242, 0.15)',
      ring: '#ae81ff',
      sidebar: '#2d2e27',
      sidebarForeground: '#f8f8f2',
      sidebarPrimary: '#ae81ff',
      sidebarPrimaryForeground: '#272822',
      sidebarAccent: '#3e3d32',
      sidebarAccentForeground: '#f8f8f2',
      sidebarBorder: 'rgba(248, 248, 242, 0.1)',
      sidebarRing: '#ae81ff',
    },
  },
} as const satisfies Record<string, { light?: Palette; dark?: Palette }>;

/** `default` is `light` and `dark` above; the rest are chosen in the app. */
export type PaletteName = 'default' | keyof typeof palettes;

/**
 * Pick a palette from RN's `useColorScheme()`, which returns null before it resolves, and the
 * app's palette, `default` when left out.
 *
 * Which scheme that hook reports follows the **system** appearance, because the
 * stylesheet beside this file keys its dark palette off
 * `@media (prefers-color-scheme: dark)` — the only form react-native-css honours on
 * device. An in-app theme toggle is therefore
 * `Appearance.setColorScheme("dark")` from react-native, which moves both this and
 * the stylesheet together. It is *not* a `.dark` class on a wrapper: that is the web
 * mechanism, and on native it silently styles nothing.
 *
 * A palette with one mode is that mode whichever scheme is asked for.
 */
export const paletteFor = (scheme: 'light' | 'dark' | null | undefined, palette: PaletteName = 'default'): Palette => {
  if (palette !== 'default') {
    const modes: { light?: Palette; dark?: Palette } = palettes[palette];
    const set = scheme === 'dark' ? (modes.dark ?? modes.light) : (modes.light ?? modes.dark);
    if (set) return set;
  }
  return scheme === 'dark' ? dark : light;
};

/**
 * A palette as the CSS variables the stylesheet declares — `--card-foreground` for
 * `cardForeground` — for NativeWind's `VariableContextProvider`, which is how a palette the
 * device's appearance knows nothing about reaches the components under it.
 */
export const cssVariables = (palette: Palette): Record<`--${string}`, string> =>
  Object.fromEntries(
    Object.entries(palette).map(([name, value]) => [
      `--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
      value,
    ]),
  );
