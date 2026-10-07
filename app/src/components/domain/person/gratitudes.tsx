import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/page';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Trash2 } from '@/components/ui/icons';

const CREATE_GRATITUDE = graphql(`
  mutation CreateGratitude($body: String!, $personId: UUID!) {
    createGratitude(values: { body: $body, personId: $personId }) {
      id
      body
    }
  }
`);

const DELETE_GRATITUDE = graphql(`
  mutation DeleteGratitude($id: UUID!) {
    deleteGratitude(where: { id: { eq: $id } }) {
      id
    }
  }
`);

/** A gratitude as its row shows it. */
export interface GratitudeData {
  id: string;
  body: string;
}

export interface PersonGratitudesProps {
  personId: string;
  /** The person's gratitudes, newest first. */
  gratitudes: GratitudeData[];
  /** Called after a gratitude is added or deleted. */
  onChanged: () => void;
  /** Whether the Add Gratitude dialog is open. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

interface GratitudeFormProps {
  /** Saves the gratitude. A rejection's message is shown in the footer and the form stays as typed. */
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}

/** The gratitude body and the footer. Submit is disabled while the body is blank. */
function GratitudeForm({ onSubmit, onCancel }: GratitudeFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { body: '' },
    onSubmit: async ({ value }) => {
      const body = value.body.trim();
      if (!body) {
        return;
      }
      setFormError(null);
      try {
        await onSubmit(body);
        form.reset();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    },
  });

  return (
    <form.AppForm>
      <Form className="gap-4">
        <form.AppField name="body">
          {(field) => (
            <field.TextareaField label="Gratitude" rows={3} placeholder="What do you appreciate about this person?" />
          )}
        </form.AppField>
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.Subscribe selector={(state) => state.values.body}>
            {(body) => (
              <form.SubmitButton createLabel="Add Gratitude" savingLabel="Saving..." disabled={!body.trim()} />
            )}
          </form.Subscribe>
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}

interface GratitudeRowProps {
  gratitude: GratitudeData;
  onChanged: () => void;
}

/** One gratitude: its body and its delete. */
function GratitudeRow({ gratitude, onChanged }: GratitudeRowProps) {
  const [deleteGratitude] = useMutation(DELETE_GRATITUDE);

  const handleDelete = async () => {
    await deleteGratitude({ variables: { id: gratitude.id } });
    onChanged();
  };

  return (
    <View className="flex-row items-start justify-between gap-3 rounded-md border border-foreground/10 px-3 py-2">
      <Text className="min-w-0 flex-1 text-sm text-foreground">{gratitude.body}</Text>
      <ConfirmButton
        label="Delete gratitude"
        variant="ghost"
        size="icon-xs"
        iconSlot={<Trash2 />}
        title="Delete this gratitude?"
        description="It cannot be brought back."
        onConfirm={handleDelete}
      />
    </View>
  );
}

/** What the user appreciates about a person, in the order given, and the dialog that adds one. */
export function PersonGratitudes({
  personId,
  gratitudes,
  onChanged,
  createOpen,
  onCreateOpenChange,
}: PersonGratitudesProps) {
  const [createGratitude] = useMutation(CREATE_GRATITUDE);

  const handleCreate = async (body: string) => {
    await createGratitude({ variables: { body, personId } });
    onCreateOpenChange(false);
    onChanged();
  };

  return (
    <View className="gap-2">
      {gratitudes.length === 0 && <EmptyState compact title="What do you appreciate about this person?" />}

      {gratitudes.map((gratitude) => (
        <GratitudeRow key={gratitude.id} gratitude={gratitude} onChanged={onChanged} />
      ))}

      <FormDialog open={createOpen} onOpenChange={onCreateOpenChange} title="Add Gratitude">
        <GratitudeForm onSubmit={handleCreate} onCancel={() => onCreateOpenChange(false)} />
      </FormDialog>
    </View>
  );
}
