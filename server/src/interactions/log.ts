import type { DB } from '@cubicecho/philotes-db';
import { normalizeContactValue } from '@cubicecho/philotes-db/normalize';
import {
  ContactType,
  contactInfos,
  InteractionChannel,
  type InteractionDirection,
  InteractionSource,
  interactions,
  type NewInteraction,
} from '@cubicecho/philotes-db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { defaultCountryOf } from '../persons/normalized-values.ts';

// Logging interactions that something read rather than someone typed: a phone's call log and texts,
// and a mailbox. Each event is matched to people on `contact_infos.normalizedValue`, and one interaction
// is written per event and person. The unique key on (user, source, external id, person) is what makes
// a rescan of the same events change nothing.

/** The sources an interaction is logged from, as opposed to typed in. */
export type LoggedSource = Exclude<InteractionSource, typeof InteractionSource.Manual>;

/** One event read from a source. */
export interface LoggedEvent {
  source: LoggedSource;
  /** What the source knows the event by. The same id from the same source is the same event. */
  externalId: string;
  /** The other parties, as the source wrote them: phone numbers, or email addresses. */
  addresses: string[];
  occurredAt: Date;
  direction: InteractionDirection;
  /** How long a call lasted. Left out for anything else. */
  durationSeconds?: number | null;
}

/** What one logging pass did. */
export interface LogResult {
  /** Interactions written by this pass. */
  logged: number;
  /** Interactions an earlier pass had already written for an event and person. */
  alreadyLogged: number;
  /** Events whose addresses matched nobody. They are dropped, not kept. */
  unmatched: number;
}

/** The channel an interaction from each source is shown under. */
const CHANNEL_BY_SOURCE: Readonly<Record<LoggedSource, InteractionChannel>> = {
  [InteractionSource.CallLog]: InteractionChannel.Call,
  [InteractionSource.Sms]: InteractionChannel.Text,
  [InteractionSource.Email]: InteractionChannel.Email,
};

/** The kind of contact detail each source's addresses are, so a number is read as one. */
const CONTACT_TYPE_BY_SOURCE: Readonly<Record<LoggedSource, ContactType>> = {
  [InteractionSource.CallLog]: ContactType.Phone,
  [InteractionSource.Sms]: ContactType.Phone,
  [InteractionSource.Email]: ContactType.Email,
};

/** What a normalized address that holds nothing looks like: a sender such as "GOOGLE" has no digits. */
const EMPTY_ADDRESS = '';

/**
 * Builds the key a contact detail is looked up by: its type and its normalized value.
 *
 * @param type - The kind of detail.
 * @param normalizedValue - The detail's normalized value.
 * @returns The key.
 */
function holderKey(type: ContactType, normalizedValue: string): string {
  return `${type}:${normalizedValue}`;
}

/**
 * Builds the key an interaction is unique by within one user's rows.
 *
 * @param row - The interaction about to be written.
 * @returns The key.
 */
function eventKey(row: NewInteraction): string {
  return `${row.source}\u0000${row.externalId}\u0000${row.personId}`;
}

/**
 * Logs events read from a source as interactions with the people they were with. An event matches each
 * of the user's people who hold one of its addresses as a contact detail of the source's kind, in the
 * form `normalizedValue` keeps it. An event already logged for a person is left as it is, so a source
 * read twice logs nothing the second time.
 *
 * @param db - The database.
 * @param userId - The user whose people the events are matched to, and who owns what is written.
 * @param events - The events, in any order. Repeats are allowed.
 * @returns How many interactions were written, how many were there already, and how many events matched nobody.
 */
export async function logInteractions(db: DB, userId: string, events: LoggedEvent[]): Promise<LogResult> {
  if (events.length === 0) {
    return { logged: 0, alreadyLogged: 0, unmatched: 0 };
  }

  return db.transaction(async (tx) => {
    const country = await defaultCountryOf(tx, userId);
    const keysByEvent = events.map((event) => {
      const type = CONTACT_TYPE_BY_SOURCE[event.source];
      const values = event.addresses.map((address) => normalizeContactValue(type, address, country));
      const keys = values.filter((value) => value !== EMPTY_ADDRESS).map((value) => holderKey(type, value));
      return { type, values, keys: new Set(keys) };
    });

    const values = [...new Set(keysByEvent.flatMap((event) => event.values))].filter(
      (value) => value !== EMPTY_ADDRESS,
    );
    const holders =
      values.length === 0
        ? []
        : await tx
            .select({
              personId: contactInfos.personId,
              type: contactInfos.type,
              normalizedValue: contactInfos.normalizedValue,
            })
            .from(contactInfos)
            .where(and(eq(contactInfos.userId, userId), inArray(contactInfos.normalizedValue, values)));

    const peopleByKey = new Map<string, Set<string>>();
    for (const holder of holders) {
      const key = holderKey(holder.type, holder.normalizedValue);
      const people = peopleByKey.get(key) ?? new Set<string>();
      people.add(holder.personId);
      peopleByKey.set(key, people);
    }

    const rows = new Map<string, NewInteraction>();
    let unmatched = 0;
    events.forEach((event, index) => {
      const people = new Set([...keysByEvent[index].keys].flatMap((key) => [...(peopleByKey.get(key) ?? [])]));
      if (people.size === 0) {
        unmatched += 1;
        return;
      }
      for (const personId of people) {
        const row: NewInteraction = {
          userId,
          personId,
          source: event.source,
          externalId: event.externalId,
          channel: CHANNEL_BY_SOURCE[event.source],
          occurredAt: event.occurredAt,
          direction: event.direction,
          durationSeconds: event.durationSeconds ?? null,
        };
        rows.set(eventKey(row), row);
      }
    });

    if (rows.size === 0) {
      return { logged: 0, alreadyLogged: 0, unmatched };
    }
    const written = await tx
      .insert(interactions)
      .values([...rows.values()])
      .onConflictDoNothing({
        target: [interactions.userId, interactions.source, interactions.externalId, interactions.personId],
      })
      .returning({ id: interactions.id });
    return { logged: written.length, alreadyLogged: rows.size - written.length, unmatched };
  });
}
