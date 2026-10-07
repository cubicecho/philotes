import { describe, expect, it } from 'vitest';
import { type MentionablePerson, parseMentionedPersonIds } from '../lib/mentions';

const people: MentionablePerson[] = [
  { id: 'a', firstName: 'Ada', lastName: 'Lovelace' },
  { id: 'g', firstName: 'Grace', lastName: 'Hopper' },
  { id: 'o', firstName: "O'Neil", lastName: 'Smith-Jones' },
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
    const accented = [{ id: 'j', firstName: 'José', lastName: 'Núñez' }];
    expect(parseMentionedPersonIds('Lunch with @josé núñez.', accented)).toEqual(['j']);
  });

  it('matches names of several words', () => {
    const several = [{ id: 'm', firstName: 'Mary Ann', lastName: 'van der Berg' }];
    expect(parseMentionedPersonIds('Saw @Mary Ann van der Berg, briefly', several)).toEqual(['m']);
  });

  it('does not find a name inside a longer one', () => {
    const short = [{ id: 's', firstName: 'Ada', lastName: 'Love' }];
    expect(parseMentionedPersonIds('@Ada Lovelace', short)).toEqual([]);
  });

  it('needs both names — a first name alone is not a mention', () => {
    expect(parseMentionedPersonIds('@Ada', people)).toEqual([]);
  });
});
