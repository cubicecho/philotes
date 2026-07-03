import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { Pencil, Tag, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_NOTE = graphql(`
  mutation CreateNote($body: String!, $personId: String!) {
    createNote(values: { body: $body, personId: $personId }) {
      id
      body
      personId
    }
  }
`);

const UPDATE_NOTE = graphql(`
  mutation UpdateNote($id: String!, $body: String!) {
    updateNotes(set: { body: $body }, where: { id: { eq: $id } }) {
      id
      body
    }
  }
`);

const DELETE_NOTE = graphql(`
  mutation DeleteNote($id: String!) {
    deleteNotes(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const ATTACH_NOTE_TAG = graphql(`
  mutation AttachTagToNote($noteId: String!, $labelId: String!) {
    createNoteTag(values: { noteId: $noteId, labelId: $labelId }) {
      noteId
      labelId
    }
  }
`);

const DETACH_NOTE_TAG = graphql(`
  mutation DetachTagFromNote($noteId: String!, $labelId: String!) {
    deleteNoteTags(
      where: { noteId: { eq: $noteId }, labelId: { eq: $labelId } }
    ) {
      noteId
      labelId
    }
  }
`);

const CREATE_NOTE_MENTION = graphql(`
  mutation CreateNoteMention(
    $noteId: String!
    $mentionedPersonId: String!
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
  mutation DeleteNoteMentions($noteId: String!) {
    deleteNoteMentions(where: { noteId: { eq: $noteId } }) {
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
  labels: Array<{ id: string; label: string; color: string }>;
  mentions: Array<{ id: string; firstName: string; lastName: string }>;
}

export interface PersonNotesProps {
  personId: string;
  notes: NoteData[];
  allTags: Array<{ id: string; label: string; color: string }>;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  onChanged: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Mention helpers
// ---------------------------------------------------------------------------

interface PersonStub {
  id: string;
  firstName: string;
  lastName: string;
}

/** Parse all @FirstName LastName mentions in a body string and return the
 *  matching person IDs from allPersons. */
function parseMentionedPersonIds(body: string, allPersons: PersonStub[]): string[] {
  const ids = new Set<string>();
  const pattern = /@([\w'-]+)\s+([\w'-]+)/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((match = pattern.exec(body)) !== null) {
    const first = match[1].toLowerCase();
    const last = match[2].toLowerCase();
    for (const p of allPersons) {
      if (p.firstName.toLowerCase() === first && p.lastName.toLowerCase() === last) {
        ids.add(p.id);
      }
    }
  }
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// @-Mention dropdown
// ---------------------------------------------------------------------------

interface MentionDropdownProps {
  query: string;
  allPersons: PersonStub[];
  onSelect: (person: PersonStub) => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

function MentionDropdown({ query, allPersons, onSelect, anchorRef }: MentionDropdownProps) {
  const lower = query.toLowerCase();
  const filtered = allPersons.filter((p) => {
    const full = `${p.firstName} ${p.lastName}`.toLowerCase();
    return full.startsWith(lower) || p.firstName.toLowerCase().startsWith(lower);
  });

  if (filtered.length === 0) return null;

  // Position beneath the textarea
  const rect = anchorRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 50,
        minWidth: 180,
      }
    : { position: 'absolute', zIndex: 50, minWidth: 180 };

  return (
    <div style={style} className="rounded-md border border-border bg-popover shadow-md py-1 max-h-48 overflow-y-auto">
      {filtered.map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => {
            // Prevent textarea blur before click registers
            e.preventDefault();
            onSelect(p);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
        >
          {p.firstName} {p.lastName}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mention-aware textarea hook
// ---------------------------------------------------------------------------

interface UseMentionTextareaOptions {
  allPersons: PersonStub[];
}

function useMentionTextarea({ allPersons }: UseMentionTextareaOptions, initialBody = '') {
  const [body, setBody] = useState(initialBody);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const detectMention = (value: string, cursorPos: number) => {
    const textUpToCursor = value.slice(0, cursorPos);
    // Match an @ followed by non-whitespace chars at the end of text
    const match = /@([\w']*)$/.exec(textUpToCursor);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    detectMention(val, e.target.selectionStart ?? val.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null);
    }
  };

  const handleSelect = (person: PersonStub) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart ?? body.length;
    const textUpToCursor = body.slice(0, cursorPos);
    // Replace the partial @query with @FirstName LastName
    const replaced = textUpToCursor.replace(/@[\w']*$/, `@${person.firstName} ${person.lastName}`);
    const newBody = replaced + body.slice(cursorPos);
    setBody(newBody);
    setMentionQuery(null);
    // Restore focus + move cursor to end of inserted mention
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = replaced.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const reset = () => {
    setBody('');
    setMentionQuery(null);
  };

  const mentionedPersonIds = parseMentionedPersonIds(body, allPersons);

  return {
    body,
    setBody,
    mentionQuery,
    mentionedPersonIds,
    textareaRef,
    handleChange,
    handleKeyDown,
    handleSelect,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Tag chip on a note (for existing notes)
// ---------------------------------------------------------------------------

interface NoteTagChipProps {
  noteId: string;
  labelId: string;
  label: string;
  color: string;
  onDetach: () => void;
}

function NoteTagChip({ noteId, labelId, label, color, onDetach }: NoteTagChipProps) {
  const [detachTag] = useMutation(DETACH_NOTE_TAG);

  const handleDetach = async () => {
    await detachTag({ variables: { noteId, labelId } });
    onDetach();
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      <button
        type="button"
        onClick={handleDetach}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove tag ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add-tag picker on a note (for existing notes)
// ---------------------------------------------------------------------------

interface NoteTagPickerProps {
  noteId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

function NoteTagPicker({ noteId, allTags, attachedTagIds, onClose, onAdd }: NoteTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_NOTE_TAG);
  const available = allTags.filter((t) => !attachedTagIds.has(t.id));

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { noteId, labelId } });
    onAdd();
    onClose();
  };

  if (available.length === 0) {
    return (
      <div className="flex gap-1.5 rounded-md border border-border p-2 text-xs text-muted-foreground">
        All tags attached.
        <button type="button" onClick={onClose} className="ml-auto hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-2">
      {available.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => handleSelect(t.id)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: t.color }}
            aria-hidden="true"
          />
          {t.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit note form (body only — tags managed inline on the row)
// ---------------------------------------------------------------------------

interface EditNoteFormProps {
  initialBody: string;
  allPersons: PersonStub[];
  onSubmit: (body: string, mentionedPersonIds: string[]) => Promise<void>;
  onCancel: () => void;
}

function EditNoteForm({ initialBody, allPersons, onSubmit, onCancel }: EditNoteFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const mention = useMentionTextarea({ allPersons }, initialBody);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mention.body.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(mention.body.trim(), mention.mentionedPersonIds);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          ref={mention.textareaRef}
          value={mention.body}
          onChange={mention.handleChange}
          onKeyDown={mention.handleKeyDown}
          rows={4}
          placeholder="Write your note..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          // biome-ignore lint/a11y/noAutofocus: intentional for modal forms
          autoFocus
        />
        {mention.mentionQuery !== null && (
          <MentionDropdown
            query={mention.mentionQuery}
            allPersons={allPersons}
            onSelect={mention.handleSelect}
            anchorRef={mention.textareaRef}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!mention.body.trim() || submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Create note form (body + tag multi-select)
// ---------------------------------------------------------------------------

interface CreateNoteFormProps {
  personId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  allPersons: PersonStub[];
  onAdded: () => void;
  onCancel: () => void;
}

function CreateNoteForm({ personId, allTags, allPersons, onAdded, onCancel }: CreateNoteFormProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createNote] = useMutation(CREATE_NOTE);
  const [attachTag] = useMutation(ATTACH_NOTE_TAG);
  const [createNoteMention] = useMutation(CREATE_NOTE_MENTION);
  const mention = useMentionTextarea({ allPersons });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mention.body.trim()) return;
    setSubmitting(true);
    try {
      const result = await createNote({
        variables: { body: mention.body.trim(), personId },
      });
      const noteId = result.data?.createNote?.id;
      if (noteId) {
        if (selectedTagIds.length > 0) {
          for (const labelId of selectedTagIds) {
            await attachTag({ variables: { noteId, labelId } });
          }
        }
        for (const mentionedPersonId of mention.mentionedPersonIds) {
          await createNoteMention({ variables: { noteId, mentionedPersonId } });
        }
      }
      mention.reset();
      setSelectedTagIds([]);
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <textarea
          ref={mention.textareaRef}
          value={mention.body}
          onChange={mention.handleChange}
          onKeyDown={mention.handleKeyDown}
          rows={4}
          placeholder="Write your note... Type @ to mention someone"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          // biome-ignore lint/a11y/noAutofocus: intentional for modal forms
          autoFocus
        />
        {mention.mentionQuery !== null && (
          <MentionDropdown
            query={mention.mentionQuery}
            allPersons={allPersons}
            onSelect={mention.handleSelect}
            anchorRef={mention.textareaRef}
          />
        )}
      </div>
      {allTags.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="note-tags" className="text-sm font-medium">
            Tags
          </label>
          <TagMultiSelect
            id="note-tags"
            options={allTags}
            selected={selectedTagIds}
            onChange={setSelectedTagIds}
            placeholder="Add tags..."
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!mention.body.trim() || submitting}>
          {submitting ? 'Saving...' : 'Add Note'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Note row
// ---------------------------------------------------------------------------

interface NoteRowProps {
  note: NoteData;
  allTags: Array<{ id: string; label: string; color: string }>;
  allPersons: PersonStub[];
  onChanged: () => void;
}

function NoteRow({ note, allTags, allPersons, onChanged }: NoteRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [updateNote] = useMutation(UPDATE_NOTE);
  const [deleteNote] = useMutation(DELETE_NOTE);
  const [createNoteMention] = useMutation(CREATE_NOTE_MENTION);
  const [deleteNoteMentions] = useMutation(DELETE_NOTE_MENTIONS);

  const handleEdit = async (body: string, mentionedPersonIds: string[]) => {
    await updateNote({ variables: { id: note.id, body } });
    // Re-sync mentions: delete all then re-add
    await deleteNoteMentions({ variables: { noteId: note.id } });
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
      <div className="rounded-md border border-border px-3 py-2 text-sm space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 whitespace-pre-wrap text-sm">{note.body}</p>
          <div className="flex shrink-0 gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="hover:text-foreground transition-colors"
              aria-label="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="hover:text-destructive transition-colors"
              aria-label="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          {note.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
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
            </div>
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
            <button
              type="button"
              onClick={() => setShowAddTag(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Tag className="h-3 w-3" />
              Add tag
            </button>
          )}
        </div>

        {/* Mentions */}
        {note.mentions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium">Mentions:</span>
            {note.mentions.map((m) => (
              <Link key={m.id} href={`/persons/${m.id}`} className="rounded bg-muted px-1.5 py-0.5 hover:underline">
                {m.firstName} {m.lastName}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <EditNoteForm
            initialBody={note.body}
            allPersons={allPersons}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
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
  return (
    <div className="space-y-2">
      {notes.length === 0 && <p className="text-muted-foreground text-sm">No notes yet.</p>}

      {notes.map((note) => (
        <NoteRow key={note.id} note={note} allTags={allTags} allPersons={allPersons} onChanged={onChanged} />
      ))}

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <CreateNoteForm
            personId={personId}
            allTags={allTags}
            allPersons={allPersons}
            onAdded={() => {
              onCreateOpenChange(false);
              onChanged();
            }}
            onCancel={() => onCreateOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
