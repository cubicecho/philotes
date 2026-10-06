import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { ImportantDatesMilestoneTypeEnum } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import {
  ImportantDateForm,
  type ImportantDateFormValue,
  MILESTONE_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
} from '@/components/domain/person/important-date-form';
import { ImportantDateTags } from '@/components/domain/person/important-date-tags';
import type { TagOption } from '@/components/domain/person/tag-picker';
import { Badge } from '@/components/ui/badge';
import { FormDialog } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';

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
  personId: string;
  name: string;
  date: string;
  description: string | null | undefined;
  recurrence: string | null | undefined;
  milestoneType: string | null | undefined;
  tags: TagOption[];
  allTags: TagOption[];
  onDelete: (id: string) => void;
  onEdit: () => void;
  onTagChanged: () => void;
}

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
  onDelete,
  onEdit,
  onTagChanged,
}: ImportantDateRowProps) {
  const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label;
  const milestoneLabel = MILESTONE_TYPE_OPTIONS.find((o) => o.value === milestoneType)?.label;
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [updateImportantDate] = useMutation(UPDATE_IMPORTANT_DATE, {
    refetchQueries: [],
  });

  const handleEdit = async (values: ImportantDateFormValue) => {
    await updateImportantDate({
      variables: {
        id,
        name: values.name,
        date: values.date,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType: (values.milestoneType as ImportantDatesMilestoneTypeEnum | null) ?? null,
      },
    });
    setEditOpen(false);
    onEdit();
  };

  return (
    <>
      <View className="rounded-md border border-border px-3 py-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Link
                href={`/persons/${personId}/dates/${id}`}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {name}
              </Link>
              {description && <Text className="text-xs text-muted-foreground">{description}</Text>}
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString()}</Text>
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
            <ActionButton
              label="Remove important date"
              variant="ghost"
              size="icon-sm"
              iconSlot={<Trash2 />}
              onPress={() => onDelete(id)}
            />
          </View>
        </View>
        <ImportantDateTags
          importantDateId={id}
          tags={tags}
          allTags={allTags}
          showAdd={showAddTag}
          onShowAdd={setShowAddTag}
          onChanged={onTagChanged}
        />
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
