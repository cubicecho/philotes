import * as dbSchema from '@cubicecho/philotes-db/schema';
import { MailboxStatus } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { credentialContext, openCredential } from '../../mail/credential.ts';
import type { MailService } from '../../mail/reader.ts';
import { closeTestDb, createClient, createTestDb, createUser, resetTestDb, type TestDb } from '../helpers.ts';
import { type FakeMailbox, fakeMailbox, fakeMailService } from './fake-mailbox.ts';

const CONNECT = `
  mutation ($input: ConnectMailboxInput!) {
    connectMailbox(input: $input) { id host port username address status lastError }
  }
`;
const READ = '{ mailbox { id host username status } mailSyncAvailable }';
const DISCONNECT = 'mutation { disconnectMailbox }';

/** What the user types to connect. */
const INPUT = { host: ' IMAP.Example.com ', username: 'me@example.com', password: 'app-password' };

describe('connecting a mailbox', () => {
  let db: TestDb;
  let userId: string;
  let mailbox: FakeMailbox;
  let mail: MailService;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(db);
    userId = await createUser(db, 'me@example.com');
    mailbox = fakeMailbox();
    mail = fakeMailService(mailbox);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  /**
   * Reads the user's mailbox row as stored.
   *
   * @returns The row, or undefined.
   */
  async function storedRow(): Promise<dbSchema.Mailbox | undefined> {
    const [row] = await db.select().from(dbSchema.mailboxes).where(eq(dbSchema.mailboxes.userId, userId));
    return row;
  }

  it('checks the login, then stores the mailbox with its password sealed', async () => {
    const data = await createClient(db, userId, { mail }).expectOk<{ connectMailbox: Record<string, unknown> }>(
      CONNECT,
      { input: INPUT },
    );

    expect(data.connectMailbox).toMatchObject({
      host: 'imap.example.com',
      port: MAIL_DEFAULTS.defaultPort,
      username: 'me@example.com',
      address: 'me@example.com',
      status: MailboxStatus.Active,
      lastError: null,
    });
    expect(mailbox.logins).toEqual([
      { host: 'imap.example.com', port: 993, username: 'me@example.com', password: 'app-password' },
    ]);
    const row = await storedRow();
    expect(row?.credential).not.toContain('app-password');
    expect(row && openCredential(mail.keyring, row.credential, credentialContext(userId))).toBe('app-password');
  });

  it('never answers with the password: the schema has no field for it', async () => {
    const result = await createClient(db, userId, { mail }).run('{ mailbox { credential } }');

    expect(result.errors?.[0].message).toMatch(/credential/);
  });

  it('is refused on a server with no credential keys', async () => {
    const client = createClient(db, userId);

    const read = await client.expectOk<{ mailSyncAvailable: boolean }>(READ);
    await client.expectError(ErrorCode.BadUserInput, CONNECT, { input: INPUT });

    expect(read.mailSyncAvailable).toBe(false);
    expect(await storedRow()).toBeUndefined();
  });

  it('is refused when the mail server refuses the login, and nothing is stored', async () => {
    const error = await createClient(db, userId, { mail }).expectError(ErrorCode.BadUserInput, CONNECT, {
      input: { ...INPUT, password: 'wrong' },
    });

    expect(error.message).toMatch(/refused the login/);
    expect(await storedRow()).toBeUndefined();
  });

  it('says one thing for any server it cannot reach, whatever the cause', async () => {
    mailbox.unreachable = true;

    const error = await createClient(db, userId, { mail }).expectError(ErrorCode.BadUserInput, CONNECT, {
      input: INPUT,
    });

    expect(error.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.9/);
  });

  it.each([
    ['a host with a scheme', { host: 'https://imap.example.com' }],
    ['a port out of range', { port: 70_000 }],
    ['an empty password', { password: '' }],
    ['a login that is not an address, with no address given', { username: 'me' }],
  ])('refuses %s', async (_name, overrides) => {
    await createClient(db, userId, { mail }).expectError(ErrorCode.BadUserInput, CONNECT, {
      input: { ...INPUT, ...overrides },
    });
  });

  it('takes a login that is not an address when the address is given', async () => {
    const data = await createClient(db, userId, { mail }).expectOk<{ connectMailbox: { address: string } }>(CONNECT, {
      input: { ...INPUT, username: 'me', address: 'Me@Example.com' },
    });

    expect(data.connectMailbox.address).toBe('me@example.com');
  });

  it('connected again, keeps the cursors of the same mailbox and clears a refused login', async () => {
    const client = createClient(db, userId, { mail });
    await client.expectOk(CONNECT, { input: INPUT });
    const cursors = { INBOX: { uidValidity: '1', lastUid: 40 } };
    await db
      .update(dbSchema.mailboxes)
      .set({ cursors, status: MailboxStatus.NeedsReconnect, lastError: 'refused' })
      .where(eq(dbSchema.mailboxes.userId, userId));

    await client.expectOk(CONNECT, { input: INPUT });

    expect(await storedRow()).toMatchObject({ cursors, status: MailboxStatus.Active, lastError: null });
  });

  it('connected to another mailbox, starts its cursors afresh', async () => {
    const client = createClient(db, userId, { mail });
    await client.expectOk(CONNECT, { input: INPUT });
    await db
      .update(dbSchema.mailboxes)
      .set({ cursors: { INBOX: { uidValidity: '1', lastUid: 40 } } })
      .where(eq(dbSchema.mailboxes.userId, userId));

    await client.expectOk(CONNECT, { input: { ...INPUT, host: 'imap.other.example.com' } });

    expect((await storedRow())?.cursors).toEqual({});
  });

  it('disconnects, deleting the saved password', async () => {
    const client = createClient(db, userId, { mail });
    await client.expectOk(CONNECT, { input: INPUT });

    const first = await client.expectOk<{ disconnectMailbox: boolean }>(DISCONNECT);
    const second = await client.expectOk<{ disconnectMailbox: boolean }>(DISCONNECT);

    expect(first.disconnectMailbox).toBe(true);
    expect(second.disconnectMailbox).toBe(false);
    expect(await storedRow()).toBeUndefined();
  });

  it("shows nobody another user's mailbox", async () => {
    await createClient(db, userId, { mail }).expectOk(CONNECT, { input: INPUT });
    const strangerId = await createUser(db, 'stranger@example.com');
    const stranger = createClient(db, strangerId, { mail });

    const read = await stranger.expectOk<{ mailbox: unknown }>(READ);
    await stranger.expectOk(DISCONNECT);

    expect(read.mailbox).toBeNull();
    expect(await storedRow()).toBeDefined();
  });

  it('refuses a caller who is not signed in', async () => {
    await createClient(db, null, { mail }).expectError(ErrorCode.Unauthenticated, READ);
  });
});
