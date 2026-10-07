// Fills the database with a made-up user and their people. Run with `npm run db:seed`.

import { seedImportantDates, seedInteractions, seedNotes, seedTasks } from './seed/activity.ts';
import {
  seedAddresses,
  seedContactInfos,
  seedLabels,
  seedPersonLabels,
  seedPersonRelationships,
  seedPersons,
  seedUser,
} from './seed/people.ts';

console.log('Starting seed...');

const { id: userId } = await seedUser();
const labelData = await seedLabels(userId);
const personData = await seedPersons(userId);
await seedPersonLabels(personData, labelData, userId);
await seedNotes(personData, labelData, userId);
await seedImportantDates(personData, labelData, userId);
await seedInteractions(personData, labelData, userId);
await seedPersonRelationships(personData, userId);
await seedTasks(personData, userId);
await seedContactInfos(personData, userId);
await seedAddresses(personData, userId);

console.log('Seed complete.');
