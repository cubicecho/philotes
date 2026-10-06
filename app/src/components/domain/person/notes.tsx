import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ActionButton } from '@/components/action-button';
import { useAppForm } from '@/components/app-form';
import { MentionTextareaField } from '@/components/domain/person/note-mentions';
import { ATTACH_NOTE_TAG, NoteTagChip, NoteTagPicker } from '@/components/domain/person/note-tags';
import { AddTagButton, type TagOption, TagsField } from '@/components/domain/person/tag-picker';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { type MentionablePerson, parseMentionedPersonIds } from '@/lib/mentions';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_NOTE = graphql(`
  mutation CreateNote($body: String!, $personId: UUID!) {
    createNote(values: { body: $body, personId: $personId }) {
      id
      body
      personId
    }
  }
`);

const UPDATE_NOTE = graphql(`
  mutation UpdateNote($id: UUID!, $body: String!) {
    updateNote(set: { body: $body }, where: { id: { eq: $id } }) {
      id
      body
    }
  }
`);

const DELETE_NOTE = graphql(`
  mutation DeleteNote($id: UUID!) {
    deleteNote(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const CREATE_NOTE_MENTION = graphql(`
  mutation CreateNoteMention(
    $noteId: UUID!
    $mentionedPersonId: UUID!
  ) {
    createNoteMention(
      values: { noteId: $noteId, mentionedPersonId: $mentionedPersonId }
    ) {
      noteId
      mentionedPersonId
    }
  }
`);

const DELETE_NOTE_MENTIONS = graphql(`
  mutation DeleteNoteMentions($noteId: UUID!) {
    deleteNoteMention(where: { noteId: { eq: $noteId } }) {
      noteId
      mentionedPersonId
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteData {
  id: string;
  body: string;
  labels: TagOption[];
  mentions: Array<{ id: string; firstName: string; lastName: string }>;
}

export interface PersonNotesProps {
  personId: string;
  notes: NoteData[];
  allTags: TagOption[];
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  onChanged: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Note form (body, plus a tag picker when creating)
// ---------------------------------------------------------------------------

interface NoteFormValues {
  body: string;
  mentionedPersonIds: string[];
  labelIds: string[];
}

interface NoteFormProps {
  initialBody?: string;
  /** Offered as a tag picker when given; an existing note's tags are managed on its row instead. */
  allTags?: TagOption[];
  allPersons: MentionablePerson[];
  placeholder: string;
  submitLabel: string;
  onSubmit: (values: NoteFormValues) => Promise<void>;
  onCancel: () => void;
}

function NoteForm({
  initialBody = '',
  allTags = [],
  allPersons,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: NoteFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaultValues: { body: string; labelIds: string[] } = { body: initialBody, labelIds: [] };

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const body = value.body.trim();
      if (!body) return;
      setFormError(null);
      try {
        await onSubmit({
          body,
          mentionedPersonIds: parseMentionedPersonIds(value.body, allPersons),
          labelIds: value.labelIds,
        });
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
          {() => <MentionTextareaField label="Note" allPersons={allPersons} rows={4} placeholder={placeholder} />}
        </form.AppField>
        {allTags.length > 0 && <form.AppField name="labelIds">{() => <TagsField allTags={allTags} />}</form.AppField>}
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.Subscribe selector={(state) => state.values.body}>
            {(body) => <form.SubmitButton createLabel={submitLabel} savingLabel="Saving..." disabled={!body.trim()} />}
          </form.Subscribe>
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}

// ---------------------------------------------------------------------------
// Note row
// ---------------------------------------------------------------------------

interface NoteRowProps {
  note: NoteData;
  allTags: TagOption[];
  allPersons: MentionablePerson[];
  onChanged: () => void;
}

function NoteRow({ note, allTags, allPersons, onChanged }: NoteRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [updateNote] = useMutation(UPDATE_NOTE);
  const [deleteNote] = useMutation(DELETE_NOTE);
  const [createNoteMention] = useMutation(CREATE_NOTE_MENTION);
  const [deleteNoteMention] = useMutation(DELETE_NOTE_MENTIONS);

  const handleEdit = async ({ body, mentionedPersonIds }: NoteFormValues) => {
    await updateNote({ variables: { id: note.id, body } });
    // Re-sync mentions: delete all then re-add
    await deleteNoteMention({ variables: { noteId: note.id } });
    for (const mentionedPersonId of mentionedPersonIds) {
      await createNoteMention({
        variables: { noteId: note.id, mentionedPersonId },
      });
    }
    setEditOpen(false);
    onChanged();
  };

  const handleDelete = async () => {
    await deleteNote({ variables: { id: note.id } });
    onChanged();
  };

  const attachedIds = new Set(note.labels.map((t) => t.id));

  return (
    <>
      <View className="gap-1.5 rounded-md border border-border px-3 py-2">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="min-w-0 flex-1 text-sm text-foreground">{note.body}</Text>
          <View className="shrink-0 flex-row gap-1">
            <ActionButton
              label="Edit note"
              variant="ghost"
              size="icon-xs"
              iconSlot={<Pencil />}
              onPress={() => setEditOpen(true)}
            />
            <ActionButton
              label="Delete note"
              variant="ghost"
              size="icon-xs"
              iconSlot={<Trash2 />}
              onPress={handleDelete}
            />
          </View>
        </View>

        {/* Tags */}
        <View className="gap-1">
          {note.labels.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {note.labels.map((t) => (
                <NoteTagChip
                  key={t.id}
                  noteId={note.id}
                  labelId={t.id}
                  label={t.label}
                  color={t.color}
                  onDetach={onChanged}
                />
              ))}
            </View>
          )}
          {showAddTag ? (
            <NoteTagPicker
              noteId={note.id}
              allTags={allTags}
              attachedTagIds={attachedIds}
              onClose={() => setShowAddTag(false)}
              onAdd={onChanged}
            />
          ) : (
            <AddTagButton onPress={() => setShowAddTag(true)} />
          )}
        </View>

        {/* Mentions */}
        {note.mentions.length > 0 && (
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-xs font-medium text-muted-foreground">Mentions:</Text>
            {note.mentions.map((m) => (
              <Link key={m.id} href={`/persons/${m.id}`} asChild>
                <Button variant="secondary" size="xs" content={`${m.firstName} ${m.lastName}`} />
              </Link>
            ))}
          </View>
        )}
      </View>

      <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Note">
        <NoteForm
          initialBody={note.body}
          allPersons={allPersons}
          placeholder="Write your note..."
          submitLabel="Save"
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PersonNotes({
  personId,
  notes,
  allTags,
  allPersons,
  onChanged,
  createOpen,
  onCreateOpenChange,
}: PersonNotesProps) {
  const [createNote] = useMutation(CREATE_NOTE);
  const [attachTag] = useMutation(ATTACH_NOTE_TAG);
  const [createNoteMention] = useMutation(CREATE_NOTE_MENTION);

  const handleCreate = async ({ body, mentionedPersonIds, labelIds }: NoteFormValues) => {
    const result = await createNote({ variables: { body, personId } });
    const noteId = result.data?.createNote?.id;
    if (noteId) {
      for (const labelId of labelIds) {
        await attachTag({ variables: { noteId, labelId } });
      }
      for (const mentionedPersonId of mentionedPersonIds) {
        await createNoteMention({ variables: { noteId, mentionedPersonId } });
      }
    }
    onCreateOpenChange(false);
    onChanged();
  };

  return (
    <View className="gap-2">
      {notes.length === 0 && <Text className="text-sm text-muted-foreground">No notes yet.</Text>}

      {notes.map((note) => (
        <NoteRow key={note.id} note={note} allTags={allTags} allPersons={allPersons} onChanged={onChanged} />
      ))}

      <FormDialog open={createOpen} onOpenChange={onCreateOpenChange} title="Add Note">
        <NoteForm
          allTags={allTags}
          allPersons={allPersons}
          placeholder="Write your note... Type @ to mention someone"
          submitLabel="Add Note"
          onSubmit={handleCreate}
          onCancel={() => onCreateOpenChange(false)}
        />
      </FormDialog>
    </View>
  );
}
