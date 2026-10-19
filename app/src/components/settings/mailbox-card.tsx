import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { MailboxStatus } from '@/lib/vocabulary';

// Connecting a mailbox, whose headers the server reads into email interactions. The server holds the
// app password, sealed; this card only sends it once and never reads it back.

export const MAILBOX_SETUP = graphql(`
  query MailboxSetup {
    mailSyncAvailable
    mailbox {
      id
      host
      port
      username
      address
      status
      lastError
      lastPolledAt
    }
  }
`);

const CONNECT_MAILBOX = graphql(`
  mutation ConnectMailbox($input: ConnectMailboxInput!) {
    connectMailbox(input: $input) {
      id
    }
  }
`);

const DISCONNECT_MAILBOX = graphql(`
  mutation DisconnectMailbox {
    disconnectMailbox
  }
`);

const REFETCH = { refetchQueries: ['MailboxSetup'], awaitRefetchQueries: true };

/** What a failure says when the error carries no message of its own. */
const FAILED = 'Something went wrong. Try again.';

/** What the card says of each state a mailbox can be in. */
const STATUS_TEXT: Readonly<Record<MailboxStatus, string>> = {
  [MailboxStatus.Active]: 'Read every so often.',
  [MailboxStatus.Failing]: 'The last check failed. Philotes will try again.',
  [MailboxStatus.NeedsReconnect]: 'Not being read until it is connected again.',
};

/** Every state, to read the API's string as one. */
const MAILBOX_STATUSES: readonly MailboxStatus[] = Object.values(MailboxStatus);

/** The values the connect form holds. */
interface ConnectValues {
  host: string;
  port: number | null;
  username: string;
  password: string;
  address: string;
}

const EMPTY: ConnectValues = { host: '', port: null, username: '', password: '', address: '' };

/**
 * Says a field is required.
 *
 * @param message - What to say when it is empty.
 * @returns The validator.
 */
const required =
  (message: string) =>
  ({ value }: { value: string }): string | undefined =>
    value.trim() === '' ? message : undefined;

/**
 * The connect form. Shown when no mailbox is connected, and to connect again with a new password.
 *
 * @param props.initial - The fields to start from: the connected mailbox's, when connecting it again.
 */
function ConnectMailboxForm({ initial }: { initial: ConnectValues }) {
  const [connectMailbox] = useMutation(CONNECT_MAILBOX, REFETCH);
  const [failure, setFailure] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      const address = value.address.trim() === '' ? null : value.address.trim();
      try {
        await connectMailbox({
          variables: {
            input: {
              host: value.host.trim(),
              port: value.port,
              username: value.username.trim(),
              password: value.password,
              address,
            },
          },
        });
        formApi.reset();
      } catch (error) {
        setFailure(error instanceof Error ? error.message : FAILED);
      }
    },
  });

  return (
    <form.AppForm>
      <Form className="gap-4">
        {failure === null ? null : <Alert variant="destructive" title="Could not connect" description={failure} />}
        <form.AppField name="host" validators={{ onSubmit: required('Give the mail server.') }}>
          {(field) => (
            <field.InputField
              label="IMAP server"
              placeholder="imap.gmail.com"
              autoCapitalize="none"
              autoCorrect={false}
              description="Philotes connects over TLS, on port 993 unless you say otherwise."
            />
          )}
        </form.AppField>
        <form.AppField name="port">
          {(field) => <field.NumberField label="Port" placeholder="993" integer />}
        </form.AppField>
        <form.AppField name="username" validators={{ onSubmit: required('Give the login.') }}>
          {(field) => (
            <field.InputField
              label="Login"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          )}
        </form.AppField>
        <form.AppField name="password" validators={{ onSubmit: required('Give the app password.') }}>
          {(field) => (
            <field.PasswordField
              label="App password"
              description="Make one for Philotes in your mail account's security settings. Your own password will not work with two-step sign-in, and should not be given out."
            />
          )}
        </form.AppField>
        <form.AppField name="address">
          {(field) => (
            <field.InputField
              label="Your address"
              placeholder="Only when the login is not your email address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </form.AppField>
        <form.SubmitButton createLabel="Connect" savingLabel="Checking the login…" className="self-start" />
      </Form>
    </form.AppForm>
  );
}

/** What the card shows: the connected mailbox, the form, or why there is neither. */
function MailboxSettings() {
  const { data, error, refetch } = useQuery(MAILBOX_SETUP);
  const [disconnectMailbox, { loading }] = useMutation(DISCONNECT_MAILBOX, REFETCH);
  const [failure, setFailure] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  if (data === undefined) {
    return error ? <QueryError compact error={error} what="your mailbox" onRetry={() => refetch()} /> : null;
  }
  if (data.mailSyncAvailable === false) {
    return (
      <Text className="text-foreground/60 text-sm">
        This server is not set up to read mail. Whoever runs it sets MAIL_CREDENTIAL_KEYS.
      </Text>
    );
  }
  const { mailbox } = data;
  if (mailbox === null) {
    return <ConnectMailboxForm initial={EMPTY} />;
  }

  /** Disconnects the mailbox, saying why when it fails. */
  async function disconnect() {
    setFailure(null);
    try {
      await disconnectMailbox();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : FAILED);
    }
  }

  const status = MAILBOX_STATUSES.find((known) => known === mailbox.status) ?? MailboxStatus.Active;
  const needsReconnect = status === MailboxStatus.NeedsReconnect;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <View className="min-w-0 flex-1 basis-48 gap-1">
          <Text className="font-medium text-foreground">{mailbox.address}</Text>
          <Text className="text-foreground/60 text-sm">
            {`${mailbox.host}:${mailbox.port}. ${STATUS_TEXT[status]}`}
          </Text>
        </View>
        <ConfirmButton
          aria-label="Disconnect the mailbox"
          content="Disconnect"
          variant="destructive-outline"
          loading={loading}
          title="Disconnect the mailbox?"
          description="Its saved password is deleted and it is no longer read. Interactions already logged from it stay."
          confirmLabel="Disconnect"
          onConfirm={() => void disconnect()}
        />
      </View>
      {mailbox.lastError ? (
        <Alert variant={needsReconnect ? 'destructive' : 'warning'} title={mailbox.lastError} />
      ) : null}
      {failure === null ? null : <Alert variant="destructive" title="Could not disconnect" description={failure} />}
      {needsReconnect || isReconnecting ? (
        <ConnectMailboxForm
          initial={{ ...EMPTY, host: mailbox.host, port: mailbox.port, username: mailbox.username }}
        />
      ) : (
        <Button
          variant="link"
          size="sm"
          content="Change the app password"
          className="self-start"
          onPress={() => setIsReconnecting(true)}
        />
      )}
    </View>
  );
}

/**
 * Settings' mail card: connecting a mailbox, whose headers the server reads into email interactions. It
 * says what is read and what is not.
 */
export function MailboxCard() {
  return (
    <Section
      surface="card"
      title="Log Email"
      description="Connect your mailbox and Philotes notes each email you exchange with one of your people. Your Philotes server reads only who a message was from and to, and when, from your inbox and sent mail: never the subject or what it says. Addresses that belong to nobody you know are dropped. The app password is kept encrypted on the server."
      contentSlot={<MailboxSettings />}
    />
  );
}
