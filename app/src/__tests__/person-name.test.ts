import { describe, expect, it } from 'vitest';
import { fullName } from '@/lib/person-name';

describe('fullName', () => {
  it('joins the first and last name with a space', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  });
});
