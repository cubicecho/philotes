export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s, l };
}

/**
 * Keeps the hue but clamps lightness to a mid range, so a near-white or
 * near-black pick cannot disappear against either the light or the dark card.
 */
export function hexToAccent(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  const clampedL = Math.min(0.62, Math.max(0.38, l));
  return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(clampedL * 100)}%)`;
}

/** A desaturated, high-lightness tint of a colour, for a background behind text. */
export function hexToDesaturated(hex: string): string {
  const { h } = hexToHsl(hex);
  return `hsl(${h}, 25%, 88%)`;
}
