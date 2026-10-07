import { faker } from '@faker-js/faker';
import { SEED_DEFAULTS as SEED } from '../defaults.ts';
import { db } from '../index.ts';
import type {
  NewImportantDate,
  NewImportantDateTag,
  NewInteraction,
  NewInteractionTag,
  NewNote,
  NewNoteMention,
  NewNoteTag,
  NewTask,
} from '../schema.ts';
import {
  ImportantDateKind,
  InteractionChannel,
  InteractionSentiment,
  importantDates,
  importantDateTags,
  interactions,
  interactionTags,
  noteMentions,
  notes,
  noteTags,
  Recurrence,
  tasks,
} from '../schema.ts';
import {
  chance,
  pickRandom,
  pickRandomSubset,
  randomCount,
  randomFutureDate,
  randomId,
  randomPastDate,
  toIsoDate,
} from './random.ts';

// Seeds what happens with a person over time: notes, important dates, interactions and tasks.

/** The dates a seeded person may have, each with the kind a phone would file it under. */
const SEEDED_IMPORTANT_DATES: Array<{ name: string; kind: ImportantDateKind }> = [
  { name: 'Birthday', kind: ImportantDateKind.Birthday },
  { name: 'Work Anniversary', kind: ImportantDateKind.Other },
  { name: 'Wedding Anniversary', kind: ImportantDateKind.Anniversary },
  { name: 'Graduation Day', kind: ImportantDateKind.Other },
  { name: 'First Met', kind: ImportantDateKind.Other },
  { name: 'Promotion Day', kind: ImportantDateKind.Other },
  { name: 'Moving Day', kind: ImportantDateKind.Other },
];

/**
 * Writes notes about each person. Some mention another person, and some are tagged with labels.
 *
 * @param personData - The seeded persons. A mention needs at least two.
 * @param labelData - The seeded labels.
 * @param userId - The seed user.
 * @returns Resolves once the notes, mentions and tags are in.
 */
export async function seedNotes(personData: { id: string }[], labelData: { id: string }[], userId: string) {
  const noteData: NewNote[] = [];
  const noteTagData: Omit<NewNoteTag, 'userId'>[] = [];
  const noteMentionData: Omit<NewNoteMention, 'userId'>[] = [];

  for (const person of personData) {
    const noteCount = randomCount(SEED.minNotesPerPerson, SEED.maxNotesPerPerson);

    for (let i = 0; i < noteCount; i++) {
      const noteId = randomId();
      noteData.push({
        id: noteId,
        userId,
        body: faker.lorem.sentences({ min: 1, max: 4 }),
        personId: person.id,
      });

      // ~30% chance of a @mention of another person
      if (chance(SEED.noteMentionChance)) {
        const otherPerson = pickRandom(personData.filter((p) => p.id !== person.id));
        noteMentionData.push({
          noteId,
          mentionedPersonId: otherPerson.id,
        });
      }

      // 0–2 label tags per note
      const tagLabels = pickRandomSubset(labelData, 0, SEED.maxTagsPerNote);
      for (const lbl of tagLabels) {
        noteTagData.push({ noteId, labelId: lbl.id });
      }
    }
  }

  await db.insert(notes).values(noteData);
  console.log(`Inserted ${noteData.length} notes`);

  if (noteMentionData.length > 0) {
    await db.insert(noteMentions).values(noteMentionData.map((row) => ({ ...row, userId })));
    console.log(`Inserted ${noteMentionData.length} note mentions`);
  }

  if (noteTagData.length > 0) {
    await db.insert(noteTags).values(noteTagData.map((row) => ({ ...row, userId })));
    console.log(`Inserted ${noteTagData.length} note tags`);
  }
}

/**
 * Gives each person important dates in the past, each with a random recurrence. Some are tagged with a label.
 *
 * @param personData - The seeded persons.
 * @param labelData - The seeded labels.
 * @param userId - The seed user.
 * @returns Resolves once the dates and tags are in.
 */
