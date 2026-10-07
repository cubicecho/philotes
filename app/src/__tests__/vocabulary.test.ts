import * as stored from '@cubicecho/philotes-db/schema';
import { describe, expect, it } from 'vitest';
import { ContactFrequency, InteractionChannel, InteractionSentiment, Recurrence } from '../lib/vocabulary';

describe('the app vocabularies', () => {
  it.each([
    ['Recurrence', Recurrence, stored.Recurrence],
    ['InteractionChannel', InteractionChannel, stored.InteractionChannel],
    ['InteractionSentiment', InteractionSentiment, stored.InteractionSentiment],
    ['ContactFrequency', ContactFrequency, stored.ContactFrequency],
  ])('%s matches what the database stores', (_name, inApp, inDatabase) => {
    expect(inApp).toEqual(inDatabase);
  });
});
