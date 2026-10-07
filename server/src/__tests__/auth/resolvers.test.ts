import { describe, expect, it } from 'vitest';
import { signMagicToken, signToken, verifyMagicToken, verifyToken } from '../../auth/resolvers.ts';

describe('signToken / verifyToken (session)', () => {
  it('round-trips a userId', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload?.userId).toBe('user-123');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('user-123');
    expect(verifyToken(`${token}x`)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('does not contain an email claim', () => {
    const token = signToken('user-123');
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    expect(payload.email).toBeUndefined();
    expect(payload.userId).toBe('user-123');
  });
});

describe('signMagicToken / verifyMagicToken', () => {
  it('round-trips an email', () => {
    const token = signMagicToken('alice@example.com');
    const payload = verifyMagicToken(token);
    expect(payload?.email).toBe('alice@example.com');
  });

  it('returns null for a tampered token', () => {
    const token = signMagicToken('alice@example.com');
    expect(verifyMagicToken(`${token}x`)).toBeNull();
  });

  it('does not contain a userId claim', () => {
    const token = signMagicToken('alice@example.com');
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    expect(payload.userId).toBeUndefined();
    expect(payload.email).toBe('alice@example.com');
  });

  it('session verifyToken returns a payload with no userId for a magic token', () => {
    // Magic tokens share the same secret but carry email not userId.
    // The extractUserId helper in the server will return null because
    // payload.userId is undefined — this test documents that behaviour.
    const magicToken = signMagicToken('alice@example.com');
    const payload = verifyToken(magicToken);
    expect(payload?.userId).toBeUndefined();
  });
});
