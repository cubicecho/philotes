import { useQuery } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import { DescriptionList, PropertyRow } from '@/components/description-list';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { CopyButton } from '@/components/ui/copy-button';
import { cardDavUrl } from '@/lib/api-url';

const GET_SYNC_ACCOUNT = graphql(`
  query GetSyncAccount {
    user {
      id
      email
    }
  }
`);

/** What stands in for the email while it loads. */
const LOADING = '…';

/**
 * The settings card that says how to point a contacts app at Philotes: the address, the user name, and
 * that the password is an API key.
 */
export function PhoneSyncCard() {
  const { data, error, refetch } = useQuery(GET_SYNC_ACCOUNT);
  const url = cardDavUrl();
  const email = data?.user?.email ?? '';

  return (
    <Section
      surface="card"
      title="Sync with Your Phone"
      description="Philotes is a CardDAV address book. Add it to a contacts app, such as DAVx⁵ on Android, and your people appear in the phone's contacts. Edits made on the phone come back here."
      contentSlot={
        <>
          {error ? <QueryError compact error={error} what="your account" onRetry={() => refetch()} /> : null}
          <DescriptionList
            layout="stacked"
            contentSlot={
              <>
                <PropertyRow
                  label="Server address"
                  value={url}
                  valueClassName="font-mono text-xs"
                  hint={
                    'In DAVx⁵: add an account, choose "Login with URL and user name", and paste this as the base URL.'
                  }
                  actionSlot={<CopyButton value={url} label="Copy server address" />}
                />
                <PropertyRow
                  label="User name"
                  value={email || LOADING}
                  valueClassName="font-mono text-xs"
                  hint="Your email."
                  actionSlot={email ? <CopyButton value={email} label="Copy user name" /> : null}
                />
                <PropertyRow
                  label="Password"
                  value="An API key"
                  hint="Generate a key below with a name such as “Phone”, and use the raw token as the password. Revoking the key stops the phone syncing."
                />
              </>
            }
          />
        </>
      }
    />
  );
}
