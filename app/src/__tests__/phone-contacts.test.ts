import { describe, expect, it } from 'vitest';
import { AccountRefresh, accountRefreshFor } from '../lib/phone-contacts-base';

describe('the phone contacts account on opening the app', () => {
  it('is left alone when there is none', () => {
    expect(accountRefreshFor(null, 'me@example.com')).toBe(AccountRefresh.None);
  });

  it('is handed the new session when it is the signed-in user’s', () => {
    expect(accountRefreshFor('Me@Example.com', 'me@example.com')).toBe(AccountRefresh.Refresh);
  });

  it('is removed when someone else signed in after a session ended without signing out', () => {
    expect(accountRefreshFor('them@example.com', 'me@example.com')).toBe(AccountRefresh.Remove);
  });
});
