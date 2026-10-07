import { type GraphQLObjectType, type GraphQLSchema, isObjectType } from 'graphql';

/**
 * Finds an object type whose fields are about to get resolvers.
 *
 * @param schema - The extended schema.
 * @param name - The type's name in SDL.
 * @returns The object type.
 * @throws When the schema has no object type of that name, which means the SDL and the code disagree.
 */
export function objectType(schema: GraphQLSchema, name: string): GraphQLObjectType {
  const type = schema.getType(name);
  if (isObjectType(type)) {
    return type;
  }
  throw new Error(`The schema has no object type "${name}". Check the SDL that extends it.`);
}
