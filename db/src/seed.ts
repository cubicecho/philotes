import { faker } from '@faker-js/faker';
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
  userPersons,
  users,
} from './schema.ts';

// ── helpers ────────────────────────────────────────────────────────────────

function randomId(): string {
  return crypto.randomUUID();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function randomPastDate(yearsBack: number): Date {
  const now = Date.now();
  const msBack = yearsBack * 365 * 24 * 60 * 60 * 1000;
  return new Date(now - Math.random() * msBack);
}

function randomFutureDate(daysAhead: number): Date {
  const now = Date.now();
  return new Date(now + Math.random() * daysAhead * 24 * 60 * 60 * 1000);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── constants ──────────────────────────────────────────────────────────────

const CONTACT_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

const INTERACTION_CHANNELS = ['call', 'text', 'email', 'in-person', 'other'] as const;

const INTERACTION_SENTIMENTS = ['great', 'good', 'neutral', 'difficult'] as const;

const RECURRENCES = ['yearly', 'monthly', 'weekly'] as const;

const RELATIONSHIP_TYPES = ['friend', 'colleague', 'mentor', 'mentee', 'acquaintance', 'family', 'partner'];

const CONTACT_INFO_TYPES = ['phone', 'mobile', 'linkedin', 'twitter', 'instagram', 'website', 'other'] as const;

const ADDRESS_TYPES = ['home', 'work', 'other'] as const;

const IMPORTANT_DATE_NAMES = [
  'Birthday',
  'Work Anniversary',
  'Wedding Anniversary',
  'Graduation Day',
  'First Met',
  'Promotion Day',
  'Moving Day',
];

// ── seed functions ─────────────────────────────────────────────────────────

async function seedUser() {
  const userData = {
    id: randomId(),
    email: 'demo@philotes.app',
    name: 'Demo User',
  };
  await db.insert(users).values(userData);
  console.log(`Inserted seed user: ${userData.email}`);
  return userData;
}

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

async function seedPersons(userId: string) {
  const usedEmails = new Set<string>();

  const personData = Array.from({ length: 50 }, () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    let email: string;
    let attempt = 0;
    do {
      const suffix = attempt > 0 ? attempt.toString() : '';
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

  // Create user_persons links (with user-specific context)
  const userPersonData = personData.map((p) => ({
    userId,
    personId: p.id,
    contactFrequency: Math.random() > 0.3 ? pickRandom([...CONTACT_FREQUENCIES]) : null,
    howWeMet: Math.random() > 0.5 ? faker.lorem.sentence() : null,
    firstMetDate: Math.random() > 0.5 ? toIsoDate(randomPastDate(10)) : null,
  }));

  await db.insert(userPersons).values(userPersonData);
  console.log(`Inserted ${userPersonData.length} user_persons links`);

  return personData;
}

async function seedPersonLabels(userId: string, personData: { id: string }[], labelData: { id: string }[]) {
  const personLabelData = personData.flatMap((person) => {
    const assignedLabels = pickRandomSubset(labelData, 1, 3);
    return assignedLabels.map((lbl) => ({
      personId: person.id,
      labelId: lbl.id,
      userId,
    }));
  });

  await db.insert(personLabels).values(personLabelData);
  console.log(`Inserted ${personLabelData.length} person-label associations`);
}

async function seedNotes(userId: string, personData: { id: string }[], labelData: { id: string }[]) {
  const noteData: { id: string; body: string; personId: string; userId: string }[] = [];
  const noteTagData: { noteId: string; labelId: string }[] = [];
  const noteMentionData: { noteId: string; mentionedPersonId: string }[] = [];

  for (const person of personData) {
    const noteCount = 2 + Math.floor(Math.random() * 4); // 2–5

    for (let i = 0; i < noteCount; i++) {
      const noteId = randomId();
      noteData.push({
        id: noteId,
        body: faker.lorem.sentences({ min: 1, max: 4 }),
        personId: person.id,
        userId,
      });

      // ~30% chance of a @mention of another person
      if (Math.random() < 0.3) {
        const otherPerson = pickRandom(personData.filter((p) => p.id !== person.id));
        noteMentionData.push({
          noteId,
          mentionedPersonId: otherPerson.id,
        });
      }

      // 0–2 label tags per note
      const tagLabels = pickRandomSubset(labelData, 0, 2);
      for (const lbl of tagLabels) {
        noteTagData.push({ noteId, labelId: lbl.id });
      }
    }
  }

  await db.insert(notes).values(noteData);
  console.log(`Inserted ${noteData.length} notes`);

  if (noteMentionData.length > 0) {
    await db.insert(noteMentions).values(noteMentionData);
    console.log(`Inserted ${noteMentionData.length} note mentions`);
  }

  if (noteTagData.length > 0) {
    await db.insert(noteTags).values(noteTagData);
    console.log(`Inserted ${noteTagData.length} note tags`);
  }
}

async function seedImportantDates(userId: string, personData: { id: string }[], labelData: { id: string }[]) {
  const importantDateData: {
    id: string;
    personId: string;
    userId: string;
    name: string;
    description: string;
    date: string;
    recurrence: (typeof RECURRENCES)[number];
  }[] = [];

  const importantDateTagData: {
    importantDateId: string;
    labelId: string;
  }[] = [];

  for (const person of personData) {
    const dateCount = 1 + Math.floor(Math.random() * 3); // 1–3

    for (let i = 0; i < dateCount; i++) {
      const dateId = randomId();
      const name = pickRandom(IMPORTANT_DATE_NAMES);

      importantDateData.push({
        id: dateId,
        personId: person.id,
        userId,
        name,
        description: faker.lorem.sentence(),
        date: toIsoDate(randomPastDate(30)),
        recurrence: pickRandom([...RECURRENCES]),
      });

      // 0–1 label tag per important date
      if (Math.random() > 0.5) {
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
    await db.insert(importantDateTags).values(importantDateTagData);
    console.log(`Inserted ${importantDateTagData.length} important date tags`);
  }
}

async function seedInteractions(userId: string, personData: { id: string }[], labelData: { id: string }[]) {
  const interactionData: {
    id: string;
    personId: string;
    userId: string;
    occurredAt: Date;
    channel: (typeof INTERACTION_CHANNELS)[number];
    sentiment: (typeof INTERACTION_SENTIMENTS)[number];
    note: string;
  }[] = [];

  const interactionTagData: { interactionId: string; labelId: string }[] = [];

  for (const person of personData) {
    const count = 1 + Math.floor(Math.random() * 4); // 1–4

    for (let i = 0; i < count; i++) {
      const interactionId = randomId();

      interactionData.push({
        id: interactionId,
        personId: person.id,
        userId,
        occurredAt: randomPastDate(2),
        channel: pickRandom([...INTERACTION_CHANNELS]),
        sentiment: pickRandom([...INTERACTION_SENTIMENTS]),
        note: faker.lorem.sentences({ min: 1, max: 3 }),
      });

      // 0–1 label tag per interaction
      if (Math.random() > 0.5) {
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
    await db.insert(interactionTags).values(interactionTagData);
    console.log(`Inserted ${interactionTagData.length} interaction tags`);
  }
}

async function seedPersonRelationships(userId: string, personData: { id: string }[]) {
  const targetCount = 30 + Math.floor(Math.random() * 31); // 30–60
  const usedPairs = new Set<string>();
  const relationshipData: {
    id: string;
    fromPersonId: string;
    toPersonId: string;
    userId: string;
    type: string;
  }[] = [];

  let attempts = 0;
  const maxAttempts = targetCount * 10;

  while (relationshipData.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const from = pickRandom(personData);
    const to = pickRandom(personData);

    if (from.id === to.id) continue;

    const pairKey = `${from.id}:${to.id}`;
    if (usedPairs.has(pairKey)) continue;

    usedPairs.add(pairKey);
    relationshipData.push({
      id: randomId(),
      fromPersonId: from.id,
      toPersonId: to.id,
      userId,
      type: pickRandom(RELATIONSHIP_TYPES),
    });
  }

  await db.insert(personRelationships).values(relationshipData);
  console.log(`Inserted ${relationshipData.length} person relationships`);
}

async function seedTasks(userId: string, personData: { id: string }[]) {
  const taskData: {
    id: string;
    personId: string;
    userId: string;
    title: string;
    notes: string | null;
    dueAt: Date | null;
    completedAt: Date | null;
  }[] = [];

  for (const person of personData) {
    const count = Math.floor(Math.random() * 4); // 0–3

    for (let i = 0; i < count; i++) {
      const isCompleted = Math.random() < 0.4;
      const hasDueDate = Math.random() > 0.3;
      const hasNotes = Math.random() > 0.5;

      taskData.push({
        id: randomId(),
        personId: person.id,
        userId,
        title: faker.company.catchPhrase(),
        notes: hasNotes ? faker.lorem.sentence() : null,
        dueAt: hasDueDate ? randomFutureDate(90) : null,
        completedAt: isCompleted ? randomPastDate(1) : null,
      });
    }
  }

  if (taskData.length === 0) return;

  await db.insert(tasks).values(taskData);
  console.log(`Inserted ${taskData.length} tasks`);
}

async function seedContactInfos(userId: string, personData: { id: string }[]) {
  const contactInfoData: {
    id: string;
    personId: string;
    userId: string;
    type: (typeof CONTACT_INFO_TYPES)[number];
    value: string;
    label: string | null;
    isPrimary: boolean;
  }[] = [];

  for (const person of personData) {
    const count = Math.floor(Math.random() * 3); // 0–2

    for (let i = 0; i < count; i++) {
      const type = pickRandom([...CONTACT_INFO_TYPES]);
      let value: string;

      switch (type) {
        case 'phone':
        case 'mobile':
          value = faker.phone.number();
          break;
        case 'linkedin':
          value = `https://linkedin.com/in/${faker.internet.username()}`;
          break;
        case 'twitter':
          value = `@${faker.internet.username()}`;
          break;
        case 'instagram':
          value = `@${faker.internet.username()}`;
          break;
        case 'website':
          value = faker.internet.url();
          break;
        default:
          value = faker.lorem.word();
      }

      contactInfoData.push({
        id: randomId(),
        personId: person.id,
        userId,
        type,
        value,
        label: Math.random() > 0.6 ? faker.lorem.word() : null,
        isPrimary: i === 0,
      });
    }
  }

  if (contactInfoData.length === 0) return;

  await db.insert(contactInfos).values(contactInfoData);
  console.log(`Inserted ${contactInfoData.length} contact infos`);
}

async function seedAddresses(userId: string, personData: { id: string }[]) {
  const addressData: {
    id: string;
    personId: string;
    userId: string;
    type: (typeof ADDRESS_TYPES)[number];
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isPrimary: boolean;
  }[] = [];

  for (const person of personData) {
    const count = Math.floor(Math.random() * 3); // 0–2

    for (let i = 0; i < count; i++) {
      addressData.push({
        id: randomId(),
        personId: person.id,
        userId,
        type: pickRandom([...ADDRESS_TYPES]),
        label: Math.random() > 0.6 ? faker.lorem.word() : null,
        line1: faker.location.streetAddress(),
        line2: Math.random() > 0.7 ? faker.location.secondaryAddress() : null,
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        isPrimary: i === 0,
      });
    }
  }

  if (addressData.length === 0) return;

  await db.insert(addresses).values(addressData);
  console.log(`Inserted ${addressData.length} addresses`);
}

// ── main ───────────────────────────────────────────────────────────────────

console.log('Starting seed...');

const userData = await seedUser();
const userId = userData.id;
const labelData = await seedLabels(userId);
const personData = await seedPersons(userId);
await seedPersonLabels(userId, personData, labelData);
await seedNotes(userId, personData, labelData);
await seedImportantDates(userId, personData, labelData);
await seedInteractions(userId, personData, labelData);
await seedPersonRelationships(userId, personData);
await seedTasks(userId, personData);
await seedContactInfos(userId, personData);
await seedAddresses(userId, personData);

console.log('Seed complete.');
console.log(`\nDemo user created: ${userData.email}`);
