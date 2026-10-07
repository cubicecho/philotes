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

/**
 * Finds the person at the far end of a relationship.
 *
 * @param row - The relationship.
 * @param personId - The person it is seen from, who is at one end of it.
 * @returns The id of the person at the other end.
 */
function otherPersonId(
  row: Pick<dbSchema.PersonRelationship, 'fromPersonId' | 'toPersonId'>,
  personId: string,
): string {
  const isOutgoing = row.fromPersonId === personId;
  return isOutgoing ? row.toPersonId : row.fromPersonId;
}

/**
 * Adds `Person.relationships` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the relationships field.
 */
export function applyRelationshipsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, extensionSDL);

  const personType = objectType(extendedSchema, 'Person');
  const personFields = personType.getFields();

  /**
   * Resolves `Person.relationships`. Lists the caller's relationships that have the person at either end.
   * An anonymous caller gets an empty list, not an error.
   *
   * @param parent - The person.
   * @param _args - Unused.
   * @param context - Request context.
   * @returns One entry per relationship, naming the person at the other end.
   */
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
