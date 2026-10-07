import { describe, expect, it } from 'vitest';
import { type MentionablePerson, parseMentionedPersonIds } from '../lib/mentions';

const people: MentionablePerson[] = [
  { id: 'a', displayName: 'Ada Lovelace' },
  { id: 'g', displayName: 'Grace Hopper' },
  { id: 'o', displayName: "O'Neil Smith-Jones" },
];

describe('parseMentionedPersonIds', () => {
  it('returns nothing for a body without mentions', () => {
    expect(parseMentionedPersonIds('Had coffee, went well.', people)).toEqual([]);
  });

  it('matches a full name after an @', () => {
    expect(parseMentionedPersonIds('Talked to @Ada Lovelace today', people)).toEqual(['a']);
  });

  it('is case-insensitive', () => {
    expect(parseMentionedPersonIds('@ada LOVELACE', people)).toEqual(['a']);
  });

  it('matches apostrophes and hyphens in names', () => {
    expect(parseMentionedPersonIds("@O'Neil Smith-Jones stopped by", people)).toEqual(['o']);
  });

  it('finds several mentions in one body', () => {
    expect(parseMentionedPersonIds('@Ada Lovelace and @Grace Hopper', people)).toEqual(['a', 'g']);
  });

  it('reports a person once however often they are mentioned', () => {
    expect(parseMentionedPersonIds('@Ada Lovelace … @Ada Lovelace', people)).toEqual(['a']);
  });

  it('ignores an @ that matches nobody', () => {
    expect(parseMentionedPersonIds('@Alan Turing', people)).toEqual([]);
  });

  it('matches accented names', () => {
    const accented = [{ id: 'j', displayName: 'José Núñez' }];
    expect(parseMentionedPersonIds('Lunch with @josé núñez.', accented)).toEqual(['j']);
  });

  it('matches names of several words', () => {
    const several = [{ id: 'm', displayName: 'Mary Ann van der Berg' }];
    expect(parseMentionedPersonIds('Saw @Mary Ann van der Berg, briefly', several)).toEqual(['m']);
  });

  it('does not find a name inside a longer one', () => {
    const short = [{ id: 's', displayName: 'Ada Love' }];
    expect(parseMentionedPersonIds('@Ada Lovelace', short)).toEqual([]);
  });

  it('mentions a person by the one name they have', () => {
    const nicknamed = [...people, { id: 'c', displayName: 'Countess' }];
    expect(parseMentionedPersonIds('Tea with @Countess', nicknamed)).toEqual(['c']);
  });

  it('does not find a person in the mention of someone whose name starts with theirs', () => {
    const both = [{ id: 's', displayName: 'Ada' }, ...people];
    expect(parseMentionedPersonIds('@Ada Lovelace', both)).toEqual(['a']);
    expect(parseMentionedPersonIds('@Ada Lovelace and @Ada', both)).toEqual(['s', 'a']);
  });

  it('never mentions a person with no name', () => {
    expect(parseMentionedPersonIds('@ someone', [{ id: 'n', displayName: '' }])).toEqual([]);
  });
});
