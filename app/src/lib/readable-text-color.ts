export type Ink = {
  /** Drawn on light backdrops. */
  dark: string;
  /** Drawn on dark backdrops. */
  light: string;
};

/**
 * Near-black and pure white.
 *
 * White is not `#fafafa` and black is not the theme's `--foreground`, and neither is an
 * oversight: the backdrop here is a colour the user picked, not a surface the theme owns, so the
 * ink must not flip when the theme does. A chip that reads in light mode and vanishes in dark
 * mode is the bug this whole function exists to stop.
 */
export const INK: Ink = { dark: '#000000', light: '#ffffff' };

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without the `#`. */
const HEX = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The three channels of a hex colour as 0–1, or nothing.
 *
 * Alpha is parsed and dropped. Compositing it would need the colour *behind* the swatch, which
 * is the one thing a function taking a single colour cannot know — and guessing white would be
 * wrong in dark mode, which is where a translucent chip is hardest to read.
 */
function channels(hex: string): [number, number, number] | undefined {
  if (!HEX.test(hex)) return undefined;

  const digits = hex.replace('#', '');
  // Shorthand doubles each digit — `#f80` is `#ff8800`, not `#0f0800`. auto-cal's version slices
  // fixed offsets out of the string instead, so a three-digit colour parses as something else
  // entirely and returns an ink for a colour nobody picked.
  const full =
    digits.length <= 4
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;

  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16) / 255) as [number, number, number];
}

/** WCAG 2.x relative luminance. The piecewise curve is the standard sRGB transfer function. */
function luminance([r, g, b]: [number, number, number]): number {
  const linear = ([r, g, b] as const).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG 2.x contrast between two relative luminances, 1 through 21. */
function contrast(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ink for text sitting *on* a colour the user chose — a calendar event, a tag, a selected chip,
 * the tick on a picked swatch.
 *
 * Those places hardcode white, and white is right for about half of any palette: white on
 * `#f59e0b` is 2.2:1 and on `#14b8a6` is 2.5:1, both well under AA. Legibility cannot be baked
 * into a variant when the backdrop is a value out of the database, so it is computed per colour.
 *
 * Returns `undefined` for anything that is not a hex colour, so a caller falls back to the
 * inherited foreground rather than painting black onto a value it failed to read. That is the
 * contract worth keeping: the failure is visible, and it is visible in the right direction.
 *
 * ```tsx
 * <span style={{ background: tag.color, color: readableTextColor(tag.color) }}>{tag.name}</span>
 * ```
 *
 * Two projects wrote this independently and arrived at the same algorithm by two routes — one
 * comparing luminance against `0.179`, one comparing the two contrast ratios. They agree exactly,
 * because `0.179` *is* the crossover: `Math.sqrt(1.05 * 0.05) - 0.05`. The ratio comparison is
 * what is written here, because it needs no constant to be believed.
 */
export function readableTextColor(color: string | null | undefined, ink: Ink = INK): string | undefined {
  if (!color) return undefined;

  const rgb = channels(color);
  if (!rgb) return undefined;

  const backdrop = luminance(rgb);
  return contrast(backdrop, 0) >= contrast(backdrop, 1) ? ink.dark : ink.light;
}
