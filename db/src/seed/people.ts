import { faker } from '@faker-js/faker';
import { SEED_DEFAULTS as SEED } from '../defaults.ts';
import { db } from '../index.ts';
import type { NewAddress, NewContactInfo, NewPersonRelationship } from '../schema.ts';
import {
  AddressType,
  addresses,
  ContactType,
  contactInfos,
  labels,
  personLabels,
  personRelationships,
  persons,
  users,
} from '../schema.ts';
import { chance, pickRandom, pickRandomSubset, randomCount, randomId } from './random.ts';

// Seeds the user, their labels and people, and what describes a person: labels, relationships,
// contact details and addresses.

const RELATIONSHIP_TYPES = ['friend', 'colleague', 'mentor', 'mentee', 'acquaintance', 'family', 'partner'];

/** Emails are left out: `seedPersons` gives each person their one email. */
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

/**
 * Inserts the seed user, `seed@philotes.local`.
 *
 * @returns The new user's id, in an object.
 */
export async function seedUser() {
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
export async function seedLabels(userId: string) {
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
 * Inserts fifty made-up persons in the user's contacts, each with one email as their primary contact detail.
 *
 * @param userId - The seed user.
 * @returns The persons inserted.
 */
export async function seedPersons(userId: string) {
  const personData = Array.from({ length: 50 }, () => ({
    id: randomId(),
    userId,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  }));

  await db.insert(persons).values(personData);
  console.log(`Inserted ${personData.length} persons`);

  const emailData: NewContactInfo[] = personData.map((person) => ({
    id: randomId(),
    userId,
    personId: person.id,
    type: ContactType.Email,
    value: faker.internet.email({ firstName: person.firstName, lastName: person.lastName }).toLowerCase(),
    isPrimary: true,
  }));
  await db.insert(contactInfos).values(emailData);
  console.log(`Inserted ${emailData.length} emails`);

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
export async function seedPersonLabels(personData: { id: string }[], labelData: { id: string }[], userId: string) {
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
 * Relates random pairs of persons. No person is paired with themselves, and no ordered pair is used twice.
 * It stops short of the count drawn when ten tries per relationship have not found enough new pairs.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the relationships are in.
 */
export async function seedPersonRelationships(personData: { id: string }[], userId: string) {
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
 * Gives each person contact details of every type but email. Their email stays the primary one.
 *
 * @param personData - The seeded persons.
 * @param userId - The seed user.
 * @returns Resolves once the details are in.
 */
export async function seedContactInfos(personData: { id: string }[], userId: string) {
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
        isPrimary: false,
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
export async function seedAddresses(personData: { id: string }[], userId: string) {
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
