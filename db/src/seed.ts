import { faker } from '@faker-js/faker';
import { SEED_DEFAULTS as SEED } from './defaults.ts';
import { db } from './index.ts';
import type {
  NewAddress,
  NewContactInfo,
  NewImportantDate,
  NewImportantDateTag,
  NewInteraction,
  NewInteractionTag,
  NewNote,
  NewNoteMention,
  NewNoteTag,
  NewPersonRelationship,
  NewTask,
} from './schema.ts';
import {
  AddressType,
  addresses,
  ContactType,
  contactInfos,
  InteractionChannel,
  InteractionSentiment,
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
  Recurrence,
  tasks,
  userPersons,
  users,
} from './schema.ts';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
/** The middle of `Math.random`'s range. Subtracting it gives a sort order that is as often negative as positive. */
const EVEN_ODDS = 0.5;

/**
 * Makes an id for a row.
 *
 * @returns A random UUID.
 */
function randomId(): string {
  return crypto.randomUUID();
}

/**
 * Picks one item at random, each as likely as the next.
 *
 * @typeParam T - The item type.
 * @param arr - The items to pick from. Must hold at least one.
 * @returns The picked item.
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Picks a whole number from `min` to `max`, both included.
 *
 * @param min - The smallest number that can come back.
 * @param max - The largest number that can come back.
 * @returns The number.
 */
function randomCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Answers true `probability` of the time.
 *
 * @param probability - From 0 for never to 1 for always.
 * @returns true on a hit.
 */
function chance(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Picks a random handful of items, in random order.
 *
 * @typeParam T - The item type.
 * @param arr - The items to pick from.
 * @param min - Fewest to pick.
 * @param max - Most to pick.
 * @returns Between `min` and `max` of the items, or all of them when `arr` holds fewer than were drawn.
 */
function pickRandomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = randomCount(min, max);
  const shuffled = [...arr].sort(() => Math.random() - EVEN_ODDS);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Picks a moment in the recent past.
 *
 * @param yearsBack - How far back it may fall, in years of 365 days.
 * @returns A moment between then and now.
 */
function randomPastDate(yearsBack: number): Date {
  const now = Date.now();
  const msBack = yearsBack * DAYS_PER_YEAR * MS_PER_DAY;
  return new Date(now - Math.random() * msBack);
}

/**
 * Picks a moment in the near future.
 *
 * @param daysAhead - How far ahead it may fall, in days.
 * @returns A moment between now and then.
 */
function randomFutureDate(daysAhead: number): Date {
  const now = Date.now();
  return new Date(now + Math.random() * daysAhead * MS_PER_DAY);
}

/**
 * Formats a moment as a calendar date in UTC.
 *
 * @param d - The moment.
 * @returns The date as `YYYY-MM-DD`.
 */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const RELATIONSHIP_TYPES = ['friend', 'colleague', 'mentor', 'mentee', 'acquaintance', 'family', 'partner'];

/** Emails are left out: a seeded person's email is on the person row. */
const SEEDED_CONTACT_TYPES = Object.values(ContactType).filter((type) => type !== ContactType.Email);

/**
 * Makes up a social handle.
 *
 * @returns A username with an `@` in front.
 */
const fakeHandle = () => `@${faker.internet.username()}`;
/**
 * Makes up a word.
 *
 * @returns One lorem ipsum word.
 */
const fakeWord = () => faker.lorem.word();

/** What a made-up contact detail of each type looks like. A type with no entry gets a word. */
const SEEDED_CONTACT_VALUES: Partial<Record<ContactType, () => string>> = {
  [ContactType.Phone]: () => faker.phone.number(),
  [ContactType.Mobile]: () => faker.phone.number(),
  [ContactType.Linkedin]: () => `https://linkedin.com/in/${faker.internet.username()}`,
  [ContactType.Twitter]: fakeHandle,
  [ContactType.Instagram]: fakeHandle,
  [ContactType.Website]: () => faker.internet.url(),
};

const IMPORTANT_DATE_NAMES = [
  'Birthday',
  'Work Anniversary',
  'Wedding Anniversary',
  'Graduation Day',
  'First Met',
  'Promotion Day',
  'Moving Day',
];

/**
 * Inserts the seed user, `seed@philotes.local`.
 *
 * @returns The new user's id, in an object.
 */
async function seedUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: 'seed@philotes.local',
      name: 'Seed User',
    })
    .returning({ id: users.id });
  console.log(`Inserted seed user (id: ${user.id})`);
  return user;
}

/**
 * Inserts the eight seed labels.
 *
 * @param userId - The seed user, who owns them.
 * @returns The labels inserted.
 */
async function seedLabels(userId: string) {
  const labelData = [
    { id: randomId(), userId, color: '#ef4444', label: 'Friend' },
    { id: randomId(), userId, color: '#3b82f6', label: 'Work' },
    { id: randomId(), userId, color: '#22c55e', label: 'Family' },
    { id: randomId(), userId, color: '#a855f7', label: 'College' },
    { id: randomId(), userId, color: '#f97316', label: 'Neighbor' },
    { id: randomId(), userId, color: '#ec4899', label: 'Gym' },
    { id: randomId(), userId, color: '#14b8a6', label: 'Book Club' },
    { id: randomId(), userId, color: '#6366f1', label: 'Tech' },
  ];

  await db.insert(labels).values(labelData);
  console.log(`Inserted ${labelData.length} labels`);
  return labelData;
}

/**
 * Inserts fifty made-up persons, each with an email no other has, and puts them in the user's contacts.
 *
 * @param userId - The seed user.
 * @returns The persons inserted.
 */
