// Every value someone might tune, as plain data. Nothing here computes, reads the environment or imports.

/** Settings for the HTTP doors and the process behind them. */
export interface HttpSettings {
  /** The port to listen on. `PORT` overrides it. */
  port: number;
  /** Largest JSON body /graphql accepts, as `express.json` reads it. Real operations are a few kB. */
  bodyLimit: string;
  /** How long shutdown lets open requests finish before it cuts them. */
  drainSeconds: number;
  /** How long shutdown may take in all before a hard exit. Keep it under Docker's 10 s. */
  shutdownDeadlineSeconds: number;
  /** Express `trust proxy`: which hops may set X-Forwarded-For. False trusts none. `TRUST_PROXY` overrides it. */
  trustProxy: boolean | number | string;
}

/** The HTTP settings as shipped. */
export const HTTP_DEFAULTS: Readonly<HttpSettings> = Object.freeze({
  port: 3000,
  bodyLimit: '1mb',
  drainSeconds: 5,
  shutdownDeadlineSeconds: 8,
  trustProxy: false,
});

/** Where the server keeps the files it writes. */
export interface StorageSettings {
  /** The directory uploaded avatars are kept in. A relative path starts at the repo root. `AVATAR_DIR` overrides it. */
  avatarDir: string;
  /** The bucket avatars are kept in when an S3-compatible store is configured. `S3_BUCKET` overrides it. */
  bucket: string;
  /** The region sent to the S3-compatible store. MinIO accepts any. `S3_REGION` overrides it. */
  region: string;
  /** Whether the bucket goes in the URL's path, not its host. MinIO needs it. `S3_FORCE_PATH_STYLE` overrides it. */
  forcePathStyle: boolean;
}

/** The storage settings as shipped. */
export const STORAGE_DEFAULTS: Readonly<StorageSettings> = Object.freeze({
  avatarDir: 'avatars',
  bucket: 'philotes-avatars',
  region: 'us-east-1',
  forcePathStyle: true,
});

/** The sign-in throttle. */
export interface RateLimitSettings {
  /** Attempts allowed per key inside one window. */
  maxAttempts: number;
  /** How long an attempt counts against its key. */
  windowMinutes: number;
  /** Past this many keys, a hit sweeps out the ones whose window has passed. */
  sweepAtKeys: number;
}

/** The sign-in throttle settings as shipped. */
export const RATE_LIMIT_DEFAULTS: Readonly<RateLimitSettings> = Object.freeze({
  maxAttempts: 10,
  windowMinutes: 15,
  sweepAtKeys: 10_000,
});

/** Sign-in and credential settings. */
export interface AuthSettings {
  /** How long an emailed sign-in link works. */
  magicLinkTtlMinutes: number;
  /** Shortest signing secret production accepts, in characters. */
  minSecretLength: number;
  /** Where better-auth keeps sessions. `SESSION_STORE` overrides it. */
  sessionStore: 'memory' | 'database';
  /** Whether typing an email signs in, with no link. Unsafe on a public network. `SECURE_LOCAL_NET` overrides it. */
  secureLocalNet: boolean;
}

/** The sign-in and credential settings as shipped. */
export const AUTH_DEFAULTS: Readonly<AuthSettings> = Object.freeze({
  magicLinkTtlMinutes: 15,
  minSecretLength: 32,
  sessionStore: 'memory',
  secureLocalNet: false,
});

/** How API keys are shown. */
export interface ApiKeySettings {
  /** How many characters after the prefix are kept readable, so a user can tell keys apart. */
  shownCharacters: number;
}

/** The API key settings as shipped. */
export const API_KEY_DEFAULTS: Readonly<ApiKeySettings> = Object.freeze({
  shownCharacters: 8,
});

/** Bounds on what one GraphQL operation may ask for. */
export interface OperationLimitSettings {
  /** Rows a list returns when the request passes no `limit`. */
  defaultPageSize: number;
  /** Largest `limit` a list accepts. A larger one is refused, not clamped. */
  maxPageSize: number;
  /** Deepest selection nesting an operation may have. */
  maxDepth: number;
  /** Most aliases one operation may use. */
  maxAliases: number;
  /** Highest total cost an operation may have. A list costs its page size times one row. */
  maxCost: number;
  /** Cost of a field that carries no cost hint. */
  defaultFieldCost: number;
}

/** The operation limits as shipped. */
export const OPERATION_LIMIT_DEFAULTS: Readonly<OperationLimitSettings> = Object.freeze({
  defaultPageSize: 50,
  maxPageSize: 500,
  maxDepth: 8,
  maxAliases: 15,
  maxCost: 10_000,
  defaultFieldCost: 1,
});

