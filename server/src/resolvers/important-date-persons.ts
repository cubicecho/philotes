import { schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../routes/graphql.ts';
import { requireAuth } from './auth.ts';

const SDL = parse(`
  extend type Mutation {
    tagPersonOnImportantDate(importantDateId: String!, personId: String!): Boolean!
    untagPersonOnImportantDate(importantDateId: String!, personId: String!): Boolean!
  }
`);

export function applyImportantDatePersonsExtension(schema: GraphQLSchema): GraphQLSchema {
  // drizzle-graphql auto-generates ImportantDate.taggedPersons from the relation.
  // Override its resolver to query via the join table directly.
  const importantDateType = schema.getType('ImportantDate') as GraphQLObjectType;
  const taggedPersonsField = importantDateType?.getFields().taggedPersons;
  if (taggedPersonsField) {
    taggedPersonsField.resolve = async (parent: { id: string }, _args: unknown, ctx: Context) => {
      if (!ctx.userId) return [];
      // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
      const db = ctx.db as any;
      return db
        .select({
          id: dbSchema.persons.id,
          firstName: dbSchema.persons.firstName,
          lastName: dbSchema.persons.lastName,
          email: dbSchema.persons.email,
          createdAt: dbSchema.persons.createdAt,
          updatedAt: dbSchema.persons.updatedAt,
        })
        .from(dbSchema.persons)
        .innerJoin(
          dbSchema.importantDatePersons,
          eq(dbSchema.importantDatePersons.personId, dbSchema.persons.id),
        )
        .where(eq(dbSchema.importantDatePersons.importantDateId, parent.id));
    };
  }

  const extendedSchema = extendSchema(schema, SDL);
  const mutationType = extendedSchema.getType('Mutation') as GraphQLObjectType;
  const mf = mutationType.getFields();

  mf.tagPersonOnImportantDate.resolve = async (
    _parent: unknown,
    args: { importantDateId: string; personId: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const db = ctx.db as any;

    const [date] = await db
      .select({ id: dbSchema.importantDates.id })
      .from(dbSchema.importantDates)
      .where(
        and(
          eq(dbSchema.importantDates.id, args.importantDateId),
          eq(dbSchema.importantDates.userId, userId),
        ),
      );
    if (!date) return false;

    await db
      .insert(dbSchema.importantDatePersons)
      .values({ importantDateId: args.importantDateId, personId: args.personId })
      .onConflictDoNothing();

    return true;
  };

  mf.untagPersonOnImportantDate.resolve = async (
    _parent: unknown,
    args: { importantDateId: string; personId: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const db = ctx.db as any;

    const [date] = await db
      .select({ id: dbSchema.importantDates.id })
      .from(dbSchema.importantDates)
      .where(
        and(
          eq(dbSchema.importantDates.id, args.importantDateId),
          eq(dbSchema.importantDates.userId, userId),
        ),
      );
    if (!date) return false;

    await db
      .delete(dbSchema.importantDatePersons)
      .where(
        and(
          eq(dbSchema.importantDatePersons.importantDateId, args.importantDateId),
          eq(dbSchema.importantDatePersons.personId, args.personId),
        ),
      );

    return true;
  };

  return extendedSchema;
}
