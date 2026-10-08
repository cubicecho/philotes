import { useApolloClient, useQuery } from '@apollo/client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { PersonRowFragment } from '@/__generated__/graphql';
import { useIsOffline } from '@/lib/connection';
import { PEOPLE_SNAPSHOT, type SyncOptions, syncPeople } from '@/lib/people-sync';

/** What `usePeople` hands back. */
export interface PeopleResult {
  /** Everyone, in no particular order, or undefined until the first load has finished. */
  people: PersonRowFragment[] | undefined;
  /** True while the list is being brought up to date. */
  isRefreshing: boolean;
  /** Why the last refresh failed, when it did. With `people` set, the list is only out of date. */
  error: Error | undefined;
  /** Brings the list up to date now. Resolves either way; a failure lands in `error`. */
  refresh: (options?: SyncOptions) => Promise<void>;
}

const CHANGES_ONLY: SyncOptions = { withLastContact: false };

/**
 * Reads every person the user has. The list comes from the cache, which a device keeps between
 * runs, so it is there at once and with no connection; behind it the hook asks the server what
 * changed, whenever the screen comes to the front and whenever the server comes back.
 *
 * @returns The list, and the state of its refresh.
 */
export function usePeople(): PeopleResult {
  const client = useApolloClient();
  const isOffline = useIsOffline();
  const { data } = useQuery(PEOPLE_SNAPSHOT, { fetchPolicy: 'cache-only' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const refresh = useCallback(
    async (options: SyncOptions = CHANGES_ONLY): Promise<void> => {
      setIsRefreshing(true);
      try {
        await syncPeople(client, options);
        setError(undefined);
      } catch (failure) {
        setError(failure instanceof Error ? failure : new Error(String(failure)));
      } finally {
        setIsRefreshing(false);
      }
    },
    [client],
  );

  useFocusEffect(
    useCallback(() => {
      // Offline, the answer is known; this runs again when the server is back.
      if (isOffline === false) {
        void refresh();
      }
    }, [isOffline, refresh]),
  );

  return { people: data?.peopleSnapshot?.people, isRefreshing, error, refresh };
}
