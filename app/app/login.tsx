import { useMutation, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { SsoSource } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { CenteredLayout } from '@/components/centered-layout';
import { QueryError } from '@/components/query-state';
import { PairSsoForm, SSO_SETUP } from '@/components/settings/sign-in-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { apiUrl, normalizeServerUrl } from '@/lib/api-url';
import { forgetCachedData } from '@/lib/apollo';
import { clearToken, setToken } from '@/lib/auth';
import { CAN_CHOOSE_SERVER, hasServerAddress, saveServerAddress } from '@/lib/server-address';

const AUTH_CONFIG = graphql(`
  query AuthConfig {
    authConfig {
      secureLocalNet
      magicLink
      sso {
        name
        signInUrl
      }
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

/** What `?error=` says when the provider's button was followed after it was disconnected. */
const SSO_OFF = 'sso_off';

/**
 * Whether the provider's button is offered. Its sign-in ends on the web app's `/auth/sso`, which a device
 * build cannot be sent back to, so a device signs in another way.
 */
const OFFERS_SSO = Platform.OS === 'web';

/** The provider a sign-in form offers, and what a sign-in through it that came back here said. */
interface SsoProps {
  /** The provider, or null for none. */
  sso: { name: string; signInUrl: string } | null;
  /** The `?error=` a failed provider sign-in came back with, if any. */
  ssoError?: string | undefined;
  /** The provider just paired from this page, to say so. */
  paired?: string | null | undefined;
}

/**
 * The provider's button, above a sign-in form, and what a provider sign-in that came back here said.
 *
 * @param props.sso - The provider, or null for none.
 * @param props.ssoError - The `?error=` a failed provider sign-in came back with.
 * @param props.paired - The provider just paired from this page.
 * @param props.children - The form it sits above.
 */
function WithSso({ sso, ssoError, paired, children }: SsoProps & { children: ReactNode }) {
  const offered = OFFERS_SSO ? sso : null;
  return (
    <View className="gap-4">
      {paired ? (
        <Alert
          variant="info"
          title={`Paired with ${paired}`}
          description="Sign in with it below. The first account to sign in runs this instance."
        />
      ) : null}
      {ssoError === SSO_OFF ? (
        <Alert
          variant="warning"
          title="That sign-in button is gone"
          description="This instance no longer signs in through a provider. Sign in another way."
        />
      ) : ssoError ? (
        <Alert
          variant="destructive"
          title={sso ? `Signing in with ${sso.name} didn't work` : "Signing in didn't work"}
          description={`The provider answered ${ssoError}. Try again, or ask whoever runs this instance.`}
        />
      ) : null}
      {offered ? (
        <>
          {/* An external link, so a full page load: the server sends the browser on to the provider. */}
          <Button content={`Sign in with ${offered.name}`} linkSlot={<Link href={offered.signInUrl} />} />
          <Text className="text-center text-foreground/60 text-sm">or</Text>
        </>
      ) : null}
      {children}
    </View>
  );
}

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

/** What a sign-in form is told about the server it signs in to. */
interface ServerChoiceProps {
  /** Opens the server address form. Left out where the server is not the user's to choose. */
  onChangeServer?: (() => void) | undefined;
}

/**
 * The button under a sign-in form that leads back to the server address.
 *
 * @param props.onChangeServer - Opens the server address form.
 */
function ChangeServerButton({ onChangeServer }: { onChangeServer: () => void }) {
  return <Button variant="ghost" content="Change server" onPress={onChangeServer} />;
}

/**
 * Asks a device which server to sign in to. The web app never shows it: its server is the one that served it.
 *
 * @param props.onSaved - Called once the address is stored and requests go to it.
 */
function ServerAddressForm({ onSaved }: { onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: { address: apiUrl() },
    onSubmit: async ({ value }) => {
      const url = normalizeServerUrl(value.address);
      if (url === null) {
        return;
      }
      // A session and a cache belong to the server they came from.
      clearToken();
      await forgetCachedData();
      saveServerAddress(url);
      onSaved();
    },
  });

  return (
    <CenteredLayout
      className="bg-background"
      level={1}
      title="Connect to your server"
      description="Enter the address of your Philotes server, as you open it in a browser."
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField
              name="address"
              validators={{
                onChange: ({ value }) =>
                  normalizeServerUrl(value) === null ? 'Enter an address, such as philotes.example.com.' : undefined,
              }}
            >
              {(field) => (
                <field.InputField
                  label="Server address"
                  type="url"
                  placeholder="https://philotes.example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            </form.AppField>
            <form.SubmitButton createLabel="Continue" savingLabel="Connecting…" />
          </Form>
        </form.AppForm>
      }
    />
  );
}

/**
 * The form for an instance on a private network: an email is all it asks for.
 *
 * @param props.onChangeServer - Opens the server address form, where there is one.
 */
