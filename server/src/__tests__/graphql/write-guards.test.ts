import * as dbSchema from '@cubicecho/philotes-db/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { NOTE_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

const CREATE_NOTE = 'mutation ($values: CreateNoteInput!) { createNote(values: $values) { id body } }';
const UPDATE_NOTE =
  'mutation ($id: UUID!, $set: UpdateNoteInput!) { updateNote(where: { id: { eq: $id } }, set: $set) { id } }';
const CREATE_TASK = 'mutation ($values: CreateTaskInput!) { createTask(values: $values) { id } }';
const CREATE_INTERACTION = 'mutation ($values: CreateInteractionInput!) { createInteraction(values: $values) { id } }';
const CREATE_NOTE_TAG = 'mutation ($values: CreateNoteTagInput!) { createNoteTag(values: $values) { noteId } }';
const CREATE_PERSON = 'mutation ($values: CreatePersonInput!) { createPerson(values: $values) { id firstName } }';
const UPDATE_PERSON =
  'mutation ($id: UUID!, $set: UpdatePersonInput!) { updatePerson(where: { id: { eq: $id } }, set: $set) { id } }';

describe('generated writes', () => {
  let db: TestDb;
  let owner: TestClient;
  let ownerId: string;
  let ownPersonId: string;
  let strangerPersonId: string;
  let strangerLabelId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = await createUser(db, 'owner@example.com');
    const strangerId = await createUser(db, 'stranger@example.com');
    owner = createClient(db, ownerId);
    ownPersonId = await createPerson(db, ownerId, 'Ada');
    strangerPersonId = await createPerson(db, strangerId, 'Grace');
    const [label] = await db
      .insert(dbSchema.labels)
      .values({ label: 'theirs', color: '#6b7280', userId: strangerId })
      .returning({ id: dbSchema.labels.id });
    strangerLabelId = label.id;
  });

  it('writes a valid row about a person in the caller’s contacts', async () => {
    const data = await owner.expectOk<{ createNote: { body: string } }>(CREATE_NOTE, {
      values: { body: 'Met for coffee', personId: ownPersonId },
    });
    expect(data.createNote.body).toBe('Met for coffee');
  });

  it('refuses an empty note', async () => {
    await owner.expectError(ErrorCode.BadUserInput, CREATE_NOTE, { values: { body: '   ', personId: ownPersonId } });
  });

  it('refuses a note longer than the limit, on update too', async () => {
    const { createNote } = await owner.expectOk<{ createNote: { id: string } }>(CREATE_NOTE, {
      values: { body: 'short' },
    });
    const tooLong = 'x'.repeat(NOTE_DEFAULTS.maxBodyLength + 1);
    await owner.expectError(ErrorCode.BadUserInput, UPDATE_NOTE, { id: createNote.id, set: { body: tooLong } });
  });

  it('refuses a channel outside the vocabulary', async () => {
    await owner.expectError(ErrorCode.BadUserInput, CREATE_INTERACTION, {
      values: { personId: ownPersonId, channel: 'carrier-pigeon' },
    });
  });

  it('reports a person outside the caller’s contacts as not found', async () => {
    await owner.expectError(ErrorCode.NotFound, CREATE_NOTE, { values: { body: 'hi', personId: strangerPersonId } });
    await owner.expectError(ErrorCode.NotFound, CREATE_TASK, { values: { title: 'Call', personId: strangerPersonId } });
  });

  it('reports another user’s label as not found, and writes nothing', async () => {
    const { createNote } = await owner.expectOk<{ createNote: { id: string } }>(CREATE_NOTE, {
      values: { body: 'tag me' },
    });
    await owner.expectError(ErrorCode.NotFound, CREATE_NOTE_TAG, {
      values: { noteId: createNote.id, labelId: strangerLabelId },
    });
    expect(await db.select().from(dbSchema.noteTags)).toEqual([]);
  });

  it('refuses a repeated unique value as bad input, not an internal error', async () => {
    const taken = 'taken@example.com';
    await db.insert(dbSchema.persons).values({ firstName: 'Else', lastName: 'Where', email: taken });
    await owner.expectError(ErrorCode.BadUserInput, UPDATE_PERSON, { id: ownPersonId, set: { email: taken } });
  });
});

describe('createPerson', () => {
  let db: TestDb;
  let owner: TestClient;

  beforeAll(async () => {
    db = await createTestDb();
    owner = createClient(db, await createUser(db, 'owner@example.com'));
  });

  it('trims the name it stores', async () => {
    const data = await owner.expectOk<{ createPerson: { firstName: string } }>(CREATE_PERSON, {
      values: { firstName: '  Ada ', lastName: 'Lovelace' },
    });
    expect(data.createPerson.firstName).toBe('Ada');
  });

  it('refuses an empty name and a malformed email', async () => {
    await owner.expectError(ErrorCode.BadUserInput, CREATE_PERSON, { values: { firstName: ' ', lastName: 'L' } });
    await owner.expectError(ErrorCode.BadUserInput, CREATE_PERSON, {
      values: { firstName: 'A', lastName: 'L', email: 'not-an-email' },
    });
  });

  it('links the existing person when the email is already known', async () => {
    const values = { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' };
    const first = await owner.expectOk<{ createPerson: { id: string } }>(CREATE_PERSON, { values });
    const second = await owner.expectOk<{ createPerson: { id: string } }>(CREATE_PERSON, { values });
    expect(second.createPerson.id).toBe(first.createPerson.id);
  });
});
