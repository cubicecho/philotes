import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq, or } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { objectType } from '../graphql/object-type.ts';

const { persons, personRelationships } = dbSchema;

const extensionSDL = parse(`
  type PersonRelationshipEntry {
    id: String!
    type: String!
    relatedPersonId: String!
    relatedPersonFirstName: String!
    relatedPersonLastName: String!
  }

  extend type Person {
    relationships: [PersonRelationshipEntry!]!
  }
`);

/** The person at the far end of a relationship, seen from `personId`. */
function otherPersonId(
  row: Pick<dbSchema.PersonRelationship, 'fromPersonId' | 'toPersonId'>,
  personId: string,
): string {
  const isOutgoing = row.fromPersonId === personId;
  return isOutgoing ? row.toPersonId : row.fromPersonId;
}

export function applyRelationshipsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, extensionSDL);

  const personType = objectType(extendedSchema, 'Person');
  const personFields = personType.getFields();

  personFields.relationships.resolve = async (parent: { id: string }, _args: unknown, context: Context) => {
    if (!context.userId) {
      return [];
    }
    const dbCtx = context.db;

    const rows = await dbCtx
      .select()
      .from(personRelationships)
      .where(
        and(
          eq(personRelationships.userId, context.userId),
          or(eq(personRelationships.fromPersonId, parent.id), eq(personRelationships.toPersonId, parent.id)),
        ),
      );

    if (rows.length === 0) {
      return [];
    }

    const relatedPersonIds = [...new Set(rows.map((row) => otherPersonId(row, parent.id)))];

    const relatedPersonRows = await dbCtx
      .select({
        id: persons.id,
        firstName: persons.firstName,
        lastName: persons.lastName,
      })
      .from(persons)
      .where(or(...relatedPersonIds.map((pid) => eq(persons.id, pid))));

    const personMap = new Map(relatedPersonRows.map((p) => [p.id, { firstName: p.firstName, lastName: p.lastName }]));

    return rows.flatMap((row) => {
      const relatedId = otherPersonId(row, parent.id);
      const related = personMap.get(relatedId);
      if (!related) {
        return [];
      }
      return [
        {
          id: row.id,
          type: row.type,
          relatedPersonId: relatedId,
          relatedPersonFirstName: related.firstName,
          relatedPersonLastName: related.lastName,
        },
      ];
    });
  };

  return extendedSchema;
}
