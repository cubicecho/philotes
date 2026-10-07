import { describe, expect, it } from 'vitest';
import { avatarUrl } from '@/lib/api-url';

describe('avatarUrl', () => {
  it('uses the stored path as it is, without a second /avatars prefix', () => {
    expect(avatarUrl('/avatars/3f2a.png')).toBe('/avatars/3f2a.png');
  });
});
