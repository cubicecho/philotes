import * as dbSchema from '@cubicecho/philotes-db/schema';
import type { FeatureSwitch } from '@vantreeseba/drizzle-graphql';
import { getTableColumns, is, Table } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Context } from '../../core/context.ts';
import { contextValues, exclude, features, scope } from '../../graphql/tenancy.ts';
import { onWrite, writtenRows } from '../../graphql/write-guards.ts';

const TABLES = Object.entries(dbSchema)
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 table type compat
  .filter(([, value]) => is(value as any, Table))
  .map(([name]) => name);

/** A feature switch is a boolean or a per-table predicate. */
const allows = (feature: FeatureSwitch | undefined, table: string) =>
  typeof feature === 'function' ? feature(table) : feature;

const asContext = (userId: string | null): Context => ({ db: null, userId }) as unknown as Context;

// ---------------------------------------------------------------------------
// 1. Row scope coverage
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 2. Server-owned columns
// ---------------------------------------------------------------------------

describe('contextValues', () => {
  const userOwned = TABLES.filter((name) =>
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 table type compat
    Object.hasOwn(getTableColumns((dbSchema as any)[name]), 'userId'),
  );

  it('claims userId on every table that has one', () => {
    // Any table left out would take userId from the client instead.
    expect(userOwned.filter((name) => name in contextValues === false)).toEqual([]);
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

  it('keeps passwordHash out of the schema', () => {
    expect(exclude.columns?.users).toContain('passwordHash');
  });

  it('leaves user rows to the auth flow', () => {
    for (const feature of ['insert', 'update', 'updateMany', 'delete'] as const) {
      expect(allows(features[feature], 'users')).toBe(false);
      expect(allows(features[feature], 'notes')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Foreign-key ownership hooks
// ---------------------------------------------------------------------------

describe('onWrite', () => {
  it('guards every junction table that references another user-owned row', () => {
    expect(Object.keys(onWrite).sort()).toEqual([
      'importantDateTags',
      'interactionTags',
      'noteMentions',
      'noteTags',
      'personLabels',
    ]);
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
