import * as dbSchema from '@cubicecho/philotes-db/schema';
import { ContactType, InteractionDirection, InteractionSource } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INTERACTION_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { logInteractions } from '../../interactions/log.ts';
import {
  closeTestDb,
  createClient,
  createContactInfo,
  createPerson,
  createTestDb,
  createUser,
  resetTestDb,
  type TestDb,
} from '../helpers.ts';

const LOG = `
  mutation ($entries: [PhoneLogEntryInput!]!) {
    logInteractions(entries: $entries) { logged alreadyLogged unmatched }
  }
`;

/** Ada's mobile as she stored it, and as a phone's call log writes the same number. */
const ADA_STORED = '(555) 010-0123';
const ADA_DIALED = '+1 555-010-0123';
const STRANGER_NUMBER = '+1 555-010-0999';

/** What one call to logInteractions answers. */
interface LogAnswer {
  logInteractions: { logged: number; alreadyLogged: number; unmatched: number };
}

/**
 * Builds one entry a phone would send.
 *
 * @param overrides - The fields that differ from a three-minute outgoing call to Ada.
 * @returns The entry.
 */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: InteractionSource.CallLog,
    externalId: 'call:41:1760000000000',
    address: ADA_DIALED,
    occurredAt: '2026-10-09T08:53:20.000Z',
    direction: InteractionDirection.Outgoing,
    durationSeconds: 180,
    ...overrides,
  };
}

