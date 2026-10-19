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

/** Where an interaction came from: typed in, or read from the phone's call log, its texts or a mailbox. */
export const InteractionSource = {
  Manual: 'manual',
  CallLog: 'call-log',
  Sms: 'sms',
  Email: 'email',
} as const;
export type InteractionSource = (typeof InteractionSource)[keyof typeof InteractionSource];

/** Which way an interaction went. A missed call is a call that came in and was not answered. */
export const InteractionDirection = {
  Incoming: 'incoming',
  Outgoing: 'outgoing',
  Missed: 'missed',
} as const;
export type InteractionDirection = (typeof InteractionDirection)[keyof typeof InteractionDirection];

/** Where a connected mailbox's polling stands. */
export const MailboxStatus = {
  Active: 'active',
  Failing: 'failing',
  NeedsReconnect: 'needs-reconnect',
} as const;
export type MailboxStatus = (typeof MailboxStatus)[keyof typeof MailboxStatus];

/** How often a user means to be in touch with a person. */
export const ContactFrequency = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
} as const;
export type ContactFrequency = (typeof ContactFrequency)[keyof typeof ContactFrequency];
