export type ThemePreference = 'light' | 'dark' | 'system';

/** In the order a picker shows them. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * The key the preference is stored under, on both platforms. One key rather than an option: the
 * picker's own hook, the one at the app's root and the pre-paint script all have to agree on it,
 * and a key passed to one of them and not the others is a picker that writes where nothing reads.
 */
export const THEME_STORAGE_KEY = 'cubeui-theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Where the device keeps the preference. `@react-native-async-storage/async-storage` fits as it
 * is; `expo-secure-store` or MMKV fit behind two lambdas. The item takes the shape rather than a
 * package, so it adds no storage dependency to an app that already has one. Either method may
 * return a promise.
 */
export type ThemeStorage = {
  getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

/**
 * Which set of colours to paint in, beside the light / dark choice. `default` is cubeui's own and
 * what nothing stored means; the rest are `palettes` in `tokens/palette.mjs`.
 */
export type PalettePreference = 'default' | 'monokai';

/** In the order a picker shows them. */
export const PALETTE_PREFERENCES: readonly PalettePreference[] = ['default', 'monokai'];

/** Where the palette is stored, beside `THEME_STORAGE_KEY` and for the same reason. */
export const PALETTE_STORAGE_KEY = 'cubeui-palette';

/**
 * Palettes with no light set. Choosing one is dark whatever the theme says — there is no light
 * Monokai to paint — and a picker shows the theme choice as moot while one is chosen.
 */
export const DARK_ONLY_PALETTES: readonly PalettePreference[] = ['monokai'];

export function isPalettePreference(value: unknown): value is PalettePreference {
  return PALETTE_PREFERENCES.includes(value as PalettePreference);
}

export type ThemePreferenceOptions = {
  /**
   * Device only: where the choice persists between launches. Without one, a choice lasts until
   * the app is closed. Pass it where the app starts; a `useThemePreference()` anywhere else — the
   * one inside `ThemePicker` — writes through it too. The web always uses `localStorage`, because
   * it is the one store the pre-paint script can read before any of the bundle has loaded.
   */
  storage?: ThemeStorage | undefined;
};

/** What `useThemePreference` returns: the stored choice and the one way to change it. */
export type ThemePreferenceState = readonly [
  preference: ThemePreference,
  setPreference: (next: ThemePreference) => void,
];

/** What `usePalettePreference` returns, the same shape. */
export type PalettePreferenceState = readonly [
  palette: PalettePreference,
  setPalette: (next: PalettePreference) => void,
];

/**
 * The web's first paint, before React mounts: the same rule `useThemePreference` applies, as a
 * self-contained script for an inline `<script>` in the page's `<head>`. Render it with
 * `dangerouslySetInnerHTML` where the head is React (Expo's `+html.tsx`, a Next layout); paste the
 * copy in the skill's `controls.md` where it is a static `index.html`. A unit test holds that copy
 * to this string.
 *
 * `dark` goes on `<html>` for Dark, and for System while the device is dark; `light` goes on it for
 * Light only. A dark-only palette is `dark` whatever the theme, and never `light`. A palette other
 * than the default is `data-palette` on `<html>`, which both stylesheets key its colours off. `dist/tokens.native.css` (Expo web) reads both over its `prefers-color-scheme` block;
 * `tokens.web.css` (the DOM registry) has no media query and reads `.dark` alone, which is why
 * System still sets `dark` on a dark device rather than leaving it to a query that stylesheet does
 * not have.
 *
 * Written in ES5 and wrapped in `try`, because it runs before anything else on the page and a
 * browser with storage switched off throws on `localStorage` itself.
 */
export const THEME_PRE_PAINT_SCRIPT =
  '(function(){try{' +
  `var s=localStorage,p=s.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),` +
  `q=s.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)}),` +
  `k=${JSON.stringify(DARK_ONLY_PALETTES)}.indexOf(q)>=0,` +
  'd=k||p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches),' +
  'e=document.documentElement,c=e.classList;c.toggle("dark",d);c.toggle("light",!k&&p==="light");' +
  `if(${JSON.stringify(PALETTE_PREFERENCES.filter((p) => p !== 'default'))}.indexOf(q)>=0)` +
  'e.setAttribute("data-palette",q)' +
  '}catch(e){}})();';
