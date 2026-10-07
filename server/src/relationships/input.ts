import { z } from 'zod';
import { RELATIONSHIP_DEFAULTS } from '../core/defaults.ts';

const typeName = z
  .string()
  .trim()
  .min(1, 'A relationship type cannot be empty.')
  .max(RELATIONSHIP_DEFAULTS.maxTypeLength, 'The relationship type is too long.');

/** Partial, since an update's `set` carries only the changed columns. */
export const personRelationshipInput = z.object({ type: typeName }).partial();
export const relationshipTypeInput = z.object({ name: typeName }).partial();
