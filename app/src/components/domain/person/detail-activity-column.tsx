import { useState } from 'react';
import { View } from 'react-native';
import type { GetPersonInteractionsQuery, GetPersonNotesQuery } from '@/__generated__/graphql';
import { Heart, MessageSquare, NotebookPen, SquareCheck } from '@/components/app-icons';
import type { DetailLabel, PersonDetail, PersonStub } from '@/components/domain/person/detail-queries';
import { PersonGratitudes } from '@/components/domain/person/gratitudes';
import { ImportantDatesSection } from '@/components/domain/person/important-dates-section';
import { PersonInteractions } from '@/components/domain/person/interactions';
import { PersonMentionedIn } from '@/components/domain/person/mentioned-in';
import { PersonNotes } from '@/components/domain/person/notes';
import { SectionAdd } from '@/components/domain/person/section-add';
import { TaskList } from '@/components/domain/task/list';
import { Section } from '@/components/section';

export interface PersonActivityColumnProps {
  /** The person the page is about. */
  person: PersonDetail;
  /** The person's notes, every page of them read so far. */
  notes: GetPersonNotesQuery['notes'];
  /** The person's interactions, every page of them read so far. */
  interactions: GetPersonInteractionsQuery['interactions'];
  /** Every label of the caller's, for tagging a note, an interaction or a date. */
  allLabels: DetailLabel[];
  /** Everyone in the caller's contacts, for a note's @mentions. */
  allPersons: PersonStub[];
  /** Called after anything in the column is added, changed or removed. */
  onChanged: () => void;
  /** Whether the log-interaction dialog is open. The page owns it because the contact actions open it too. */
  interactionDialogOpen: boolean;
  /** Opens or closes the log-interaction dialog. */
  onInteractionDialogOpenChange: (open: boolean) => void;
}

/** The second column of a person's page: what has been written, said, planned and remembered about them. */
export function PersonActivityColumn({
  person,
  notes,
  interactions,
  allLabels,
  allPersons,
  onChanged,
  interactionDialogOpen,
  onInteractionDialogOpenChange,
}: PersonActivityColumnProps) {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [gratitudeDialogOpen, setGratitudeDialogOpen] = useState(false);
  const mentionedInNotes = person.mentionedInNotes ?? [];

  return (
    <View className="min-w-0 gap-6 lg:flex-1">
      <Section
        surface="card"
        title="Notes"
        actionSlot={<SectionAdd iconSlot={<NotebookPen />} onPress={() => setNoteDialogOpen(true)} />}
        contentSlot={
          <PersonNotes
            personId={person.id}
            notes={notes.map((n) => ({
              id: n.id,
              body: n.body,
              labels: n.labels ?? [],
              mentions: (n.mentions ?? []).map((m) => ({
                id: m.id,
                firstName: m.firstName,
                lastName: m.lastName,
              })),
            }))}
            allTags={allLabels}
            allPersons={allPersons}
            onChanged={onChanged}
            createOpen={noteDialogOpen}
            onCreateOpenChange={setNoteDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Interactions"
        actionSlot={
          <SectionAdd iconSlot={<MessageSquare />} content="Log" onPress={() => onInteractionDialogOpenChange(true)} />
        }
        contentSlot={
          <PersonInteractions
            personId={person.id}
            interactions={interactions.map((i) => ({
              id: i.id,
              personId: i.personId,
              channel: i.channel,
              occurredAt: i.occurredAt,
              sentiment: i.sentiment,
              note: i.note,
              labels: i.labels ?? [],
            }))}
            allTags={allLabels}
            onChanged={onChanged}
            createOpen={interactionDialogOpen}
            onCreateOpenChange={onInteractionDialogOpenChange}
          />
        }
      />

      <ImportantDatesSection person={person} allLabels={allLabels} onChanged={onChanged} />

      <Section
        surface="card"
        title="Tasks"
        actionSlot={<SectionAdd iconSlot={<SquareCheck />} onPress={() => setTaskDialogOpen(true)} />}
        contentSlot={
          <TaskList
            personId={person.id}
            tasks={(person.tasks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              notes: t.notes,
              dueAt: t.dueAt,
              completedAt: t.completedAt,
              createdAt: t.createdAt,
            }))}
            onAdd={onChanged}
            onDelete={onChanged}
            onUpdate={onChanged}
            createOpen={taskDialogOpen}
            onCreateOpenChange={setTaskDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Gratitude"
        actionSlot={<SectionAdd iconSlot={<Heart />} onPress={() => setGratitudeDialogOpen(true)} />}
        contentSlot={
          <PersonGratitudes
            personId={person.id}
            gratitudes={person.gratitudes ?? []}
            onChanged={onChanged}
            createOpen={gratitudeDialogOpen}
            onCreateOpenChange={setGratitudeDialogOpen}
          />
        }
      />

      {mentionedInNotes.length > 0 ? (
        <Section surface="card" title="Mentioned In" contentSlot={<PersonMentionedIn notes={mentionedInNotes} />} />
      ) : null}
    </View>
  );
}
