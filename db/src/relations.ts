import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.ts';

export const relations = defineRelations(schema, (r) => ({
  users: {
    userPersons: r.many.userPersons({
      from: r.users.id,
      to: r.userPersons.userId,
    }),
    notes: r.many.notes({
      from: r.users.id,
      to: r.notes.userId,
    }),
    interactions: r.many.interactions({
      from: r.users.id,
      to: r.interactions.userId,
    }),
    tasks: r.many.tasks({
      from: r.users.id,
      to: r.tasks.userId,
    }),
    labels: r.many.labels({
      from: r.users.id,
      to: r.labels.userId,
    }),
    importantDates: r.many.importantDates({
      from: r.users.id,
      to: r.importantDates.userId,
    }),
    personRelationships: r.many.personRelationships({
      from: r.users.id,
      to: r.personRelationships.userId,
    }),
    addresses: r.many.addresses({
      from: r.users.id,
      to: r.addresses.userId,
    }),
    contactInfos: r.many.contactInfos({
      from: r.users.id,
      to: r.contactInfos.userId,
    }),
  },
  userPersons: {
    user: r.one.users({
      from: r.userPersons.userId,
      to: r.users.id,
    }),
    person: r.one.persons({
      from: r.userPersons.personId,
      to: r.persons.id,
    }),
  },
  persons: {
    userPersons: r.many.userPersons({
      from: r.persons.id,
      to: r.userPersons.personId,
    }),
    notes: r.many.notes({
      from: r.persons.id,
      to: r.notes.personId,
      alias: 'personNotes',
    }),
    labels: r.many.labels({
      from: r.persons.id.through(r.personLabels.personId),
      to: r.labels.id.through(r.personLabels.labelId),
    }),
    importantDates: r.many.importantDates({
      from: r.persons.id,
      to: r.importantDates.personId,
    }),
    interactions: r.many.interactions({
      from: r.persons.id,
      to: r.interactions.personId,
    }),
    relationshipsFrom: r.many.personRelationships({
      from: r.persons.id,
      to: r.personRelationships.fromPersonId,
    }),
    relationshipsTo: r.many.personRelationships({
      from: r.persons.id,
      to: r.personRelationships.toPersonId,
    }),
    mentionedInNotes: r.many.notes({
      from: r.persons.id.through(r.noteMentions.mentionedPersonId),
      to: r.notes.id.through(r.noteMentions.noteId),
      alias: 'noteMentions',
    }),
    tasks: r.many.tasks({
      from: r.persons.id,
      to: r.tasks.personId,
    }),
    contactInfos: r.many.contactInfos({
      from: r.persons.id,
      to: r.contactInfos.personId,
    }),
    addresses: r.many.addresses({
      from: r.persons.id,
      to: r.addresses.personId,
    }),
  },
  notes: {
    person: r.one.persons({
      from: r.notes.personId,
      to: r.persons.id,
      alias: 'personNotes',
    }),
    user: r.one.users({
      from: r.notes.userId,
      to: r.users.id,
    }),
    labels: r.many.labels({
      from: r.notes.id.through(r.noteTags.noteId),
      to: r.labels.id.through(r.noteTags.labelId),
    }),
    mentions: r.many.persons({
      from: r.notes.id.through(r.noteMentions.noteId),
      to: r.persons.id.through(r.noteMentions.mentionedPersonId),
      alias: 'noteMentions',
    }),
  },
  importantDates: {
    person: r.one.persons({
      from: r.importantDates.personId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.importantDates.userId,
      to: r.users.id,
    }),
    labels: r.many.labels({
      from: r.importantDates.id.through(r.importantDateTags.importantDateId),
      to: r.labels.id.through(r.importantDateTags.labelId),
    }),
  },
  personRelationships: {
    fromPerson: r.one.persons({
      from: r.personRelationships.fromPersonId,
      to: r.persons.id,
    }),
    toPerson: r.one.persons({
      from: r.personRelationships.toPersonId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.personRelationships.userId,
      to: r.users.id,
    }),
  },
  interactions: {
    person: r.one.persons({
      from: r.interactions.personId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.interactions.userId,
      to: r.users.id,
    }),
    labels: r.many.labels({
      from: r.interactions.id.through(r.interactionTags.interactionId),
      to: r.labels.id.through(r.interactionTags.labelId),
    }),
  },
  labels: {
    user: r.one.users({
      from: r.labels.userId,
      to: r.users.id,
    }),
  },
  tasks: {
    person: r.one.persons({
      from: r.tasks.personId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.tasks.userId,
      to: r.users.id,
    }),
  },
  contactInfos: {
    person: r.one.persons({
      from: r.contactInfos.personId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.contactInfos.userId,
      to: r.users.id,
    }),
  },
  addresses: {
    person: r.one.persons({
      from: r.addresses.personId,
      to: r.persons.id,
    }),
    user: r.one.users({
      from: r.addresses.userId,
      to: r.users.id,
    }),
  },
}));
