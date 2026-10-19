import { describe, expect, it } from 'vitest';
import { PHONE_LOG_DEFAULTS } from '@/lib/defaults';
import {
  AndroidCallType,
  AndroidTextType,
  callEntry,
  type PhoneLogEntry,
  type PhoneLogScanDeps,
  scanPhoneLog,
  textEntry,
} from '@/lib/phone-log';
import { MS_PER_DAY } from '@/lib/time';
import { InteractionDirection, InteractionSource } from '@/lib/vocabulary';
import type { NativeCallRow, NativeTextRow } from '../../modules/phone-log';

const NOW_MS = Date.parse('2026-10-18T12:00:00.000Z');
const CALL_MS = Date.parse('2026-10-17T09:30:00.000Z');

/**
 * Builds a call-log row.
 *
 * @param overrides - What differs from a two-minute incoming call.
 * @returns The row.
 */
function callRow(overrides: Partial<NativeCallRow> = {}): NativeCallRow {
  return {
    id: '41',
    address: '+15550100123',
    dateMs: CALL_MS,
    type: AndroidCallType.Incoming,
    durationSeconds: 120,
    ...overrides,
  };
}

/**
 * Builds a text's row.
 *
 * @param overrides - What differs from a text received.
 * @returns The row.
 */
function textRow(overrides: Partial<NativeTextRow> = {}): NativeTextRow {
  return { id: '7', address: '+15550100123', dateMs: CALL_MS, type: AndroidTextType.Inbox, ...overrides };
}

describe('callEntry', () => {
  it('turns a call into an event with its direction and duration', () => {
    expect(callEntry(callRow())).toEqual({
      source: InteractionSource.CallLog,
      externalId: `41:${CALL_MS}`,
      address: '+15550100123',
      occurredAt: new Date('2026-10-17T09:30:00.000Z'),
      direction: InteractionDirection.Incoming,
      durationSeconds: 120,
    });
  });

  it.each([
    [AndroidCallType.Outgoing, InteractionDirection.Outgoing],
    [AndroidCallType.Missed, InteractionDirection.Missed],
    [AndroidCallType.Voicemail, InteractionDirection.Missed],
    [AndroidCallType.Rejected, InteractionDirection.Missed],
    [AndroidCallType.AnsweredExternally, InteractionDirection.Incoming],
  ])('reads call type %i as %s', (type, direction) => {
    expect(callEntry(callRow({ type }))?.direction).toBe(direction);
  });

  it('leaves out a blocked call, a call from a withheld number and a type Android adds later', () => {
    expect(callEntry(callRow({ type: AndroidCallType.Blocked }))).toBeNull();
    expect(callEntry(callRow({ address: '' }))).toBeNull();
    expect(callEntry(callRow({ type: 99 }))).toBeNull();
  });
});

describe('textEntry', () => {
  it('turns a text into an event with no duration', () => {
    expect(textEntry(textRow({ type: AndroidTextType.Sent }))).toMatchObject({
      source: InteractionSource.Sms,
      externalId: `7:${CALL_MS}`,
      direction: InteractionDirection.Outgoing,
      durationSeconds: null,
    });
  });

  it('leaves out drafts and texts that were never sent', () => {
    for (const type of [
      AndroidTextType.Draft,
      AndroidTextType.Outbox,
      AndroidTextType.Failed,
      AndroidTextType.Queued,
    ]) {
      expect(textEntry(textRow({ type }))).toBeNull();
    }
  });
});

/** A phone's call log in memory, read as the native module reads it. */
function fakeLog(rows: NativeCallRow[]) {
  const reads: number[] = [];
  return {
    reads,
    reader: {
      read: async (sinceMs: number, limit: number) => {
        reads.push(sinceMs);
        return rows.filter((row) => row.dateMs >= sinceMs).slice(0, limit);
      },
      toEntry: callEntry,
    },
  };
}

