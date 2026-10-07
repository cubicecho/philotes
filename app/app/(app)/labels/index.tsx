import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { CreateLabelInput, Label_ListFragment } from '@/__generated__/graphql';
import { LabelForm } from '@/components/domain/label/form';
import { LabelList } from '@/components/domain/label/list';
import { LabelMergeDialog } from '@/components/domain/label/merge-dialog';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { FormDialog } from '@/components/ui/form-dialog';
import { invalidateQueryFields } from '@/lib/invalidate';

const GET_LABELS = graphql(`
  query GetLabels {
    labels {
      __typename
      id
      ...Label_List
    }
  }
`);

const CREATE_LABEL = graphql(`
  mutation CreateLabel($values: CreateLabelInput!) {
    createLabel(values: $values) {
      __typename
      id
      ...Label_List
    }
  }
`);

const DELETE_LABEL = graphql(`
  mutation DeleteLabel($id: UUID!) {
    deleteLabel(where: { id: { eq: $id } }) {
      __typename
      id
    }
  }
`);

const UPDATE_LABEL = graphql(`
  mutation UpdateLabel($id: UUID!, $label: String!, $color: String!) {
    updateLabel(
      set: { label: $label, color: $color }
      where: { id: { eq: $id } }
    ) {
      __typename
      id
      label
      color
    }
  }
`);

const MERGE_LABEL_INTO = graphql(`
  mutation MergeLabelInto($keepId: UUID!, $deleteId: UUID!) {
    mergeLabelInto(keepId: $keepId, deleteId: $deleteId) {
      __typename
      id
      label
      color
    }
  }
`);

export default function LabelsPage() {
  const { data, loading, error, refetch } = useQuery(GET_LABELS);
  const [createLabel] = useMutation(CREATE_LABEL, {
    refetchQueries: [{ query: GET_LABELS }],
  });
  // A person carries their labels, so every list of people is stale once a label goes.
  const [deleteLabel] = useMutation(DELETE_LABEL, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });
  const [updateLabel] = useMutation(UPDATE_LABEL, {
    refetchQueries: [{ query: GET_LABELS }],
  });
  const [mergeLabelInto] = useMutation(MERGE_LABEL_INTO, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label_ListFragment | null>(null);
  const [mergingLabel, setMergingLabel] = useState<Label_ListFragment | null>(null);

  const handleDelete = async (id: string) => {
    await deleteLabel({ variables: { id } });
  };

  const handleCreate = async (values: CreateLabelInput): Promise<void> => {
    await createLabel({ variables: { values } });
    setCreateDialogOpen(false);
  };

  const handleEdit = async (values: CreateLabelInput): Promise<void> => {
    if (!editingLabel) {
      return;
    }
    await updateLabel({
      variables: { id: editingLabel.id, label: values.label, color: values.color },
    });
    setEditingLabel(null);
  };

  const handleMerge = async (keepId: string): Promise<void> => {
    if (!mergingLabel) {
      return;
    }
    await mergeLabelInto({
      variables: { keepId, deleteId: mergingLabel.id },
    });
    setMergingLabel(null);
  };

  const otherLabels = (data?.labels ?? []).filter((l) => l.id !== mergingLabel?.id);

  // Only the first load: a refetch after a mutation keeps the list (and any open dialog) on screen.
  const pending = loading && !data;
  if (pending || error) {
    return (
      <PageLayout
        title="Labels"
        contentSlot={
          <QueryState
            query={{ isPending: pending, isError: error !== undefined, error, refetch }}
            what="your labels"
            count={data?.labels.length ?? 0}
          />
        }
      />
    );
  }

  return (
    <>
      <FormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="New Label"
        description="Add a new label to your CRM."
      >
        <LabelForm onSubmit={handleCreate} onCancel={() => setCreateDialogOpen(false)} />
      </FormDialog>

      <FormDialog
        open={editingLabel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingLabel(null);
          }
        }}
        title="Edit Label"
        description="Rename or recolor this label."
      >
        {editingLabel && (
          <LabelForm
            key={editingLabel.id}
            initialValues={{ label: editingLabel.label, color: editingLabel.color }}
            onSubmit={handleEdit}
            onCancel={() => setEditingLabel(null)}
            submitLabel="Save"
          />
        )}
      </FormDialog>

      <LabelMergeDialog
        label={mergingLabel}
        targets={otherLabels}
        onMerge={handleMerge}
        onClose={() => setMergingLabel(null)}
      />

      <LabelList
        labels={data?.labels ?? []}
        onAddPress={() => setCreateDialogOpen(true)}
        onDeletePress={handleDelete}
        onEditPress={setEditingLabel}
        onMergePress={setMergingLabel}
      />
    </>
  );
}
