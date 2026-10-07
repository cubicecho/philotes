// Every value someone might tune, as plain data. Nothing here computes, reads the environment or imports.

/** Settings for reaching and leaving Postgres. */
export interface DatabaseSettings {
  /** How long boot waits for Postgres before giving up. `DB_CONNECT_TIMEOUT_MS` overrides it. */
  connectTimeoutMs: number;
  /** The wait before the first retry. */
  firstRetryDelayMs: number;
  /** The longest wait between two retries. */
  maxRetryDelayMs: number;
  /** How much the wait grows after each failed attempt. */
  retryBackoffFactor: number;
  /** How long running queries get at shutdown before they are cancelled. */
  closeTimeoutSeconds: number;
}

/** The database settings as shipped. */
export const DATABASE_DEFAULTS: Readonly<DatabaseSettings> = Object.freeze({
  connectTimeoutMs: 60_000,
  firstRetryDelayMs: 500,
  maxRetryDelayMs: 5_000,
  retryBackoffFactor: 2,
  closeTimeoutSeconds: 5,
});

/** What a new account starts with. */
export interface UserSettings {
  /** The country a phone number written without a country code is read as: an ISO 3166-1 alpha-2 code. */
  country: string;
}

/** The account settings as shipped. */
export const USER_DEFAULTS: Readonly<UserSettings> = Object.freeze({
  country: 'US',
});

/** How much the development seed writes, and how often it fills the optional parts. A chance is from 0 to 1. */
export interface SeedSettings {
  /** Fewest labels a person gets. */
  minLabelsPerPerson: number;
  /** Most labels a person gets. */
  maxLabelsPerPerson: number;
  /** Fewest notes a person gets. */
  minNotesPerPerson: number;
  /** Most notes a person gets. */
  maxNotesPerPerson: number;
  /** How often a note mentions another person. */
  noteMentionChance: number;
  /** Most labels a note is tagged with. */
  maxTagsPerNote: number;
  /** Fewest important dates a person gets. */
  minDatesPerPerson: number;
  /** Most important dates a person gets. */
  maxDatesPerPerson: number;
  /** How far back an important date may fall, in years. */
  dateWithinPastYears: number;
  /** How often an important date is tagged with a label. */
  dateTagChance: number;
  /** Fewest interactions a person gets. */
  minInteractionsPerPerson: number;
  /** Most interactions a person gets. */
  maxInteractionsPerPerson: number;
  /** How far back an interaction may fall, in years. */
  interactionWithinPastYears: number;
  /** How often an interaction is tagged with a label. */
  interactionTagChance: number;
  /** Fewest relationships between people, across the whole seed. */
  minRelationships: number;
  /** Most relationships between people, across the whole seed. */
  maxRelationships: number;
  /** Most tasks a person gets. */
  maxTasksPerPerson: number;
  /** How often a task is already completed. */
  taskCompletedChance: number;
  /** How often a task has a due date. */
  taskDueDateChance: number;
  /** How often a task has notes. */
  taskNotesChance: number;
  /** How far ahead a task may be due, in days. */
  taskDueWithinDays: number;
  /** How far back a task may have been completed, in years. */
  taskCompletedWithinPastYears: number;
  /** Most contact details a person gets. */
  maxContactInfosPerPerson: number;
  /** How often a contact detail has a label. */
  contactInfoLabelChance: number;
  /** Most addresses a person gets. */
  maxAddressesPerPerson: number;
  /** How often an address has a label. */
  addressLabelChance: number;
  /** How often an address has a second line. */
  addressSecondLineChance: number;
}

/** The seed settings as shipped. */
export const SEED_DEFAULTS: Readonly<SeedSettings> = Object.freeze({
  minLabelsPerPerson: 1,
  maxLabelsPerPerson: 3,
  minNotesPerPerson: 2,
  maxNotesPerPerson: 5,
  noteMentionChance: 0.3,
  maxTagsPerNote: 2,
  minDatesPerPerson: 1,
  maxDatesPerPerson: 3,
  dateWithinPastYears: 30,
  dateTagChance: 0.5,
  minInteractionsPerPerson: 1,
  maxInteractionsPerPerson: 4,
  interactionWithinPastYears: 2,
  interactionTagChance: 0.5,
  minRelationships: 30,
  maxRelationships: 60,
  maxTasksPerPerson: 3,
  taskCompletedChance: 0.4,
  taskDueDateChance: 0.7,
  taskNotesChance: 0.5,
  taskDueWithinDays: 90,
  taskCompletedWithinPastYears: 1,
  maxContactInfosPerPerson: 2,
  contactInfoLabelChance: 0.4,
  maxAddressesPerPerson: 2,
  addressLabelChance: 0.4,
  addressSecondLineChance: 0.3,
});
