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
const CREATE_PERSON =
  'mutation ($values: CreatePersonInput!) { createPerson(values: $values) { id firstName displayName sortName uid } }';
const CREATE_PERSONS = 'mutation ($values: [CreatePersonInput!]!) { createPersons(values: $values) { uid } }';
const CLEAR_NAME =
  'mutation ($id: UUID!) { updatePersons(set: { organization: null }, where: { id: { eq: $id } }) { displayName } }';

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
    const [label] = await db
      .insert(dbSchema.labels)
      .values({ label: 'mine', color: '#6b7280', userId: ownerId })
      .returning({ id: dbSchema.labels.id });
    const { createNote } = await owner.expectOk<{ createNote: { id: string } }>(CREATE_NOTE, {
      values: { body: 'tag me twice' },
    });
    const values = { noteId: createNote.id, labelId: label.id };
    await owner.expectOk(CREATE_NOTE_TAG, { values });
    await owner.expectError(ErrorCode.BadUserInput, CREATE_NOTE_TAG, { values });
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

  it('stores a blank name part as nothing', async () => {
    const data = await owner.expectOk<{ createPerson: { firstName: string | null; displayName: string } }>(
      CREATE_PERSON,
      { values: { firstName: ' ', lastName: 'Lovelace' } },
    );
    expect(data.createPerson).toMatchObject({ firstName: null, displayName: 'Lovelace' });
  });

  it('refuses a new person with nothing to be called by', async () => {
    await owner.expectError(ErrorCode.BadUserInput, CREATE_PERSON, {
      values: { firstName: ' ', jobTitle: 'Engineer' },
    });
    await owner.expectError(ErrorCode.BadUserInput, CREATE_PERSON, { values: {} });
  });

  it.each([
    [{ firstName: 'Ada', lastName: 'Lovelace', nickname: 'Countess' }, 'Ada Lovelace', 'lovelace ada'],
    [{ nickname: 'Countess', organization: 'Analytical Engines' }, 'Countess', 'countess'],
    [{ organization: 'Analytical Engines' }, 'Analytical Engines', 'analytical engines'],
  ])('names %j as shown and as sorted', async (values, displayName, sortName) => {
    const data = await owner.expectOk<{ createPerson: object }>(CREATE_PERSON, { values });
    expect(data.createPerson).toMatchObject({ displayName, sortName });
  });

  it('lets an existing person lose their only name', async () => {
    const created = await owner.expectOk<{ createPerson: { id: string } }>(CREATE_PERSON, {
      values: { organization: 'Analytical Engines' },
    });

    const data = await owner.expectOk(CLEAR_NAME, { id: created.createPerson.id });

    expect(data).toEqual({ updatePersons: [{ displayName: '' }] });
  });

  it('gives each new person their own uid, which a client cannot choose', async () => {
    const data = await owner.expectOk<{ createPersons: Array<{ uid: string }> }>(CREATE_PERSONS, {
      values: [{ firstName: 'Grace' }, { firstName: 'Katherine' }],
    });
    const chosen = await owner.run(CREATE_PERSON, { values: { firstName: 'Linus', uid: 'mine' } });
    const named = await owner.run(CREATE_PERSON, { values: { firstName: 'Linus', displayName: 'Someone Else' } });

    const [first, second] = data.createPersons;
    expect(first.uid).not.toBe(second.uid);
    expect(chosen.errors).toBeDefined();
    expect(named.errors).toBeDefined();
  });

  it('makes a new person each time, whatever another one holds', async () => {
    const values = { firstName: 'Grace', lastName: 'Hopper' };
    const first = await owner.expectOk<{ createPerson: { id: string } }>(CREATE_PERSON, { values });
    const second = await owner.expectOk<{ createPerson: { id: string } }>(CREATE_PERSON, { values });
    expect(second.createPerson.id).not.toBe(first.createPerson.id);
  });
});
