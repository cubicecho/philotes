import { useMutation } from '@apollo/client';
import { InteractionForm, type InteractionFormValues } from '@/components/domain/person/interaction-form';
import { CREATE_INTERACTION } from '@/components/domain/person/interactions';
import { FormDialog } from '@/components/ui/form-dialog';
import { fullName } from '@/lib/person-name';

/** The person an interaction is being logged with. */
export interface QuickLogPerson {
  id: string;
  firstName: string;
  lastName: string;
}

interface QuickLogDialogProps {
  /** Who the interaction is with; the dialog is closed while this is `null`. */
  person: QuickLogPerson | null;
  /** Called when the dialog asks to close, saved or not. */
  onClose: () => void;
  /** Called after the interaction is saved, so the owner can refetch. */
  onLogged: () => void;
}

/** A dialog that logs an interaction with a person from outside their page: channel, time, sentiment and note. */
export function QuickLogDialog({ person, onClose, onLogged }: QuickLogDialogProps) {
  const [createInteraction] = useMutation(CREATE_INTERACTION);

  const handleSubmit = async (values: InteractionFormValues): Promise<void> => {
    if (!person) {
      return;
    }
    await createInteraction({
      variables: {
        personId: person.id,
        channel: values.channel,
        occurredAt: values.occurredAt,
        sentiment: values.sentiment || null,
        note: values.note || null,
      },
    });
    onClose();
    onLogged();
  };

  return (
    <FormDialog
      open={person !== null}
      onOpenChange={(open) => {
        const isClosing = open === false;
        if (isClosing) {
          onClose();
        }
      }}
      title="Log Interaction"
      description={person ? `Record a contact with ${fullName(person)}.` : undefined}
    >
      {/* Tags are left to the person's page: the list does not load them. */}
      {person && <InteractionForm personId={person.id} allTags={[]} onSubmit={handleSubmit} onCancel={onClose} />}
    </FormDialog>
  );
}
