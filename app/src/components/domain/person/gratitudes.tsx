import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { DialogLayout } from '@/components/dialog-layout';
import { EmptyState } from '@/components/page';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
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

interface GratitudeFormDialogProps {
  open: boolean;
  /** Called when the dialog asks to close, and with `false` once the gratitude is saved. */
  onOpenChange: (open: boolean) => void;
  /**
   * Saves the gratitude. On success the form resets and the dialog closes; a rejection's message is shown under the
   * field and the form stays as typed.
   */
  onSubmit: (body: string) => Promise<void>;
}

/** The dialog that adds a gratitude. Submit is disabled while the body is blank. */
function GratitudeFormDialog({ open, onOpenChange, onSubmit }: GratitudeFormDialogProps) {
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
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        return;
      }
      form.reset();
      onOpenChange(false);
    },
  });

  // The dialog stays mounted while shut, so whatever way it closes, the next opening starts afresh.
  const handleOpenChange = (next: boolean) => {
    const isClosing = next === false;
    if (isClosing) {
      form.reset();
      setFormError(null);
    }
    onOpenChange(next);
  };

  return (
    <DialogLayout
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Gratitude"
      hasUnsavedChanges={() => form.state.isDefaultValue === false}
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField name="body">
              {(field) => (
                <field.TextareaField
                  label="Gratitude"
                  rows={3}
                  placeholder="What do you appreciate about this person?"
                />
              )}
            </form.AppField>
            {formError ? <Alert variant="destructive" title={formError} /> : null}
          </Form>
        </form.AppForm>
      }
      footerActionsSlot={(close) => (
        <>
          <Button variant="outline" onPress={close} content="Cancel" />
          <form.AppForm>
            <form.Subscribe selector={(state) => state.values.body}>
              {(body) => (
                <form.SubmitButton createLabel="Add Gratitude" savingLabel="Saving..." disabled={body.trim() === ''} />
              )}
            </form.Subscribe>
          </form.AppForm>
        </>
      )}
    />
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
        aria-label="Delete gratitude"
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
    onChanged();
  };

  return (
    <View className="gap-2">
      {gratitudes.length === 0 && <EmptyState compact title="What do you appreciate about this person?" />}

      {gratitudes.map((gratitude) => (
        <GratitudeRow key={gratitude.id} gratitude={gratitude} onChanged={onChanged} />
      ))}

      <GratitudeFormDialog open={createOpen} onOpenChange={onCreateOpenChange} onSubmit={handleCreate} />
    </View>
  );
}