describe('logInteractions', () => {
  let db: TestDb;
  let userId: string;
  let adaId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(db);
    userId = await createUser(db, 'owner@example.com');
    adaId = await createPerson(db, userId, 'Ada');
    await createContactInfo(db, { userId, personId: adaId, type: ContactType.Phone, value: ADA_STORED });
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  /**
   * Reads every interaction of the test user.
   *
   * @returns The rows.
   */
  async function storedInteractions(): Promise<dbSchema.Interaction[]> {
    return db.select().from(dbSchema.interactions).where(eq(dbSchema.interactions.userId, userId));
  }

  it('logs a call against the person whose number it was, however the number was written', async () => {
    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries: [entry()] });

    expect(data.logInteractions).toEqual({ logged: 1, alreadyLogged: 0, unmatched: 0 });
    const [row] = await storedInteractions();
    expect(row).toMatchObject({
      personId: adaId,
      channel: 'call',
      source: InteractionSource.CallLog,
      direction: InteractionDirection.Outgoing,
      durationSeconds: 180,
      externalId: 'call:41:1760000000000',
      note: null,
    });
    expect(row.occurredAt.toISOString()).toBe('2026-10-09T08:53:20.000Z');
  });

  it('logs a text on the text channel, with no duration', async () => {
    const text = entry({
      source: InteractionSource.Sms,
      externalId: 'sms:7:1760000000000',
      direction: InteractionDirection.Incoming,
      durationSeconds: null,
    });

    await createClient(db, userId).expectOk(LOG, { entries: [text] });

    const [row] = await storedInteractions();
    expect(row).toMatchObject({ channel: 'text', source: InteractionSource.Sms, durationSeconds: null });
  });

  it('scanned twice, logs nothing the second time', async () => {
    const client = createClient(db, userId);
    const entries = [entry(), entry({ source: InteractionSource.Sms, externalId: 'sms:7:1', durationSeconds: null })];

    const first = await client.expectOk<LogAnswer>(LOG, { entries });
    const second = await client.expectOk<LogAnswer>(LOG, { entries });

    expect(first.logInteractions).toEqual({ logged: 2, alreadyLogged: 0, unmatched: 0 });
    expect(second.logInteractions).toEqual({ logged: 0, alreadyLogged: 2, unmatched: 0 });
    expect(await storedInteractions()).toHaveLength(2);
  });

  it('logs an event sent twice in one call once', async () => {
    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries: [entry(), entry()] });

    expect(data.logInteractions.logged).toBe(1);
    expect(await storedInteractions()).toHaveLength(1);
  });

  it('keeps a call and a text with the same id apart, since the id belongs to its source', async () => {
    const entries = [entry(), entry({ source: InteractionSource.Sms, durationSeconds: null })];

    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries });

    expect(data.logInteractions.logged).toBe(2);
  });

  it('drops a number nobody holds, and keeps nothing of it', async () => {
    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, {
      entries: [entry({ address: STRANGER_NUMBER })],
    });

    expect(data.logInteractions).toEqual({ logged: 0, alreadyLogged: 0, unmatched: 1 });
    expect(await storedInteractions()).toHaveLength(0);
  });

  it('drops a sender with no digits, such as a service sending texts under a name', async () => {
    await createContactInfo(db, { userId, personId: adaId, type: ContactType.Phone, value: 'ask me' });

    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, {
      entries: [entry({ source: InteractionSource.Sms, address: 'GOOGLE', durationSeconds: null })],
    });

    expect(data.logInteractions.unmatched).toBe(1);
  });

  it('logs a shared number against everyone who holds it', async () => {
    const graceId = await createPerson(db, userId, 'Grace');
    await createContactInfo(db, { userId, personId: graceId, type: ContactType.Phone, value: ADA_DIALED });

    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries: [entry()] });

    expect(data.logInteractions.logged).toBe(2);
    const people = (await storedInteractions()).map((row) => row.personId).sort();
    expect(people).toEqual([adaId, graceId].sort());
  });

  it('matches a number only to phone numbers, not to another kind of detail that spells it', async () => {
    const graceId = await createPerson(db, userId, 'Grace');
    await createContactInfo(db, { userId, personId: graceId, type: ContactType.Other, value: '+15550100123' });

    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries: [entry()] });

    expect(data.logInteractions.logged).toBe(1);
  });

  it("never matches another user's people", async () => {
    const strangerId = await createUser(db, 'stranger@example.com');
    const theirs = await createPerson(db, strangerId, 'Theirs');
    await createContactInfo(db, { userId: strangerId, personId: theirs, type: ContactType.Phone, value: ADA_DIALED });

    await createClient(db, userId).expectOk(LOG, { entries: [entry()] });
    const asStranger = await createClient(db, strangerId).expectOk<LogAnswer>(LOG, {
      entries: [entry({ address: STRANGER_NUMBER })],
    });

    const rows = await storedInteractions();
    expect(rows.map((row) => row.personId)).toEqual([adaId]);
    expect(asStranger.logInteractions.unmatched).toBe(1);
  });

  it('lets two users log the same external id', async () => {
    const otherId = await createUser(db, 'other@example.com');
    const otherAda = await createPerson(db, otherId, 'Ada');
    await createContactInfo(db, { userId: otherId, personId: otherAda, type: ContactType.Phone, value: ADA_STORED });

    await createClient(db, userId).expectOk(LOG, { entries: [entry()] });
    const data = await createClient(db, otherId).expectOk<LogAnswer>(LOG, { entries: [entry()] });

    expect(data.logInteractions.logged).toBe(1);
  });

  it('refuses a caller who is not signed in', async () => {
    await createClient(db, null).expectError(ErrorCode.Unauthenticated, LOG, { entries: [entry()] });
  });

  it.each([
    ['a source the phone does not read', { source: InteractionSource.Email }],
    ['a manual source', { source: InteractionSource.Manual }],
    ['an unknown direction', { direction: 'sideways' }],
    ['a negative duration', { durationSeconds: -1 }],
    ['a duration past a day', { durationSeconds: INTERACTION_DEFAULTS.maxDurationSeconds + 1 }],
    ['an empty external id', { externalId: '  ' }],
    ['an external id that is too long', { externalId: 'x'.repeat(INTERACTION_DEFAULTS.maxExternalIdLength + 1) }],
  ])('refuses %s', async (_name, overrides) => {
    await createClient(db, userId).expectError(ErrorCode.BadUserInput, LOG, { entries: [entry(overrides)] });
    expect(await storedInteractions()).toHaveLength(0);
  });

  it('refuses more entries than one call may carry', async () => {
    const entries = Array.from({ length: INTERACTION_DEFAULTS.maxLoggedPerCall + 1 }, (_, index) =>
      entry({ externalId: `call:${index}` }),
    );

    await createClient(db, userId).expectError(ErrorCode.BadUserInput, LOG, { entries });
  });

  it('answers an empty batch with nothing done', async () => {
    const data = await createClient(db, userId).expectOk<LogAnswer>(LOG, { entries: [] });

    expect(data.logInteractions).toEqual({ logged: 0, alreadyLogged: 0, unmatched: 0 });
  });

  it('logs one email against each person it was with, and none twice', async () => {
    const graceId = await createPerson(db, userId, 'Grace');
    await createContactInfo(db, { userId, personId: graceId, type: ContactType.Email, value: 'grace@example.com' });
    const email = {
      source: InteractionSource.Email,
      externalId: '<abc@mail.example.com>',
      addresses: ['Grace@Example.com', 'nobody@example.com', 'grace@example.com'],
      occurredAt: new Date('2026-10-09T08:53:20.000Z'),
      direction: InteractionDirection.Outgoing,
    };

    const first = await logInteractions(db, userId, [email]);
    const second = await logInteractions(db, userId, [email]);

    expect(first).toEqual({ logged: 1, alreadyLogged: 0, unmatched: 0 });
    expect(second).toEqual({ logged: 0, alreadyLogged: 1, unmatched: 0 });
    const [row] = await storedInteractions();
    expect(row).toMatchObject({ personId: graceId, channel: 'email', source: InteractionSource.Email });
  });
});

describe('interactions typed in', () => {
  let db: TestDb;
  let userId: string;
  let personId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    personId = await createPerson(db, userId, 'Ada');
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  it('are manual, with no external id, and may say which way a call went', async () => {
    const created = await createClient(db, userId).expectOk<{
      createInteraction: { source: string; externalId: string | null; direction: string; durationSeconds: number };
    }>(
      `mutation ($personId: UUID!) {
        createInteraction(values: { personId: $personId, channel: "call", direction: "missed", durationSeconds: 0 }) {
          source externalId direction durationSeconds
        }
      }`,
      { personId },
    );

    expect(created.createInteraction).toEqual({
      source: InteractionSource.Manual,
      externalId: null,
      direction: InteractionDirection.Missed,
      durationSeconds: 0,
    });
  });

  it('cannot claim to come from a phone', async () => {
    const result = await createClient(db, userId).run(
      `mutation ($personId: UUID!) {
        createInteraction(values: { personId: $personId, channel: "call", source: "call-log", externalId: "x" }) { id }
      }`,
      { personId },
    );

    expect(result.errors?.[0].message).toMatch(/source/);
  });
});
