import { describe, expect, it } from 'vitest';
import { nameToColor } from '@/lib/name-color';

describe('nameToColor', () => {
  it('gives the same name the same colour every time', () => {
    expect(nameToColor('Ada Lovelace')).toBe(nameToColor('Ada Lovelace'));
  });

  it('gives a hex colour, which both the avatar and the network graph can draw', () => {
    expect(nameToColor('Ada Lovelace')).toMatch(/^#[0-9a-f]{6}$/);
    expect(nameToColor('')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
