import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ImportantDatesMilestoneTypeEnum } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import { ConfirmButton } from '@/components/confirm-button';
import type { PersonStub } from '@/components/domain/person/detail-queries';
import {
  ImportantDateForm,
  type ImportantDateFormValue,
  MILESTONE_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
} from '@/components/domain/person/important-date-form';
import { ImportantDatePersons } from '@/components/domain/person/important-date-persons';
import { ATTACH_IMPORTANT_DATE_TAG, DETACH_IMPORTANT_DATE_TAG } from '@/components/domain/person/tag-mutations';
import { RowTags, type TagOption } from '@/components/domain/person/tag-picker';
import { Badge } from '@/components/ui/badge';
import { FormDialog } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { parseLocalDay } from '@/lib/local-date';

const UPDATE_IMPORTANT_DATE = graphql(`
  mutation UpdateImportantDate(
    $id: UUID!
    $name: String!
    $date: String!
    $description: String
    $recurrence: String
    $milestoneType: ImportantDatesMilestoneTypeEnum
  ) {
    updateImportantDate(
      set: {
        name: $name
        date: $date
        description: $description
        recurrence: $recurrence
        milestoneType: $milestoneType
      }
      where: { id: { eq: $id } }
    ) {
      id
      name
      date
      description
      recurrence
      milestoneType
    }
  }
`);

interface ImportantDateRowProps {
  id: string;
  /** The person the date belongs to; with `id` it makes the link to the date's own page. */
  personId: string;
  name: string;
  /** The day as `yyyy-MM-dd`. */
  date: string;
  description: string | null | undefined;
  recurrence: string | null | undefined;
  milestoneType: string | null | undefined;
  /** The tags attached to this date. */
  tags: TagOption[];
  /** Every tag the user has. */
  allTags: TagOption[];
  /** The other people the date involves. */
  taggedPersons: PersonStub[];
  /** Everyone who can be tagged on the date. */
  taggablePersons: PersonStub[];
  /** Called with the date's id once the removal is confirmed; the owner deletes it. */
  onDelete: (id: string) => void;
  /** Called after an edit is saved. */
  onEdit: () => void;
  /** Called after a tag is attached or detached, or a person tagged or untagged. */
  onTagChanged: () => void;
}

/**
 * One important date: its name linking to its page, its day, recurrence and milestone, its tags, the other people it
 * involves, and the dialog that edits it.
 */
export function ImportantDateRow({
  id,
  personId,
  name,
  date,
  description,
  recurrence,
  milestoneType,
  tags,
  allTags,
  taggedPersons,
  taggablePersons,
  onDelete,
  onEdit,
  onTagChanged,
}: ImportantDateRowProps) {
  const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label;
  const milestoneLabel = MILESTONE_TYPE_OPTIONS.find((o) => o.value === milestoneType)?.label;
  const [editOpen, setEditOpen] = useState(false);
  const [attachTag] = useMutation(ATTACH_IMPORTANT_DATE_TAG);
  const [detachTag] = useMutation(DETACH_IMPORTANT_DATE_TAG);
  const [updateImportantDate] = useMutation(UPDATE_IMPORTANT_DATE);

  const handleEdit = async (values: ImportantDateFormValue) => {
    // The form holds the milestone as a plain string; only one the schema knows is sent.
    const milestoneType = Object.values(ImportantDatesMilestoneTypeEnum).find(
      (known) => known === values.milestoneType,
    );
    await updateImportantDate({
      variables: {
        id,
        name: values.name,
        date: values.date,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType: milestoneType ?? null,
      },
    });
    setEditOpen(false);
    onEdit();
  };

  return (
    <>
      <View className="rounded-md border border-foreground/10 px-3 py-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Link
                href={`/persons/${personId}/dates/${id}`}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {name}
              </Link>
              {description && <Text className="text-xs text-foreground/60">{description}</Text>}
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs text-foreground/60">{parseLocalDay(date)?.toLocaleDateString() ?? date}</Text>
              {recurrenceLabel && <Badge variant="secondary">{recurrenceLabel}</Badge>}
              {milestoneLabel && <Badge variant="info">{milestoneLabel}</Badge>}
            </View>
          </View>
          <View className="shrink-0 flex-row">
            <ActionButton
              label="Edit important date"
              variant="ghost"
              size="icon-sm"
              iconSlot={<Pencil />}
              onPress={() => setEditOpen(true)}
            />
            <ConfirmButton
              label="Remove important date"
              variant="ghost"
              size="icon-sm"
              iconSlot={<Trash2 />}
              title={`Remove ${name}?`}
              description="The date leaves the timeline, the dashboard and the calendar feed, with its tags and description."
              confirmLabel="Remove"
              onConfirm={() => onDelete(id)}
            />
          </View>
        </View>
        <View className="mt-1.5 gap-1.5">
          <RowTags
            tags={tags}
            allTags={allTags}
            onAttach={(labelId) => attachTag({ variables: { importantDateId: id, labelId } })}
            onDetach={(labelId) => detachTag({ variables: { importantDateId: id, labelId } })}
            onChanged={onTagChanged}
          />
          <ImportantDatePersons
            importantDateId={id}
            taggedPersons={taggedPersons}
            candidates={taggablePersons}
            onChanged={onTagChanged}
          />
        </View>
      </View>

      <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Important Date">
        <ImportantDateForm
          initialValues={{
            name,
            date,
            description: description ?? undefined,
            recurrence: recurrence ?? undefined,
            milestoneType: milestoneType ?? undefined,
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </FormDialog>
    </>
  );
}
