import { useState } from 'react';
import { useAppForm } from '@/components/app-form';
import { DialogLayout } from '@/components/dialog-layout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

/** A label as the merge dialog needs it: its id and name. */
interface MergeLabel {
  id: string;
  label: string;
}

interface LabelMergeDialogProps {
  /** The label being merged away; `null` closes the dialog. */
  label: MergeLabel | null;
  /** Every label it could be merged into — the caller leaves `label` itself out. */
  targets: MergeLabel[];
  /** Merges `label` into the label with this id, which is kept. A rejection's message is shown under the field. */
  onMerge: (keepId: string) => Promise<void>;
  /** Called when the dialog is dismissed or cancelled. */
  onClose: () => void;
}

/** The dialog that asks which label another is merged into. It is open while `label` is set. */
export function LabelMergeDialog({ label, targets, onMerge, onClose }: LabelMergeDialogProps) {
  // Keyed so each merge starts with nothing chosen.
  return <MergeForm key={label?.id} label={label} targets={targets} onMerge={onMerge} onClose={onClose} />;
}

/** The merge dialog itself: the one field, the label to keep, and Merge disabled until one is chosen. */
function MergeForm({ label, targets, onMerge, onClose }: LabelMergeDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { targetId: '' },
    onSubmit: async ({ value }) => {
      if (!value.targetId) {
        return;
      }
      setFormError(null);
      try {
        await onMerge(value.targetId);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    },
  });

  return (
    <DialogLayout
      open={label !== null}
      onOpenChange={(open) => {
        const isClosing = open === false;
        if (isClosing) {
          onClose();
        }
      }}
      title="Merge label"
      description={
        label
          ? `Choose the label to merge “${label.label}” into. All items labeled with “${label.label}” will be re-labeled with the chosen label, and “${label.label}” will be deleted.`
          : undefined
      }
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField name="targetId">
              {(field) => (
                <field.SelectField
                  label="Merge into"
                  placeholder="Select a label…"
                  options={targets.map((t) => ({ value: t.id, label: t.label }))}
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
            <form.Subscribe selector={(state) => state.values.targetId}>
              {(targetId) => <form.SubmitButton createLabel="Merge" savingLabel="Merging…" disabled={!targetId} />}
            </form.Subscribe>
          </form.AppForm>
        </>
      )}
    />
  );
}
