import * as dbSchema from '@cubicecho/philotes-db/schema';
import type { FeatureSwitch } from '@vantreeseba/drizzle-graphql';
import { getTableColumns, is, Table } from 'drizzle-orm';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import type { Context } from '../../core/context.ts';
import { createSchema, WRITE_HOOKS } from '../../graphql/build-schema.ts';
import { AUTH_TABLES, contextValues, exclude, features, scope, USER_OWNED_TABLES } from '../../graphql/tenancy.ts';
import { writtenRows } from '../../graphql/write-guards.ts';
import { createTestDb } from '../helpers.ts';

const AUTH_TABLE_NAMES = new Set<string>(AUTH_TABLES);
/** The tables the API serves. better-auth's own are excluded from it outright. */
const TABLES = Object.entries(dbSchema)
  .filter(([, value]) => is(value, Table))
  .map(([name]) => name)
  .filter((name) => AUTH_TABLE_NAMES.has(name) === false);

/** A feature switch is a boolean or a per-table predicate. */
const allows = (feature: FeatureSwitch | undefined, table: string) =>
  typeof feature === 'function' ? feature(table) : feature;

// A scope reads nothing but `userId`, so the rest of the context is left out rather than built.
const asContext = (userId: string | null): Context => ({ db: null, userId }) as unknown as Context;

describe('scope', () => {
  it('covers every table in the schema', () => {
    // A table with no scope entry is readable and writable across tenants, so
    // adding one to the schema must fail here until it is scoped.
    expect(TABLES.filter((name) => name in scope === false)).toEqual([]);
  });

  it('names no table the schema does not have', () => {
    expect(Object.keys(scope).filter((name) => TABLES.includes(name) === false)).toEqual([]);
  });

  it('scopes a user-owned table by its own userId', () => {
    const condition = scope.notes?.(asContext('user-1'), dbSchema.notes);
    expect(condition).toBeDefined();
  });

  it('scopes a junction table by its own userId, like any other owned table', () => {
    for (const name of [
      'noteTags',
      'noteMentions',
      'interactionTags',
      'importantDateTags',
      'importantDatePersons',
    ] as const) {
      expect(USER_OWNED_TABLES).toContain(name);
      expect(scope[name]).toBe(scope.notes);
    }
  });

  it('scopes persons through the caller’s user_persons rows', () => {
    expect(scope.persons?.(asContext('user-1'), dbSchema.persons)).toEqual({
      userPersons: { some: { userId: { eq: 'user-1' } } },
    });
  });

  it('refuses to produce a scope for an unauthenticated request', () => {
    // Failing closed matters more here than anywhere else: a scope that
    // resolved to undefined would widen the query to every tenant.
    expect(() => scope.notes?.(asContext(null), dbSchema.notes)).toThrow();
    expect(() => scope.persons?.(asContext(null), dbSchema.persons)).toThrow();
  });
});

describe('contextValues', () => {
  const exportsByName = new Map<string, unknown>(Object.entries(dbSchema));
  const userOwned = TABLES.filter((name) => {
    const table = exportsByName.get(name);
    return is(table, Table) && Object.hasOwn(getTableColumns(table), 'userId');
  });

  it('claims userId on every table that has one', () => {
    // Any table left out would take userId from the client instead.
    expect(userOwned.filter((name) => name in contextValues === false)).toEqual([]);
  });

  it('lists exactly the tables that carry a userId', () => {
    expect([...USER_OWNED_TABLES].sort()).toEqual([...userOwned].sort());
  });

  it('stamps the authenticated user', () => {
    expect(contextValues.notes?.userId?.(asContext('user-1'))).toBe('user-1');
  });

  it('throws rather than stamping null', () => {
    expect(() => contextValues.notes?.userId?.(asContext(null))).toThrow();
  });
});

describe('exclude and features', () => {
  it('keeps nested writes off, so a child table’s hooks cannot be skipped', () => {
    expect(features.nestedWrites).toBe(false);
  });

  it('excludes every auth table', () => {
    expect(exclude.tables).toEqual([...AUTH_TABLES]);
  });

  it('serves no type, field or argument for sessions, credentials, tokens or API key hashes', async () => {
    const { schema } = createSchema(await createTestDb());
    const printed = printSchema(schema);

    // ApiKeyRecord is the hand-written, hash-free view of a key.
    expect(printed).not.toMatch(/\b(Session|Account|Verification|Apikey)s?(\b|[A-Z_])/);
    expect(printed).not.toMatch(/\b(sessions|accounts|verifications|apikeys)\b/);
  });

  it('leaves user rows to the auth flow', () => {
    for (const feature of ['insert', 'update', 'updateMany', 'delete'] as const) {
      expect(allows(features[feature], 'users')).toBe(false);
      expect(allows(features[feature], 'notes')).toBe(true);
    }
  });
});

describe('onWrite', () => {
  it('guards the writes of every table that takes generated ones', () => {
    // A table left out would skip input validation and the check on the rows its foreign keys name.
    const writable = TABLES.filter((name) => allows(features.insert, name));
    expect(writable.filter((name) => name in WRITE_HOOKS === false)).toEqual([]);
  });
});

describe('writtenRows', () => {
  it('reads a single create', () => {
    expect(writtenRows({ values: { noteId: 'n1' } })).toEqual([{ noteId: 'n1' }]);
  });

  it('reads a batch create', () => {
    expect(writtenRows({ values: [{ noteId: 'n1' }, { noteId: 'n2' }] })).toHaveLength(2);
  });

  it('reads an update', () => {
    expect(writtenRows({ set: { noteId: 'n1' } })).toEqual([{ noteId: 'n1' }]);
  });

  it('reads every set of a batch update', () => {
    expect(writtenRows({ updates: [{ set: { noteId: 'n1' } }, { set: { noteId: 'n2' } }] })).toEqual([
      { noteId: 'n1' },
      { noteId: 'n2' },
    ]);
  });

  it('finds nothing to check on a delete', () => {
    expect(writtenRows({})).toEqual([]);
  });
});
