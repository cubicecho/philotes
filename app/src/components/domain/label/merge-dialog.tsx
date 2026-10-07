import { useState } from 'react';
import { useAppForm } from '@/components/app-form';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';

interface MergeLabel {
  id: string;
  label: string;
}

interface LabelMergeDialogProps {
  /** The label being merged away; `null` closes the dialog. */
  label: MergeLabel | null;
  /** Every label it could be merged into — the caller leaves `label` itself out. */
  targets: MergeLabel[];
  onMerge: (keepId: string) => Promise<void>;
  onClose: () => void;
}

export function LabelMergeDialog({ label, targets, onMerge, onClose }: LabelMergeDialogProps) {
  return (
    <FormDialog
      open={label !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Merge label"
      description={
        label
          ? `Choose the label to merge “${label.label}” into. All items labeled with “${label.label}” will be re-labeled with the chosen label, and “${label.label}” will be deleted.`
          : undefined
      }
    >
      {/* Keyed so each merge starts with nothing chosen. */}
      {label ? <MergeForm key={label.id} targets={targets} onMerge={onMerge} onCancel={onClose} /> : null}
    </FormDialog>
  );
}

interface MergeFormProps {
  targets: MergeLabel[];
  onMerge: (keepId: string) => Promise<void>;
  onCancel: () => void;
}

function MergeForm({ targets, onMerge, onCancel }: MergeFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { targetId: '' },
    onSubmit: async ({ value }) => {
      if (!value.targetId) return;
      setFormError(null);
      try {
        await onMerge(value.targetId);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    },
  });

  return (
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
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.Subscribe selector={(state) => state.values.targetId}>
            {(targetId) => <form.SubmitButton createLabel="Merge" savingLabel="Merging…" disabled={!targetId} />}
          </form.Subscribe>
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}