/** Where a scan sends to and keeps its cursor, in memory. */
function fakeDeps(cursor: number | null = null) {
  const sent: PhoneLogEntry[][] = [];
  const state = { cursor };
  const deps: PhoneLogScanDeps = {
    send: async (entries) => {
      sent.push(entries);
    },
    readCursor: () => state.cursor,
    writeCursor: (sinceMs) => {
      state.cursor = sinceMs;
    },
    now: () => NOW_MS,
  };
  return { deps, sent, state };
}

describe('scanPhoneLog', () => {
  it('starts the first scan the configured number of days back', async () => {
    const { reader, reads } = fakeLog([]);

    await scanPhoneLog(reader, fakeDeps().deps);

    expect(reads).toEqual([NOW_MS - PHONE_LOG_DEFAULTS.firstScanDays * MS_PER_DAY]);
  });

  it('sends what it read and keeps the time of the last row', async () => {
    const { reader } = fakeLog([callRow({ id: '1', dateMs: 100 }), callRow({ id: '2', dateMs: 200 })]);
    const { deps, sent, state } = fakeDeps(0);

    const result = await scanPhoneLog(reader, deps);

    expect(result).toEqual({ read: 2, sent: 2 });
    expect(sent.flat().map((entry) => entry.externalId)).toEqual(['1:100', '2:200']);
    expect(state.cursor).toBe(200);
  });

  it('carries on from where the last scan stopped', async () => {
    const { reader, reads } = fakeLog([callRow({ id: '1', dateMs: 100 }), callRow({ id: '2', dateMs: 300 })]);

    const { deps, sent } = fakeDeps(200);
    await scanPhoneLog(reader, deps);

    expect(reads).toEqual([200]);
    expect(sent.flat().map((entry) => entry.externalId)).toEqual(['2:300']);
  });

  it('reads page after page until one comes back short', async () => {
    const rows = [1, 2, 3, 4, 5].map((n) => callRow({ id: `${n}`, dateMs: n * 100 }));
    const { reader, reads } = fakeLog(rows);
    const { deps, sent } = fakeDeps(0);

    await scanPhoneLog(reader, deps, { pageSize: 2 });

    expect(reads).toEqual([0, 200, 300, 400, 500]);
    // Each page repeats the last row of the one before; the server keeps it once.
    expect(new Set(sent.flat().map((entry) => entry.externalId)).size).toBe(rows.length);
  });

  it('moves past a full page that is all one instant', async () => {
    const rows = [
      callRow({ id: '1', dateMs: 100 }),
      callRow({ id: '2', dateMs: 100 }),
      callRow({ id: '3', dateMs: 150 }),
    ];
    const { reader, reads } = fakeLog(rows);

    await scanPhoneLog(reader, fakeDeps(100).deps, { pageSize: 2 });

    expect(reads).toEqual([100, 101]);
  });

  it('stops after the most pages one scan may read, and the next goes on from there', async () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => callRow({ id: `${n}`, dateMs: n * 100 }));
    const { reader } = fakeLog(rows);
    const { deps, state } = fakeDeps(0);

    await scanPhoneLog(reader, deps, { pageSize: 2, maxPagesPerScan: 1 });

    expect(state.cursor).toBe(200);
  });

  it('does not move the cursor past a page the server refused', async () => {
    const { reader } = fakeLog([callRow({ dateMs: 100 })]);
    const { deps, state } = fakeDeps(0);
    deps.send = async () => {
      throw new Error('offline');
    };

    await expect(scanPhoneLog(reader, deps)).rejects.toThrow('offline');
    expect(state.cursor).toBe(0);
  });

  it('sends nothing for a page of rows that are not events, and still moves on', async () => {
    const { reader } = fakeLog([callRow({ type: AndroidCallType.Blocked, dateMs: 100 })]);
    const { deps, sent, state } = fakeDeps(0);

    const result = await scanPhoneLog(reader, deps);

    expect(result).toEqual({ read: 1, sent: 0 });
    expect(sent).toEqual([]);
    expect(state.cursor).toBe(100);
  });
});
