import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { ActionButton } from '@/components/action-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/*
 * Both press names, because the compiler renames a prop where it is declared or passed and not a
 * key written as a string: `"onPress"` alone would leave the compiled half's `onClick` in the type,
 * accepted and then dropped. The press is what opens the question, so neither half takes one.
 */
type ConfirmButtonProps = Omit<ComponentProps<typeof ActionButton>, 'onPress' | 'onClick'> & {
  /** The question, as a heading. "Delete this workspace?" */
  title: ReactNode;
  /**
   * What is lost if they say yes. Required, and it is the reason the component is worth
   * installing — see the note below.
   */
  description: ReactNode;
  /** The verb on the button that does it. */
  confirmLabel?: ReactNode | undefined;
  cancelLabel?: ReactNode | undefined;
  /**
   * The text to type before the confirm button unlocks — the name of the folder, the
   * repository, the workspace. Matched exactly. For a delete that is big and cannot be undone;
   * left out, the dialog asks with one click.
   */
  requireText?: string | undefined;
  /** The input's label. Defaults to "Type **{requireText}** to confirm". */
  requireTextLabel?: ReactNode | undefined;
  onConfirm: () => void;
};

/**
 * A button that asks first. One source for both platforms; `rn2web` compiles it for the DOM,
 * where the trigger takes everything `ActionButton` takes there — `onClick` aside, since the
 * press is what opens the question.
 *
 * There are 22 hand-written `<AlertDialogContent>` blocks across these projects and four of them
 * are already this component, extracted independently — `kanban_server/.../confirm-button.tsx`,
 * `eunomia/.../confirm-delete.tsx`, a private project's `confirm.tsx`, and `philotes`, which wrote
 * it inline twice. The other twelve are loose in route files. They disagree about the button
 * order, about whether the confirm is `variant="destructive"` or a `cn(buttonVariants(…))`, and
 * about what Cancel is called.
 *
 * **`description` is required, and that is the opinion this component is carrying.** It is meant
 * to say what is lost, not to ask again. "This action cannot be undone" is what the dialog
 * already implies and it is what nine of these call sites say; "the lane takes its cards with
 * it" is the thing the person did not know and could not have guessed from the row they clicked.
 * A confirm whose description is the word "permanently" has cost a click and taught nothing. The
 * prop is required because the useful sentence is the one that gets skipped when it is optional.
 *
 * **The dialog is `ConfirmDialog`**, the one `confirm()` raises, so the three spellings of this
 * question — a button, a promise, a dialog under the caller's control — draw the same card, with
 * the same button order and the same type-the-name box. It is an `alertdialog` with no corner
 * close button, and a press beside it does not answer it.
 *
 * **Why the open state rather than `DialogTrigger asChild`.** The trigger is an
 * {@link ActionButton}, which is already a `TooltipTrigger asChild`, and two `Slot`s over one
 * button fight over the ref and the handlers; on device `DialogTrigger` also has to be a direct
 * child of `Dialog`, which `ConfirmDialog` does not expose. Holding `open` here is one line and it
 * keeps the button's tooltip, its name and its `aria-disabled` intact — and `ActionButton` refuses
 * the press while disabled, so a disabled `ConfirmButton` never asks.
 *
 * Destructive only, deliberately. `confirmLabel` reaches Discard, Revoke, Remove and Reset — a
 * confirm that is *not* destructive is a question, and a question is `DialogLayout`.
 *
 * `requireText` is the type-the-name mode — GitHub's repository delete. The box empties each time
 * the dialog opens, so the name is typed once per delete rather than once per session.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  requireText,
  requireTextLabel,
  onConfirm,
  ...props
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionButton {...props} onPress={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        requireText={requireText}
        requireTextLabel={requireTextLabel}
        // `ConfirmDialog` leaves closing to its caller, for the button and for Enter alike.
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}
