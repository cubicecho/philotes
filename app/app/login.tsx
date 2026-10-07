import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { CenteredLayout } from '@/components/centered-layout';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

const REQUEST_MAGIC_LINK = graphql(`
  mutation RequestMagicLink($email: String!) {
    requestMagicLink(email: $email) {
      ok
      magicLink
    }
  }
`);

export default function LoginPage() {
  // The address the link went to; null until one has been requested.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  const [requestLink, { error }] = useMutation(REQUEST_MAGIC_LINK);

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      try {
        const { data } = await requestLink({ variables: { email: value.email } });
        if (!data) return;
        setMagicLink(data.requestMagicLink.magicLink ?? null);
        setSentTo(value.email);
      } catch {
        // Rendered from `error` below.
      }
    },
  });

  if (sentTo && magicLink) {
    return (
      <CenteredLayout
        className="bg-background"
        level={1}
        title="Your magic link"
        contentSlot={
          <Text className="text-muted-foreground text-sm">
            Click the link below to sign in as <Text className="font-semibold text-foreground">{sentTo}</Text>.
          </Text>
        }
        footerSlot={
          <Text className="shrink text-muted-foreground text-xs">
            This link is shown here because the server is running in development mode.
          </Text>
        }
        footerActionsSlot={<Button linkSlot={<Link href={magicLink} />} content="Sign in →" />}
      />
    );
  }

  if (sentTo) {
    return (
      <CenteredLayout
        className="bg-background"
        level={1}
        title="Check your email"
        contentSlot={
          <Text className="text-muted-foreground text-sm">
            We sent a magic link to <Text className="font-semibold text-foreground">{sentTo}</Text>. Click it to sign
            in.
          </Text>
        }
        footerActionsSlot={
          <Button
            variant="outline"
            content="Use a different email"
            onPress={() => {
              setSentTo(null);
              form.reset();
            }}
          />
        }
      />
    );
  }

  return (
    <CenteredLayout
      className="bg-background"
      level={1}
      title="Sign in"
      description="Enter your email and we'll send you a magic link."
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField
              name="email"
              validators={{ onChange: ({ value }) => (value.trim() === '' ? 'Enter your email.' : undefined) }}
            >
              {(field) => <field.InputField label="Email" type="email" />}
            </form.AppField>

            {error ? <Text className="text-destructive text-sm">{error.message}</Text> : null}

            <form.SubmitButton createLabel="Send magic link" savingLabel="Sending…" />
          </Form>
        </form.AppForm>
      }
    />
  );
}
