import { describe, expect, it } from 'vitest';
import { requiresSsl } from '../ssl.ts';

describe('requiresSsl', () => {
  it.each([
    'postgres://u:p@localhost:5432/app',
    'postgres://u:p@postgres:5432/app',
    'postgres://u:p@127.0.0.1/app',
    'postgres://u:p@10.0.0.5/app',
    'postgres://u:p@172.20.1.1/app',
    'postgres://u:p@192.168.1.10/app',
    'postgres://u:p@169.254.1.1/app',
    'postgres://u:p@[::1]:5432/app',
    'postgres://u:p@[fd12:3456::1]/app',
    'postgres://u:p@[fe80::1]/app',
    'postgres://u:p@nas.lan/app',
    'postgres://u:p@db.home.arpa/app',
  ])('is false for the local or private host in %s', (url) => {
    expect(requiresSsl(url)).toBe(false);
  });

  it.each(['postgres://u:p@db.example.com/app', 'postgres://u:p@8.8.8.8/app', 'postgres://u:p@172.32.0.1/app'])(
    'is true for the public host in %s',
    (url) => {
      expect(requiresSsl(url)).toBe(true);
    },
  );

  it('respects an explicit sslmode', () => {
    expect(requiresSsl('postgres://u:p@db.example.com/app?sslmode=disable')).toBe(false);
  });
});
