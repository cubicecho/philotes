import { gql, useMutation } from '@apollo/client';
import { useState } from 'react';
import { View } from 'react-native';
import { useAppForm } from '@/components/app-form';
import { DescriptionList, PropertyRow } from '@/components/description-list';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';

const MY_CREATE_API_KEY = gql`
  mutation MyCreateApiKey($input: CreateApiKeyInput!) {
    myCreateApiKey(input: $input) {
      apiKey {
        id
        name
        keyPrefix
        createdAt
      }
      token
    }
  }
`;

/** Days until the key expires; `never` sends no `expiresAt` at all. */
const NO_EXPIRY = 'never';

const EXPIRY_OPTIONS = [
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: '1 year', value: '365' },
  { label: 'No expiry', value: NO_EXPIRY },
] as const;

type Phase = { phase: 'form' } | { phase: 'reveal'; token: string };

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** Local midnight `days` from now, in the offset-less form the server expects. */
function expiryDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

export function CreateApiKeyDialog({ open, onOpenChange, onCreated }: CreateApiKeyDialogProps) {
  const [state, setState] = useState<Phase>({ phase: 'form' });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createApiKey] = useMutation<{
    myCreateApiKey: { apiKey: { id: string; name: string; keyPrefix: string }; token: string };
  }>(MY_CREATE_API_KEY);

  const form = useAppForm({
    defaultValues: { name: '', expiry: NO_EXPIRY as string },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const expiresAt = value.expiry === NO_EXPIRY ? undefined : expiryDate(Number(value.expiry));
      try {
        const result = await createApiKey({ variables: { input: { name: value.name.trim(), expiresAt } } });
        const token = result.data?.myCreateApiKey?.token;
        if (token) {
          setState({ phase: 'reveal', token });
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Could not generate the key.');
      }
    },
  });

  function handleClose(value: boolean) {
    if (!value) {
      // The list only needs refreshing once a key was actually made.
      if (state.phase === 'reveal') {
        onCreated();
      }
      setState({ phase: 'form' });
      setSubmitError(null);
      form.reset();
    }
    onOpenChange(value);
  }

  if (state.phase === 'reveal') {
    const icalUrl = `${globalThis.location?.origin ?? ''}/ical?key=${state.token}`;

    return (
      <FormDialog
        open={open}
        onOpenChange={handleClose}
        title="API Key Generated"
        description="Copy the calendar URL below and paste it into your calendar app. The token will not be shown again."
      >
        <View className="gap-4">
          <Alert variant="warning" title="Store your token securely — it will not be shown again." />
          <DescriptionList
            layout="stacked"
            contentSlot={
              <>
                <PropertyRow
                  label="Calendar Subscription URL"
                  value={icalUrl}
                  valueClassName="font-mono text-xs"
                  hint={
                    'Paste this URL into Google Calendar → "Other calendars" → "From URL", or Apple Calendar → File → New Calendar Subscription.'
                  }
                  actionSlot={<CopyButton value={icalUrl} label="Copy URL" />}
                />
                <PropertyRow
                  label="Raw Token"
                  value={state.token}
                  valueClassName="font-mono text-xs"
                  actionSlot={<CopyButton value={state.token} label="Copy token" />}
                />
              </>
            }
          />
          <View className="flex-row justify-end">
            <Button content="Done" onPress={() => handleClose(false)} />
          </View>
        </View>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleClose}
      title="Generate API Key"
      description="Create an API key to subscribe to your important dates calendar in any calendar app. The full token is shown only once."
    >
      <form.AppForm>
        <Form>
          <form.AppField
            name="name"
            validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Name is required') }}
          >
            {(field) => <field.InputField label="Name" placeholder="e.g. Google Calendar" maxLength={60} />}
          </form.AppField>
          <form.AppField name="expiry">
            {(field) => <field.SelectField label="Expiry" options={EXPIRY_OPTIONS} />}
          </form.AppField>
          <FormDialogFooter onCancel={() => handleClose(false)} error={submitError}>
            <form.SubmitButton createLabel="Generate Key" savingLabel="Generating…" />
          </FormDialogFooter>
        </Form>
      </form.AppForm>
    </FormDialog>
  );
}
