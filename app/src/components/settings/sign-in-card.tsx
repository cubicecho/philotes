import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { SsoSource } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Form } from '@/components/ui/form';

// Pairing the instance with an OIDC provider (heautou, or any that supports Dynamic Client
// Registration) by pasting the setup URL it gives you. The login page's button is `authConfig.sso`,
// so both queries are asked again after a change: neither answer has an id to update in place.

export const SSO_SETUP = graphql(`
  query SsoSetup {
    ssoSetup {
      source
      issuer
      name
      canPair
      redirectUri
    }
  }
`);

const PAIR_SSO = graphql(`
  mutation PairSso($setupUrl: String!) {
    pairSso(setupUrl: $setupUrl) {
      source
      name
    }
  }
`);

const UNPAIR_SSO = graphql(`
  mutation UnpairSso {
    unpairSso {
      source
    }
  }
`);

const REFETCH = { refetchQueries: ['SsoSetup', 'AuthConfig'], awaitRefetchQueries: true };

/** What a provider with no name of its own is called. Matches the server's default. */
const UNNAMED = 'SSO';

/** What a failed pairing says when the error carries no message of its own. */
const PAIR_FAILED = 'Could not pair with the provider. Try again.';

/**
 * The paste-and-connect form. The server decides who may pair; this only asks.
 *
 * @param props.onPaired - Called with the provider's name once it is paired.
 */
export function PairSsoForm({ onPaired }: { onPaired?: ((name: string) => void) | undefined }) {
  const [pairSso] = useMutation(PAIR_SSO, REFETCH);
  const [failure, setFailure] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { setupUrl: '' },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      try {
        const { data } = await pairSso({ variables: { setupUrl: value.setupUrl.trim() } });
        formApi.reset();
        onPaired?.(data?.pairSso.name ?? UNNAMED);
      } catch (error) {
        setFailure(error instanceof Error ? error.message : PAIR_FAILED);
      }
    },
  });

  return (
    <form.AppForm>
      <Form className="gap-4">
        {failure === null ? null : <Alert variant="destructive" title="Could not pair" description={failure} />}
        <form.AppField
          name="setupUrl"
          validators={{ onChange: ({ value }) => (value.trim() === '' ? 'Paste the setup URL.' : undefined) }}
        >
          {(field) => (
            <field.InputField
              label="Setup URL"
              type="url"
              placeholder="https://id.example.com/oidc#setup=…"
              autoCapitalize="none"
              autoCorrect={false}
              description="Your provider's admin makes this for Philotes. It works once, and only for a short while."
            />
          )}
        </form.AppField>
        <form.SubmitButton createLabel="Connect" savingLabel="Connecting…" />
      </Form>
    </form.AppForm>
  );
}

/**
 * Which provider the login page offers, and connecting or disconnecting one. A provider set in the
 * server's environment is shown but cannot be changed here. Settings shows this to the admin only.
 */
function SsoSettings() {
  const { data, error, refetch } = useQuery(SSO_SETUP);
  const [unpairSso, { loading }] = useMutation(UNPAIR_SSO, REFETCH);
  const [failure, setFailure] = useState<string | null>(null);
  const setup = data?.ssoSetup;

  if (setup === undefined) {
    return error ? <QueryError compact error={error} what="the sign-in setup" onRetry={() => refetch()} /> : null;
  }
  if (setup.source === SsoSource.None) {
    return <PairSsoForm />;
  }
  const name = setup.name ?? UNNAMED;

  /** Disconnects the paired provider, saying why when it fails. */
  async function disconnect() {
    setFailure(null);
    try {
      await unpairSso();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not disconnect. Try again.');
    }
  }

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <View className="min-w-0 flex-1 basis-48 gap-1">
          <Text className="font-medium text-foreground">{`Sign in with ${name}`}</Text>
          {setup.source === SsoSource.Env ? (
            <Text className="text-foreground/60 text-sm">
              {`Set by OIDC_ISSUER in the server's environment, so it is changed there. Its redirect URI is ${setup.redirectUri}.`}
            </Text>
          ) : (
            <Text className="text-foreground/60 text-sm">
              {setup.issuer ? `Paired with ${setup.issuer}.` : 'Paired.'}
            </Text>
          )}
        </View>
        {setup.source === SsoSource.Paired ? (
          <ConfirmButton
            aria-label={`Disconnect ${name}`}
            content="Disconnect"
            variant="destructive-outline"
            loading={loading}
            title={`Disconnect ${name}?`}
            description="Its button leaves the login page and Philotes's client is deleted at the provider. Accounts stay, and can still sign in with a password or an emailed link."
            confirmLabel="Disconnect"
            onConfirm={() => void disconnect()}
          />
        ) : null}
      </View>
      {failure === null ? null : <Alert variant="destructive" title="Could not disconnect" description={failure} />}
    </View>
  );
}

/** Settings' sign-in card: pairing the instance with an OpenID Connect provider. */
export function SignInCard() {
  return (
    <Section
      surface="card"
      title="Sign-in"
      description="People can always sign in with a password. An OpenID Connect provider adds a button for it on the login page."
      contentSlot={<SsoSettings />}
    />
  );
}
