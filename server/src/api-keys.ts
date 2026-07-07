import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'phlt_';

export function generateApiKey(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('base64url');
  const token = `${PREFIX}${raw}`;
  const hash = hashApiKey(token);
  const prefix = raw.slice(0, 8);
  return { token, hash, prefix };
}

export function isApiKey(raw: string): boolean {
  return raw.startsWith(PREFIX);
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