async function seedPersons(userId: string) {
  const usedEmails = new Set<string>();

  const personData = Array.from({ length: 50 }, () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    let email: string;
    let attempt = 0;
    do {
      const isRetry = attempt > 0;
      const suffix = isRetry ? attempt.toString() : '';
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${faker.internet.domainName()}`.replace(
        /\s+/g,
        '',
      );
      attempt++;
    } while (usedEmails.has(email));

    usedEmails.add(email);

    return {
      id: randomId(),
      firstName,
      lastName,
      email,
    };
  });

  await db.insert(persons).values(personData);
  console.log(`Inserted ${personData.length} persons`);

  await db.insert(userPersons).values(personData.map((p) => ({ userId, personId: p.id })));
  console.log(`Linked ${personData.length} persons to seed user`);

  return personData;
}

/**
 * Gives each person a random handful of the labels.
 *
 * @param personData - The seeded persons.
 * @param labelData - The seeded labels.
 * @param userId - The seed user.
 * @returns Resolves once the rows are in.
 */
async function seedPersonLabels(personData: { id: string }[], labelData: { id: string }[], userId: string) {
  const personLabelData = personData.flatMap((person) => {
    const assignedLabels = pickRandomSubset(labelData, SEED.minLabelsPerPerson, SEED.maxLabelsPerPerson);
    return assignedLabels.map((lbl) => ({
      userId,
      personId: person.id,
      labelId: lbl.id,
    }));
  });

  await db.insert(personLabels).values(personLabelData);
  console.log(`Inserted ${personLabelData.length} person-label associations`);
}

/**
 * Writes notes about each person. Some mention another person, and some are tagged with labels.
 *
 * @param personData - The seeded persons. A mention needs at least two.
 * @param labelData - The seeded labels.
 * @param userId - The seed user.
 * @returns Resolves once the notes, mentions and tags are in.
 */
async function seedNotes(personData: { id: string }[], labelData: { id: string }[], userId: string) {
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
async function seedImportantDates(personData: { id: string }[], labelData: { id: string }[], userId: string) {
  const importantDateData: NewImportantDate[] = [];

  const importantDateTagData: Omit<NewImportantDateTag, 'userId'>[] = [];

  for (const person of personData) {
    const dateCount = randomCount(SEED.minDatesPerPerson, SEED.maxDatesPerPerson);

    for (let i = 0; i < dateCount; i++) {
      const dateId = randomId();
      const name = pickRandom(IMPORTANT_DATE_NAMES);

      importantDateData.push({
        id: dateId,
        userId,
        personId: person.id,
        name,
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
async function seedInteractions(personData: { id: string }[], labelData: { id: string }[], userId: string) {
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
 * Relates random pairs of persons. No person is paired with themselves, and no ordered pair is used twice.
 * It stops short of the count drawn when ten tries per relationship have not found enough new pairs.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the relationships are in.
 */
async function seedPersonRelationships(personData: { id: string }[], userId: string) {
  const targetCount = randomCount(SEED.minRelationships, SEED.maxRelationships);
  const usedPairs = new Set<string>();
  const relationshipData: NewPersonRelationship[] = [];

  let attempts = 0;
  const maxAttempts = targetCount * 10;

  while (relationshipData.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const from = pickRandom(personData);
    const to = pickRandom(personData);

    const isSelfPair = from.id === to.id;
    if (isSelfPair) {
      continue;
    }

    const pairKey = `${from.id}:${to.id}`;
    if (usedPairs.has(pairKey)) {
      continue;
    }

    usedPairs.add(pairKey);
    relationshipData.push({
      id: randomId(),
      userId,
      fromPersonId: from.id,
      toPersonId: to.id,
      type: pickRandom(RELATIONSHIP_TYPES),
    });
  }

  await db.insert(personRelationships).values(relationshipData);
  console.log(`Inserted ${relationshipData.length} person relationships`);
}

/**
 * Gives each person tasks. Some are completed, some have a due date and some have notes.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the tasks are in.
 */
async function seedTasks(personData: { id: string }[], userId: string) {
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

/**
 * Gives each person contact details of every type but email. A person's first one is the primary.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the details are in.
 */
async function seedContactInfos(personData: { id: string }[], userId: string) {
  const contactInfoData: NewContactInfo[] = [];

  for (const person of personData) {
    const count = randomCount(0, SEED.maxContactInfosPerPerson);

    for (let i = 0; i < count; i++) {
      const type = pickRandom(SEEDED_CONTACT_TYPES);
      const value = (SEEDED_CONTACT_VALUES[type] ?? fakeWord)();

      contactInfoData.push({
        id: randomId(),
        userId,
        personId: person.id,
        type,
        value,
        label: chance(SEED.contactInfoLabelChance) ? faker.lorem.word() : null,
        isPrimary: i === 0,
      });
    }
  }

  if (contactInfoData.length === 0) {
    return;
  }

  await db.insert(contactInfos).values(contactInfoData);
  console.log(`Inserted ${contactInfoData.length} contact infos`);
}

/**
 * Gives each person US addresses. A person's first one is the primary.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the addresses are in.
 */
async function seedAddresses(personData: { id: string }[], userId: string) {
  const addressData: NewAddress[] = [];

  for (const person of personData) {
    const count = randomCount(0, SEED.maxAddressesPerPerson);

    for (let i = 0; i < count; i++) {
      addressData.push({
        id: randomId(),
        userId,
        personId: person.id,
        type: pickRandom(Object.values(AddressType)),
        label: chance(SEED.addressLabelChance) ? faker.lorem.word() : null,
        line1: faker.location.streetAddress(),
        line2: chance(SEED.addressSecondLineChance) ? faker.location.secondaryAddress() : null,
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        isPrimary: i === 0,
      });
    }
  }

  if (addressData.length === 0) {
    return;
  }

  await db.insert(addresses).values(addressData);
  console.log(`Inserted ${addressData.length} addresses`);
}

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
