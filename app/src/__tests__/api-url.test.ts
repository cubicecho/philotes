import { afterEach, describe, expect, it } from 'vitest';
import {
  apiUrl,
  avatarUploadUrl,
  avatarUrl,
  cardDavUrl,
  graphqlUrl,
  normalizeServerUrl,
  setApiUrl,
} from '@/lib/api-url';

afterEach(() => {
  setApiUrl(null);
});

describe('avatarUrl', () => {
  it('uses the stored path as it is, without adding a second /avatars/ prefix', () => {
    expect(avatarUrl('/avatars/3f2a.png')).toBe('/avatars/3f2a.png');
  });
});

describe('setApiUrl', () => {
  it('points every address at the server it is given', () => {
    setApiUrl('https://philotes.example.com');

    expect(apiUrl()).toBe('https://philotes.example.com');
    expect(graphqlUrl()).toBe('https://philotes.example.com/graphql');
    expect(avatarUrl('/avatars/3f2a.png')).toBe('https://philotes.example.com/avatars/3f2a.png');
    expect(avatarUploadUrl('p1')).toBe('https://philotes.example.com/avatars/p1');
    expect(cardDavUrl()).toBe('https://philotes.example.com/dav/');
  });

  it('goes back to the address the app was built with when given null', () => {
    const builtWith = apiUrl();
    setApiUrl('https://philotes.example.com');

    setApiUrl(null);

    expect(apiUrl()).toBe(builtWith);
  });
});

describe('normalizeServerUrl', () => {
  it.each([
    ['philotes.example.com', 'https://philotes.example.com'],
    ['  https://philotes.example.com/  ', 'https://philotes.example.com'],
    ['http://192.168.1.20:3000', 'http://192.168.1.20:3000'],
    ['HTTPS://Philotes.Example.com', 'https://philotes.example.com'],
    ['https://example.com/philotes//', 'https://example.com/philotes'],
    ['docker.lan:3000', 'https://docker.lan:3000'],
  ])('reads %j as %j', (typed, expected) => {
    expect(normalizeServerUrl(typed)).toBe(expected);
  });

  it.each(['', '   ', 'ftp://example.com', 'https://', 'not a server'])('refuses %j', (typed) => {
    expect(normalizeServerUrl(typed)).toBeNull();
  });
});
