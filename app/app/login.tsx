import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { CenteredLayout } from '@/components/centered-layout';
import { QueryError } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { setToken } from '@/lib/auth';

const AUTH_CONFIG = graphql(`
  query AuthConfig {
    authConfig {
      secureLocalNet
      magicLink
    }
  }
`);

const SIGN_IN = graphql(`
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      token
    }
  }
`);

const SIGN_UP = graphql(`
  mutation SignUp($email: String!, $password: String!, $name: String!) {
    signUp(email: $email, password: $password, name: $name) {
      token
    }
  }
`);

const REQUEST_SIGN_IN = graphql(`
  mutation RequestSignIn($email: String!) {
    requestSignIn(email: $email) {
      sent
      session {
        token
      }
    }
  }
`);

/** Which of the two password forms is showing. */
const Mode = { SignIn: 'signIn', SignUp: 'signUp' } as const;
type Mode = (typeof Mode)[keyof typeof Mode];

/** The words that differ between the two password forms. */
const MODE_COPY: Record<Mode, { title: string; submit: string; submitting: string; other: string }> = {
  [Mode.SignIn]: { title: 'Sign in', submit: 'Sign in', submitting: 'Signing in…', other: 'Create an account' },
  [Mode.SignUp]: {
    title: 'Create an account',
    submit: 'Create account',
    submitting: 'Creating…',
    other: 'I already have an account',
  },
};

/** The form the switch button leads to from each one. */
const OTHER_MODE: Record<Mode, Mode> = {
  [Mode.SignIn]: Mode.SignUp,
  [Mode.SignUp]: Mode.SignIn,
};

const SIGN_IN_FAILED = 'Could not sign in. Try again.';

/**
 * Says why a field is empty, for the form's `onChange` validators.
 *
 * @param message - What to show under the empty field.
 * @returns A validator that returns the message for a blank value.
 */
const required =
  (message: string) =>
  ({ value }: { value: string }) =>
    value.trim() === '' ? message : undefined;

/**
 * Builds the handler that stores a session token and opens the app.
 *
 * @returns A function from token to nothing.
 */
function useOpenSession(): (token: string) => void {
  const router = useRouter();
  return (token) => {
    setToken(token);
    router.replace('/');
  };
}

/**
 * The form for an instance on a private network: an email is all it asks for.
 */
function LocalNetSignIn() {
  const openSession = useOpenSession();
  const [requestSignIn, { error }] = useMutation(REQUEST_SIGN_IN);

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      try {
        const { data } = await requestSignIn({ variables: { email: value.email } });
        const token = data?.requestSignIn.session?.token ?? null;
        if (token !== null) {
          openSession(token);
        }
      } catch {
        // Rendered from `error` below.
      }
    },
  });

  return (
    <CenteredLayout
      className="bg-background"
      level={1}
      title="Sign in"
      description="Enter your email to open your account."
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField name="email" validators={{ onChange: required('Enter your email.') }}>
              {(field) => <field.InputField label="Email" type="email" />}
            </form.AppField>
            {error ? <Text className="text-negative text-sm">{error.message}</Text> : null}
            <form.SubmitButton createLabel="Sign in" savingLabel="Signing in…" />
          </Form>
        </form.AppForm>
      }
    />
  );
}

/**
 * The email and password form, with account creation and, when the instance can send mail, a sign-in link.
 *
 * @param props.offersMagicLink - Whether to offer "email me a sign-in link".
 */
function PasswordSignIn({ offersMagicLink }: { offersMagicLink: boolean }) {
  const openSession = useOpenSession();
  const [mode, setMode] = useState<Mode>(Mode.SignIn);
  // The address a link went to. Null until one has been requested.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [signIn] = useMutation(SIGN_IN);
  const [signUp] = useMutation(SIGN_UP);
  const [requestSignIn, { loading: sendingLink }] = useMutation(REQUEST_SIGN_IN);
  const copy = MODE_COPY[mode];
  const isSignUp = mode === Mode.SignUp;
  const showsMagicLink = offersMagicLink && isSignUp === false;

  const form = useAppForm({
    defaultValues: { email: '', password: '', name: '' },
    onSubmit: async ({ value }) => {
      setFailure(null);
      try {
        const token = isSignUp
          ? (await signUp({ variables: value })).data?.signUp.token
          : (await signIn({ variables: { email: value.email, password: value.password } })).data?.signIn.token;
        if (token !== undefined) {
          openSession(token);
        }
      } catch (error) {
        setFailure(error instanceof Error ? error.message : SIGN_IN_FAILED);
      }
    },
  });

  /** Emails a sign-in link to the address in the form. */
  async function sendLink() {
    const email = form.getFieldValue('email').trim();
    if (email === '') {
      setFailure('Enter your email first.');
      return;
    }
    setFailure(null);
    try {
      await requestSignIn({ variables: { email } });
      setSentTo(email);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : SIGN_IN_FAILED);
    }
  }

  if (sentTo !== null) {
    return (
      <CenteredLayout
        className="bg-background"
        level={1}
        title="Check your email"
        contentSlot={
          <Text className="text-foreground/60 text-sm">
            We sent a sign-in link to <Text className="font-semibold text-foreground">{sentTo}</Text>. It works once,
            for 15 minutes.
          </Text>
        }
        footerActionsSlot={<Button variant="outline" content="Back to sign in" onPress={() => setSentTo(null)} />}
      />
    );
  }

  return (
    <CenteredLayout
      className="bg-background"
      level={1}
      title={copy.title}
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            {isSignUp ? (
              <form.AppField name="name" validators={{ onChange: required('Enter your name.') }}>
                {(field) => <field.InputField label="Name" />}
              </form.AppField>
            ) : null}
            <form.AppField name="email" validators={{ onChange: required('Enter your email.') }}>
              {(field) => <field.InputField label="Email" type="email" />}
            </form.AppField>
            <form.AppField name="password" validators={{ onChange: required('Enter your password.') }}>
              {(field) => <field.InputField label="Password" type="password" />}
            </form.AppField>

            {failure === null ? null : <Text className="text-negative text-sm">{failure}</Text>}

            <form.SubmitButton createLabel={copy.submit} savingLabel={copy.submitting} />
          </Form>
        </form.AppForm>
      }
      footerActionsSlot={
        <View className="flex-row flex-wrap gap-2">
          {showsMagicLink ? (
            <Button
              variant="outline"
              content="Email me a sign-in link"
              loading={sendingLink}
              loadingLabel="Sending…"
              onPress={sendLink}
            />
          ) : null}
          <Button
            variant="outline"
            content={copy.other}
            onPress={() => {
              setFailure(null);
              setMode(OTHER_MODE[mode]);
            }}
          />
        </View>
      }
    />
  );
}

/** The sign-in page, showing only the methods this instance offers. */
export default function LoginPage() {
  const { data, error, refetch } = useQuery(AUTH_CONFIG);

  if (error) {
    return (
      <View role="main" className="min-h-full flex-1 items-center justify-center bg-background p-4">
        <QueryError error={error} onRetry={() => refetch()} what="the sign-in page" />
      </View>
    );
  }
  if (data === undefined) {
    return (
      <View role="main" className="min-h-full flex-1 items-center justify-center bg-background p-4">
        <Spinner label="Loading" />
      </View>
    );
  }
  return data.authConfig.secureLocalNet ? (
    <LocalNetSignIn />
  ) : (
    <PasswordSignIn offersMagicLink={data.authConfig.magicLink} />
  );
}
