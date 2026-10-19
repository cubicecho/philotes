import * as dbSchema from '@cubicecho/philotes-db/schema';
import { ContactType, InteractionDirection, MailboxStatus } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_DEFAULTS } from '../../core/defaults.ts';
import { MS_PER_DAY, MS_PER_MINUTE } from '../../core/wire.ts';
import { credentialContext, sealCredential } from '../../mail/credential.ts';
import { eventOf } from '../../mail/poll.ts';
import {
  createMailPoller,
  LOGIN_REFUSED_MESSAGE,
  retryMinutes,
  UNREACHABLE_MESSAGE,
  UNREADABLE_MESSAGE,
} from '../../mail/poller.ts';
import type { MailService } from '../../mail/reader.ts';
import {
  closeTestDb,
  createContactInfo,
  createPerson,
  createTestDb,
  createUser,
  resetTestDb,
  type TestDb,
} from '../helpers.ts';
import { type FakeMailbox, fakeMailbox, fakeMailService, header, keyEntry, keyringOf } from './fake-mailbox.ts';

const NOW = new Date('2026-10-18T12:00:00.000Z');
const OWN = 'me@example.com';
const ADA = 'ada@example.com';
const GRACE = 'grace@example.com';

describe('eventOf', () => {
  const own = new Set([OWN]);

  it('takes the sender of mail that came in', () => {
    const event = eventOf(header(1, { from: [ADA], to: [OWN, GRACE] }), InteractionDirection.Incoming, own, 'x');

    expect(event?.addresses).toEqual([ADA]);
  });

  it('takes every recipient of mail that went out, but not the user', () => {
    const sent = header(1, { from: [OWN], to: [ADA], cc: ['Me@Example.com'], bcc: [GRACE] });

    expect(eventOf(sent, InteractionDirection.Outgoing, own, 'x')?.addresses).toEqual([ADA, GRACE]);
  });

  it('logs nothing for mail from the user to the user', () => {
    expect(eventOf(header(1, { from: [OWN] }), InteractionDirection.Incoming, own, 'x')).toBeNull();
  });

  it('knows a message with no Message-ID by its folder and UID', () => {
    const event = eventOf(header(9, { from: [ADA], messageId: null }), InteractionDirection.Incoming, own, 'INBOX:1:9');

    expect(event?.externalId).toBe('INBOX:1:9');
  });
});

describe('retryMinutes', () => {
  it('doubles with each failure, up to the longest wait', () => {
    const waits = [1, 2, 3, 4, 20].map((failures) => retryMinutes(failures, MAIL_DEFAULTS));

    expect(waits).toEqual([1, 2, 4, 8, MAIL_DEFAULTS.retryMaxMinutes]);
  });
});