/** Limits on what a person may hold. */
export interface PersonSettings {
  /** Longest first or last name, in characters. */
  maxNameLength: number;
  /** Longest email address, in characters. */
  maxEmailLength: number;
  /** Longest "how we met", in characters. */
  maxHowWeMetLength: number;
  /** Longest stored avatar path, in characters. */
  maxAvatarPathLength: number;
}

/** The person limits as shipped. */
export const PERSON_DEFAULTS: Readonly<PersonSettings> = Object.freeze({
  maxNameLength: 200,
  maxEmailLength: 320,
  maxHowWeMetLength: 2_000,
  maxAvatarPathLength: 500,
});

/** Limits on the search for duplicate people. */
export interface DuplicateSettings {
  /** Most groups of duplicates one search returns. */
  maxGroups: number;
}

/** The duplicate search limits as shipped. */
export const DUPLICATE_DEFAULTS: Readonly<DuplicateSettings> = Object.freeze({
  maxGroups: 100,
});

/** Limits on what an address may hold. */
export interface AddressSettings {
  /** Longest label, city, state or country, in characters. */
  maxPartLength: number;
  /** Longest street line, in characters. */
  maxLineLength: number;
  /** Longest postal code, in characters. */
  maxPostalCodeLength: number;
}

/** The address limits as shipped. */
export const ADDRESS_DEFAULTS: Readonly<AddressSettings> = Object.freeze({
  maxPartLength: 100,
  maxLineLength: 300,
  maxPostalCodeLength: 20,
});

/** Limits on what a contact detail (phone, handle, URL) may hold. */
export interface ContactInfoSettings {
  /** Longest value, in characters. */
  maxValueLength: number;
  /** Longest label, in characters. */
  maxLabelLength: number;
}

/** The contact detail limits as shipped. */
export const CONTACT_INFO_DEFAULTS: Readonly<ContactInfoSettings> = Object.freeze({
  maxValueLength: 500,
  maxLabelLength: 100,
});

/** Limits on what a note may hold. */
export interface NoteSettings {
  /** Longest body, in characters. */
  maxBodyLength: number;
}

/** The note limits as shipped. */
export const NOTE_DEFAULTS: Readonly<NoteSettings> = Object.freeze({
  maxBodyLength: 20_000,
});

/** Limits on what a gratitude may hold. */
export interface GratitudeSettings {
  /** Longest body, in characters. */
  maxBodyLength: number;
}

/** The gratitude limits as shipped. */
export const GRATITUDE_DEFAULTS: Readonly<GratitudeSettings> = Object.freeze({
  maxBodyLength: 2_000,
});

/** Limits on what an interaction may hold. */
export interface InteractionSettings {
  /** Longest note, in characters. */
  maxNoteLength: number;
}

/** The interaction limits as shipped. */
export const INTERACTION_DEFAULTS: Readonly<InteractionSettings> = Object.freeze({
  maxNoteLength: 10_000,
});

/** Limits on what a task may hold. */
export interface TaskSettings {
  /** Longest title, in characters. */
  maxTitleLength: number;
  /** Longest notes, in characters. */
  maxNotesLength: number;
}

/** The task limits as shipped. */
export const TASK_DEFAULTS: Readonly<TaskSettings> = Object.freeze({
  maxTitleLength: 500,
  maxNotesLength: 10_000,
});

/** Limits on what an important date may hold, and how far ahead they are looked for. */
export interface ImportantDateSettings {
  /** Longest name, in characters. */
  maxNameLength: number;
  /** Longest description, in characters. */
  maxDescriptionLength: number;
  /** How far ahead `upcomingDates` looks when the request passes no `lookaheadDays`, in days. */
  lookaheadDays: number;
}

/** The important date limits and lookahead as shipped. */
export const IMPORTANT_DATE_DEFAULTS: Readonly<ImportantDateSettings> = Object.freeze({
  maxNameLength: 200,
  maxDescriptionLength: 2_000,
  lookaheadDays: 30,
});

/** Limits on what a label may hold. */
export interface LabelSettings {
  /** Longest label text, in characters. */
  maxLabelLength: number;
  /** Longest colour value, in characters. */
  maxColorLength: number;
}

/** The label limits as shipped. */
export const LABEL_DEFAULTS: Readonly<LabelSettings> = Object.freeze({
  maxLabelLength: 100,
  maxColorLength: 32,
});

/** Limits on what a relationship or relationship type may hold. */
export interface RelationshipSettings {
  /** Longest type name, in characters. */
  maxTypeLength: number;
}

/** The relationship limits as shipped. */
export const RELATIONSHIP_DEFAULTS: Readonly<RelationshipSettings> = Object.freeze({
  maxTypeLength: 100,
});
