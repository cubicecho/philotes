import type { Server } from 'node:http';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpStatus } from '../../core/wire.ts';
import { createApp } from '../../http/app.ts';
import { createPerson, createTestAuth, createTestDb, createUser, portOf } from '../helpers.ts';

describe('/ical', () => {
  let server: Server;
  let baseUrl: string;
  let ownerKey: string;
  let strangerKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const { auth } = createTestAuth(db);
    const ownerId = await createUser(db, 'ical-owner@example.com');
    const strangerId = await createUser(db, 'ical-stranger@example.com');
    const personId = await createPerson(db, ownerId, 'Grace');
    await db
      .insert(dbSchema.importantDates)
      .values({ userId: ownerId, personId, name: 'Birthday', date: '1990-12-09', recurrence: 'yearly' });
    ({ key: ownerKey } = await auth.api.createApiKey({ body: { userId: ownerId, name: 'owner' } }));
    ({ key: strangerKey } = await auth.api.createApiKey({ body: { userId: strangerId, name: 'stranger' } }));

    server = createApp({ db, auth }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${portOf(server)}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves the key owner’s dates as a calendar', async () => {
    const response = await fetch(`${baseUrl}/ical?key=${ownerKey}`);
    const body = await response.text();

    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    expect(body).toContain('SUMMARY:Birthday (Grace Test)');
    expect(body).toContain('RRULE:FREQ=YEARLY');
  });

  it('serves another user’s key none of them', async () => {
    const body = await (await fetch(`${baseUrl}/ical?key=${strangerKey}`)).text();

    expect(body).not.toContain('Birthday');
  });

  it('refuses a request with no key, and a key nobody was issued', async () => {
    const missing = await fetch(`${baseUrl}/ical`);
    const unknown = await fetch(`${baseUrl}/ical?key=phlt_${'x'.repeat(64)}`);

    expect(missing.status).toBe(HttpStatus.BadRequest);
    expect(unknown.status).toBe(HttpStatus.Unauthorized);
  });
});