function LocalNetSignIn({ onChangeServer, setUpSlot, ...sso }: ServerChoiceProps & SsoProps & SetUpProps) {
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
        <WithSso {...sso}>
          <form.AppForm>
            <Form className="gap-4">
              <form.AppField name="email" validators={{ onChange: required('Enter your email.') }}>
                {(field) => <field.InputField label="Email" type="email" />}
              </form.AppField>
              {error ? <Text className="text-negative text-sm">{error.message}</Text> : null}
              <form.SubmitButton createLabel="Sign in" savingLabel="Signing in…" />
            </Form>
          </form.AppForm>
        </WithSso>
      }
      footerActionsSlot={
        <View className="flex-row flex-wrap gap-2">
          {setUpSlot}
          {onChangeServer ? <ChangeServerButton onChangeServer={onChangeServer} /> : null}
        </View>
      }
    />
  );
}

/**
 * The email and password form, with account creation and, when the instance can send mail, a sign-in link.
 *
 * @param props.offersMagicLink - Whether to offer "email me a sign-in link".
 * @param props.onChangeServer - Opens the server address form, where there is one.
 */
function PasswordSignIn({
  offersMagicLink,
  onChangeServer,
  setUpSlot,
  ...sso
}: ServerChoiceProps & SsoProps & SetUpProps & { offersMagicLink: boolean }) {
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
        <WithSso {...sso}>
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
        </WithSso>
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
          {setUpSlot}
          {onChangeServer ? <ChangeServerButton onChangeServer={onChangeServer} /> : null}
        </View>
      }
    />
  );
}

/** What a sign-in form is given to lead to pairing a provider, on an instance where that is offered. */
interface SetUpProps {
  /** The button that opens the pairing form, or nothing. */
  setUpSlot?: ReactNode;
}

/**
 * Pairing a provider from the login page, which a new instance offers before anyone has signed up.
 *
 * @param props.onPaired - Called with the provider's name once it is paired.
 * @param props.onCancel - Goes back to signing in.
 */
function SetUpSignIn({ onPaired, onCancel }: { onPaired: (name: string) => void; onCancel: () => void }) {
  return (
    <CenteredLayout
      className="bg-background"
      level={1}
      title="Set up sign-in"
      description="Pair Philotes with an OpenID Connect provider, such as heautou, and its button joins the sign-in page. Paste the setup URL its admin made for Philotes."
      contentSlot={<PairSsoForm onPaired={onPaired} />}
      footerActionsSlot={<Button variant="outline" content="Back to sign in" onPress={onCancel} />}
    />
  );
}

/** The sign-in page, showing only the methods this instance offers. A device is first asked for its server. */
export default function LoginPage() {
  const [isChoosingServer, setIsChoosingServer] = useState(() => hasServerAddress() === false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [paired, setPaired] = useState<string | null>(null);
  const { error: ssoError } = useLocalSearchParams<{ error?: string }>();
  const { data, error, refetch } = useQuery(AUTH_CONFIG, { skip: isChoosingServer });
  const setup = useQuery(SSO_SETUP, { skip: isChoosingServer || OFFERS_SSO === false }).data?.ssoSetup;
  const onChangeServer = CAN_CHOOSE_SERVER ? () => setIsChoosingServer(true) : undefined;
  // A new instance, nobody signed up and no provider yet: whoever installed it may pair one from here.
  const offersSetUp = setup?.canPair === true && setup.source === SsoSource.None;

  if (isChoosingServer) {
    return <ServerAddressForm onSaved={() => setIsChoosingServer(false)} />;
  }
  if (isSettingUp && offersSetUp) {
    return (
      <SetUpSignIn
        onPaired={(name) => {
          setPaired(name);
          setIsSettingUp(false);
        }}
        onCancel={() => setIsSettingUp(false)}
      />
    );
  }
  if (error) {
    return (
      <View role="main" className="min-h-full flex-1 items-center justify-center gap-4 bg-background p-4">
        <QueryError error={error} onRetry={() => refetch()} what="the sign-in page" />
        {/* A wrong address is the likeliest reason a device gets here. */}
        {onChangeServer ? <ChangeServerButton onChangeServer={onChangeServer} /> : null}
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
  const sso: SsoProps = { sso: data.authConfig.sso ?? null, ssoError, paired };
  const setUpSlot = offersSetUp ? (
    <Button variant="outline" content="Set up sign-in" onPress={() => setIsSettingUp(true)} />
  ) : null;
  return data.authConfig.secureLocalNet ? (
    <LocalNetSignIn onChangeServer={onChangeServer} setUpSlot={setUpSlot} {...sso} />
  ) : (
    <PasswordSignIn
      offersMagicLink={data.authConfig.magicLink}
      onChangeServer={onChangeServer}
      setUpSlot={setUpSlot}
      {...sso}
    />
  );
}