export async function seedImportantDates(personData: { id: string }[], labelData: { id: string }[], userId: string) {
  const importantDateData: NewImportantDate[] = [];

  const importantDateTagData: Omit<NewImportantDateTag, 'userId'>[] = [];

  for (const person of personData) {
    const dateCount = randomCount(SEED.minDatesPerPerson, SEED.maxDatesPerPerson);

    for (let i = 0; i < dateCount; i++) {
      const dateId = randomId();
      const { name, kind } = pickRandom(SEEDED_IMPORTANT_DATES);

      importantDateData.push({
        id: dateId,
        userId,
        personId: person.id,
        name,
        kind,
        description: faker.lorem.sentence(),
        date: toIsoDate(randomPastDate(SEED.dateWithinPastYears)),
        recurrence: pickRandom(Object.values(Recurrence)),
      });

      // 0–1 label tag per important date
      if (chance(SEED.dateTagChance)) {
        importantDateTagData.push({
          importantDateId: dateId,
          labelId: pickRandom(labelData).id,
        });
      }
    }
  }

  await db.insert(importantDates).values(importantDateData);
  console.log(`Inserted ${importantDateData.length} important dates`);

  if (importantDateTagData.length > 0) {
    await db.insert(importantDateTags).values(importantDateTagData.map((row) => ({ ...row, userId })));
    console.log(`Inserted ${importantDateTagData.length} important date tags`);
  }
}

/**
 * Gives each person past interactions. Some are tagged with a label.
 *
 * @param personData - The seeded persons.
 * @param labelData - The seeded labels.
 * @param userId - The seed user.
 * @returns Resolves once the interactions and tags are in.
 */
export async function seedInteractions(personData: { id: string }[], labelData: { id: string }[], userId: string) {
  const interactionData: NewInteraction[] = [];

  const interactionTagData: Omit<NewInteractionTag, 'userId'>[] = [];

  for (const person of personData) {
    const count = randomCount(SEED.minInteractionsPerPerson, SEED.maxInteractionsPerPerson);

    for (let i = 0; i < count; i++) {
      const interactionId = randomId();

      interactionData.push({
        id: interactionId,
        userId,
        personId: person.id,
        occurredAt: randomPastDate(SEED.interactionWithinPastYears),
        channel: pickRandom(Object.values(InteractionChannel)),
        sentiment: pickRandom(Object.values(InteractionSentiment)),
        note: faker.lorem.sentences({ min: 1, max: 3 }),
      });

      // 0–1 label tag per interaction
      if (chance(SEED.interactionTagChance)) {
        interactionTagData.push({
          interactionId,
          labelId: pickRandom(labelData).id,
        });
      }
    }
  }

  await db.insert(interactions).values(interactionData);
  console.log(`Inserted ${interactionData.length} interactions`);

  if (interactionTagData.length > 0) {
    await db.insert(interactionTags).values(interactionTagData.map((row) => ({ ...row, userId })));
    console.log(`Inserted ${interactionTagData.length} interaction tags`);
  }
}

/**
 * Gives each person tasks. Some are completed, some have a due date and some have notes.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the tasks are in.
 */
export async function seedTasks(personData: { id: string }[], userId: string) {
  const taskData: NewTask[] = [];

  for (const person of personData) {
    const count = randomCount(0, SEED.maxTasksPerPerson);

    for (let i = 0; i < count; i++) {
      const isCompleted = chance(SEED.taskCompletedChance);
      const hasDueDate = chance(SEED.taskDueDateChance);
      const hasNotes = chance(SEED.taskNotesChance);

      taskData.push({
        id: randomId(),
        userId,
        personId: person.id,
        title: faker.company.catchPhrase(),
        notes: hasNotes ? faker.lorem.sentence() : null,
        dueAt: hasDueDate ? randomFutureDate(SEED.taskDueWithinDays) : null,
        completedAt: isCompleted ? randomPastDate(SEED.taskCompletedWithinPastYears) : null,
      });
    }
  }

  if (taskData.length === 0) {
    return;
  }

  await db.insert(tasks).values(taskData);
  console.log(`Inserted ${taskData.length} tasks`);
}
