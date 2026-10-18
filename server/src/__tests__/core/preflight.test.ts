import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Preflight exits the process, so each case runs it in a process of its own.

const PREFLIGHT = fileURLToPath(new URL('../../core/preflight.ts', import.meta.url));

/** Everything preflight asks for, valid, outside production. */
const VALID_ENV = {
  DATABASE_URL: 'postgres://philotes:philotes@localhost:5432/philotes',
  NODE_ENV: 'development',
};

const ISSUER = 'https://id.example.com/oidc';

/**
 * Runs preflight alone under an environment.
 *
 * @param overrides - Variables added to `VALID_ENV`, or replacing one of its own.
 * @returns The exit status and what was printed to stderr.
 */
function runPreflight(overrides: Record<string, string> = {}): { status: number | null; stderr: string } {
  const env = { PATH: process.env.PATH ?? '', ...VALID_ENV, ...overrides };
  const { status, stderr } = spawnSync(process.execPath, [PREFLIGHT], { env, encoding: 'utf8' });
  return { status, stderr };
}

describe('preflight', () => {
  it('passes an environment with no OIDC provider', () => {
    expect(runPreflight()).toEqual({ status: 0, stderr: '' });
  });

  it('passes a complete OIDC provider', () => {
    const oidc = { OIDC_ISSUER: ISSUER, OIDC_CLIENT_ID: 'philotes', OIDC_CLIENT_AUTH: 'client_secret_post' };
    expect(runPreflight(oidc)).toEqual({ status: 0, stderr: '' });
  });

  it.each([
    ['an issuer without a client id', { OIDC_ISSUER: ISSUER }],
    ['a client id without an issuer', { OIDC_CLIENT_ID: 'philotes' }],
  ])('refuses %s', (_label, env) => {
    const { status, stderr } = runPreflight(env);
    expect(status).toBe(1);
    expect(stderr).toContain('OIDC_ISSUER and OIDC_CLIENT_ID go together');
  });

  it('refuses an issuer that is not a URL', () => {
    const { status, stderr } = runPreflight({ OIDC_ISSUER: 'id.example.com', OIDC_CLIENT_ID: 'philotes' });
    expect(status).toBe(1);
    expect(stderr).toContain('OIDC_ISSUER is not a URL');
  });

  it('refuses a client auth method it does not know', () => {
    const { status, stderr } = runPreflight({
      OIDC_ISSUER: ISSUER,
      OIDC_CLIENT_ID: 'philotes',
      OIDC_CLIENT_AUTH: 'jwt',
    });
    expect(status).toBe(1);
    expect(stderr).toContain('OIDC_CLIENT_AUTH must be one of');
  });
});