describe('the mail poller', () => {
  let db: TestDb;
  let userId: string;
  let adaId: string;
  let graceId: string;
  let mailbox: FakeMailbox;
  let mail: MailService;
  let clock: Date;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(db);
    userId = await createUser(db, OWN);
    adaId = await createPerson(db, userId, 'Ada');
    graceId = await createPerson(db, userId, 'Grace');
    await createContactInfo(db, { userId, personId: adaId, type: ContactType.Email, value: ADA });
    await createContactInfo(db, { userId, personId: graceId, type: ContactType.Email, value: GRACE });
    mailbox = fakeMailbox();
    mail = fakeMailService(mailbox);
    clock = NOW;
    await connect(mailbox.password);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  /**
   * Stores the test user's mailbox, due now, with a password sealed under the test keyring.
   *
   * @param password - The password to seal.
   */
  async function connect(password: string): Promise<void> {
    await db.insert(dbSchema.mailboxes).values({
      userId,
      host: 'imap.example.com',
      port: 993,
      username: OWN,
      address: OWN,
      credential: sealCredential(mail.keyring, password, credentialContext(userId)),
      nextPollAt: NOW,
    });
  }

  /**
   * Builds a poller over the test database and mailbox, on the test clock.
   *
   * @returns The poller.
   */
  function poller() {
    return createMailPoller({ db, mail, now: () => clock }, { pageSize: 2 });
  }

  /**
   * Reads the test user's mailbox row.
   *
   * @returns The row.
   */
  async function storedMailbox(): Promise<dbSchema.Mailbox> {
    const [row] = await db.select().from(dbSchema.mailboxes).where(eq(dbSchema.mailboxes.userId, userId));
    return row;
  }

  /**
   * Reads the test user's interactions.
   *
   * @returns The rows.
   */
  async function storedInteractions(): Promise<dbSchema.Interaction[]> {
    return db.select().from(dbSchema.interactions).where(eq(dbSchema.interactions.userId, userId));
  }

  it('logs mail in the inbox and the sent folder, headers only, and polls again later', async () => {
    mailbox.folders.INBOX.messages = [header(1, { from: [ADA], to: [OWN] }), header(2, { from: ['spam@example.com'] })];
    mailbox.folders.Sent.messages = [header(5, { from: [OWN], to: [GRACE], cc: [ADA] })];

    await poller().tick();

    const rows = await storedInteractions();
    const logged = rows.map((row) => [row.personId, row.direction, row.channel]).sort();
    expect(logged).toEqual(
      [
        [adaId, InteractionDirection.Incoming, 'email'],
        [adaId, InteractionDirection.Outgoing, 'email'],
        [graceId, InteractionDirection.Outgoing, 'email'],
      ].sort(),
    );
    expect(mailbox.fetchedUids).toEqual([1, 2, 5]);
    expect(mailbox.sinceSearches).toEqual([
      new Date(NOW.getTime() - MAIL_DEFAULTS.firstPollDays * MS_PER_DAY),
      new Date(NOW.getTime() - MAIL_DEFAULTS.firstPollDays * MS_PER_DAY),
    ]);
    const stored = await storedMailbox();
    expect(stored).toMatchObject({ status: MailboxStatus.Active, failureCount: 0, lastError: null });
    expect(stored.cursors).toEqual({ INBOX: { uidValidity: '1', lastUid: 2 }, Sent: { uidValidity: '1', lastUid: 5 } });
    expect(stored.nextPollAt.getTime()).toBe(NOW.getTime() + MAIL_DEFAULTS.pollIntervalMinutes * MS_PER_MINUTE);
  });

  it('polled again, reads only what is new and logs nothing twice', async () => {
    mailbox.folders.INBOX.messages = [header(1, { from: [ADA] })];
    await poller().tick();
    mailbox.folders.INBOX.messages.push(header(3, { from: [GRACE] }));
    clock = new Date(NOW.getTime() + MAIL_DEFAULTS.pollIntervalMinutes * MS_PER_MINUTE);
    mailbox.fetchedUids = [];

    await poller().tick();

    expect(mailbox.fetchedUids).toEqual([3]);
    expect(await storedInteractions()).toHaveLength(2);
  });

  it('starts a folder over when its UIDVALIDITY changes, and still logs nothing twice', async () => {
    mailbox.folders.INBOX.messages = [header(1, { from: [ADA] })];
    await poller().tick();
    mailbox.folders.INBOX = { uidValidity: '2', messages: [header(1, { from: [ADA] })] };
    clock = new Date(NOW.getTime() + MAIL_DEFAULTS.pollIntervalMinutes * MS_PER_MINUTE);

    await poller().tick();

    expect((await storedMailbox()).cursors.INBOX).toEqual({ uidValidity: '2', lastUid: 1 });
    expect(await storedInteractions()).toHaveLength(1);
  });

  it('starts an empty folder after what is there now', async () => {
    mailbox.folders.INBOX.messages = [header(7, { from: [ADA], date: new Date('2020-01-01T00:00:00.000Z') })];

    await poller().tick();

    expect((await storedMailbox()).cursors.INBOX).toEqual({ uidValidity: '1', lastUid: 7 });
    expect(await storedInteractions()).toHaveLength(0);
  });

  it('reads a large folder over several polls', async () => {
    const many = [1, 2, 3, 4, 5].map((uid) => header(uid, { from: [ADA], messageId: `<${uid}@x>` }));
    mailbox.folders.INBOX.messages = many;
    const small = createMailPoller({ db, mail, now: () => clock }, { pageSize: 2, maxPagesPerPoll: 1 });

    await small.tick();
    expect((await storedMailbox()).cursors.INBOX.lastUid).toBe(2);
    clock = new Date(NOW.getTime() + MAIL_DEFAULTS.pollIntervalMinutes * MS_PER_MINUTE);
    await small.tick();

    expect((await storedMailbox()).cursors.INBOX.lastUid).toBe(4);
  });

  it('reads only the inbox on a server that marks no sent folder', async () => {
    mailbox.sentPath = null;
    mailbox.folders.INBOX.messages = [header(1, { from: [ADA] })];

    await poller().tick();

    expect(Object.keys((await storedMailbox()).cursors)).toEqual(['INBOX']);
  });

  it('backs off after a failure, and says so without the cause', async () => {
    mailbox.unreachable = true;

    await poller().tick();
    const first = await storedMailbox();
    clock = first.nextPollAt;
    await poller().tick();
    const second = await storedMailbox();

    expect(first).toMatchObject({ status: MailboxStatus.Failing, failureCount: 1, lastError: UNREACHABLE_MESSAGE });
    expect(first.nextPollAt.getTime()).toBe(NOW.getTime() + MAIL_DEFAULTS.retryBaseMinutes * MS_PER_MINUTE);
    expect(second.failureCount).toBe(2);
    expect(second.nextPollAt.getTime() - clock.getTime()).toBe(2 * MAIL_DEFAULTS.retryBaseMinutes * MS_PER_MINUTE);
  });

  it('does not poll a mailbox before it is due', async () => {
    clock = new Date(NOW.getTime() - 1);

    await poller().tick();

    expect(mailbox.logins).toHaveLength(0);
  });

  it('stops polling a mailbox whose login is refused', async () => {
    mailbox.password = 'changed';

    await poller().tick();
    clock = new Date(NOW.getTime() + MS_PER_DAY);
    await poller().tick();

    expect(await storedMailbox()).toMatchObject({
      status: MailboxStatus.NeedsReconnect,
      lastError: LOGIN_REFUSED_MESSAGE,
    });
    expect(mailbox.logins).toHaveLength(1);
  });

  it('stops polling a mailbox whose password no key opens', async () => {
    mail = { ...mail, keyring: keyringOf(keyEntry('other')) };

    await poller().tick();

    expect(await storedMailbox()).toMatchObject({
      status: MailboxStatus.NeedsReconnect,
      lastError: UNREADABLE_MESSAGE,
    });
    expect(mailbox.logins).toHaveLength(0);
  });

  it('takes no mailbox once stopped', async () => {
    const stopped = poller();
    await stopped.stop();

    await stopped.tick();

    expect(mailbox.logins).toHaveLength(0);
  });
});
