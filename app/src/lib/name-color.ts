/** The swatches a name can land on. All mid-lightness, so white text holds on every one. */
const NAME_COLORS = [
  '#e2a87a',
  '#7ab8e2',
  '#7ae2a8',
  '#e27ab8',
  '#a8e27a',
  '#b87ae2',
  '#e2c87a',
  '#7ae2c8',
  '#c87ae2',
  '#e27a7a',
] as const;
const HASH_MULTIPLIER = 31;

/**
 * The colour that stands for a person who has no photo and no label colour. The same name gives
 * the same colour everywhere: the avatar circle and the network graph both read it from here.
 *
 * @param name - The person's full name.
 * @returns A hex colour from the palette.
 */
export function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * HASH_MULTIPLIER + name.charCodeAt(i)) >>> 0;
  }
  return NAME_COLORS[hash % NAME_COLORS.length];
}
