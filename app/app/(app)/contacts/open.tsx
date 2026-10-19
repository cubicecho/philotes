import { useApolloClient } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { type ContactResolution, ContactResolutionKind, resolveContactUri } from '@/lib/contact-intent';
import { readRawContactSync, requestContactsPermission } from '@/lib/contacts-native';
import { messageOf } from '@/lib/error-message';

const PERSON_BY_UID = graphql(`
  query PersonByUid($uid: String!) {
    persons(where: { uid: { eq: $uid } }, limit: 1) {
      id
    }
  }
`);

/** What the page says when the contact leads to no person, by why. */
const UNRESOLVED_TEXT: Readonly<
  Record<Exclude<ContactResolution['kind'], typeof ContactResolutionKind.Person>, { title: string; line: string }>
> = Object.freeze({
  [ContactResolutionKind.NotPhilotes]: {
    title: 'Not a Philotes contact',
    line: 'This contact is not in the address book DAVx5 syncs with Philotes, or has not been synced yet.',
  },
  [ContactResolutionKind.NoPerson]: {
    title: 'Person not found',
    line: 'The contact names someone this account does not have. Sync DAVx5 and try again.',
  },
  [ContactResolutionKind.NoModule]: {
    title: 'This build cannot read contacts',
    line: 'The development build was made before Philotes could open contacts. Build it again.',
  },
  [ContactResolutionKind.Denied]: {
    title: 'Contacts permission refused',
    line: 'Philotes needs to read contacts to find the person behind one. Allow it in the system settings.',
  },
});

/**
 * Where "Open contact" in another app lands (`+native-intent.tsx` sends it here, and
 * `useContactIntents` sends an edit here too). It finds the person by the UID sync stored on the
 * raw contact and moves on to their page.
 */
export default function OpenContactPage() {
  const { uri, edit } = useLocalSearchParams<{ uri?: string; edit?: string }>();
  const router = useRouter();
  const client = useApolloClient();
  const [result, setResult] = useState<ContactResolution | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) {
      setResult({ kind: ContactResolutionKind.NotPhilotes });
      return;
    }
    let isCurrent = true;
    const findPersonId = async (uid: string): Promise<string | null> => {
      const { data } = await client.query({ query: PERSON_BY_UID, variables: { uid }, fetchPolicy: 'network-only' });
      return data.persons[0]?.id ?? null;
    };
    resolveContactUri(uri, { readSync: readRawContactSync, requestPermission: requestContactsPermission, findPersonId })
      .then((resolution) => {
        if (isCurrent === false) {
          return;
        }
        if (resolution.kind === ContactResolutionKind.Person) {
          const params = edit ? { id: resolution.personId, edit: '1' } : { id: resolution.personId };
          router.replace({ pathname: '/persons/[id]', params });
          return;
        }
        setResult(resolution);
      })
      .catch((error: unknown) => {
        console.error('The contact could not be opened', error);
        if (isCurrent) {
          setFailure(messageOf(error) ?? 'Something went wrong.');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [uri, edit, client, router]);

  const unresolved = result && result.kind !== ContactResolutionKind.Person ? UNRESOLVED_TEXT[result.kind] : null;
  const isWaiting = unresolved === null && failure === null;

  return (
    <PageLayout
      title="Opening contact"
      contentSlot={
        isWaiting ? (
          <Spinner />
        ) : (
          <EmptyState
            icon={Users}
            level={2}
            title={unresolved?.title ?? 'The contact could not be opened'}
            description={unresolved?.line ?? failure}
            actionSlot={
              <Link href="/persons" asChild>
                <Button variant="outline" content="All people" />
              </Link>
            }
          />
        )
      }
    />
  );
}
