import { db } from './index.ts';
import {
  addresses,
  contactInfos,
  importantDates,
  importantDateTags,
  interactions,
  interactionTags,
  labels,
  noteMentions,
  notes,
  noteTags,
  personLabels,
  personRelationships,
  persons,
  tasks,
} from './schema.ts';

console.log('Starting cleanup...');

// Junction tables first to respect FK constraints, then leaf tables, then roots
await db.delete(interactionTags);
await db.delete(importantDateTags);
await db.delete(noteTags);
await db.delete(noteMentions);
await db.delete(personLabels);
await db.delete(personRelationships);
await db.delete(interactions);
await db.delete(importantDates);
await db.delete(notes);
await db.delete(tasks);
await db.delete(contactInfos);
await db.delete(addresses);
await db.delete(persons);
await db.delete(labels);

console.log('Cleanup complete. All data has been removed.');
