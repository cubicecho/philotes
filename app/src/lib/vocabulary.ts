// The closed sets the API stores as plain text, so the generated GraphQL types carry no enum for them.
// They mirror the vocabularies in the db package's models; `vocabulary.test.ts` fails when the two drift.

/** How an important date repeats. A date with no recurrence happens once. */
export const Recurrence = { Yearly: 'yearly', Monthly: 'monthly', Weekly: 'weekly' } as const;
export type Recurrence = (typeof Recurrence)[keyof typeof Recurrence];

/** How an interaction took place. */
export const InteractionChannel = {
  Call: 'call',
  Text: 'text',
  Email: 'email',
  InPerson: 'in-person',
  Other: 'other',
} as const;
export type InteractionChannel = (typeof InteractionChannel)[keyof typeof InteractionChannel];

/** How an interaction felt. */
export const InteractionSentiment = {
  Great: 'great',
  Good: 'good',
  Neutral: 'neutral',
  Difficult: 'difficult',
} as const;
export type InteractionSentiment = (typeof InteractionSentiment)[keyof typeof InteractionSentiment];

/** How often a user means to be in touch with a person. */
export const ContactFrequency = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
} as const;
export type ContactFrequency = (typeof ContactFrequency)[keyof typeof ContactFrequency];
