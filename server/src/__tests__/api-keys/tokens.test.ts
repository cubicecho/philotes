import { describe, expect, it } from 'vitest';
import { constantTimeEqual, generateApiKey, hashApiKey, isApiKey } from '../../api-keys/tokens.ts';

describe('generateApiKey', () => {
  it('returns a prefixed token with its own hash', () => {
    const { token, hash, prefix } = generateApiKey();
    expect(token.startsWith('phlt_')).toBe(true);
    expect(hash).toBe(hashApiKey(token));
    expect(prefix).toHaveLength(8);
    expect(token).toContain(prefix);
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateApiKey().token));
    expect(tokens.size).toBe(50);
  });

  it('stores a hash, not the token', () => {
    const { token, hash } = generateApiKey();
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isApiKey', () => {
  it('recognises the api-key prefix', () => {
    expect(isApiKey(generateApiKey().token)).toBe(true);
  });

  it('rejects anything else, including a session JWT', () => {
    expect(isApiKey('eyJhbGciOiJIUzI1NiJ9.e30.abc')).toBe(false);
    expect(isApiKey('')).toBe(false);
  });
});

describe('hashApiKey', () => {
  it('is deterministic', () => {
    expect(hashApiKey('phlt_abc')).toBe(hashApiKey('phlt_abc'));
    expect(hashApiKey('phlt_abc')).not.toBe(hashApiKey('phlt_abd'));
  });
});

describe('constantTimeEqual', () => {
  it('matches identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
  });

  it('rejects different strings', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });

  it('returns false rather than throwing on a length mismatch', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
