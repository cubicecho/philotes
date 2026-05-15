import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { Label_ListFragment, CreateLabelInput } from '@/__generated__/graphql';
import { LabelList } from '@/components/domain/label/list';
import { TagForm } from '@/components/domain/tag/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner.tsx';

const GET_TAGS = graphql(`
  query GetTags {
    labels {
      __typename
      id
      ...Label_List
    }
  }
`);

const CREATE_TAG = graphql(`
  mutation CreateTag($values: CreateLabelInput!) {
    createLabel(values: $values) {
      __typename
      id
      ...Label_List
    }
  }
`);

const DELETE_TAG = graphql(`
  mutation DeleteTag($id: String!) {
    deleteLabels(where: { id: { eq: $id } }) {
      __typename
      id
    }
  }
`);

const UPDATE_TAG = graphql(`
  mutation UpdateTag($id: String!, $label: String!, $color: String!) {
    updateLabels(
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
  mutation MergeLabelInto($keepId: String!, $deleteId: String!) {
    mergeLabelInto(keepId: $keepId, deleteId: $deleteId) {
      __typename
      id
      label
      color
    }
  }
`);

export default function TagsPage() {
  const { data, loading, error, refetch } = useQuery(GET_TAGS);
  const [createTag] = useMutation(CREATE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
  });
  const [deleteTag] = useMutation(DELETE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
  });
  const [updateTag] = useMutation(UPDATE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
  });
  const [mergeLabelInto] = useMutation(MERGE_LABEL_INTO);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label_ListFragment | null>(null);
  const [mergingLabel, setMergingLabel] = useState<Label_ListFragment | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  const handleDelete = async (id: string) => {
    await deleteTag({ variables: { id } });
  };

  const handleCreate = async (values: CreateLabelInput): Promise<void> => {
    await createTag({ variables: { values } });
    setCreateDialogOpen(false);
  };

  const handleEdit = async (values: CreateLabelInput): Promise<void> => {
    if (!editingLabel) return;
    await updateTag({
      variables: { id: editingLabel.id, label: values.label, color: values.color },
    });
    setEditingLabel(null);
  };

  const handleMergeConfirm = async (): Promise<void> => {
    if (!mergingLabel || !mergeTargetId) return;
    await mergeLabelInto({
      variables: { keepId: mergeTargetId, deleteId: mergingLabel.id },
    });
    setMergingLabel(null);
    setMergeTargetId('');
    await refetch();
  };

  const otherLabels = (data?.labels ?? []).filter((l) => l.id !== mergingLabel?.id);

  if (loading) return <Spinner />;
  if (error) return <p>Error loading tags: {error.message}</p>;

  return (
    <>
      {/* Create dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Tag</DialogTitle>
            <DialogDescription>Add a new tag to your CRM.</DialogDescription>
          </DialogHeader>
          <TagForm onSubmit={handleCreate} onCancel={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editingLabel !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLabel(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Rename or recolor this tag.</DialogDescription>
          </DialogHeader>
          {editingLabel && (
            <TagForm
              key={editingLabel.id}
              initialValues={{ label: editingLabel.label, color: editingLabel.color }}
              onSubmit={handleEdit}
              onCancel={() => setEditingLabel(null)}
              submitLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog
        open={mergingLabel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMergingLabel(null);
            setMergeTargetId('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge tag</DialogTitle>
            <DialogDescription>
              Choose the tag to merge &ldquo;{mergingLabel?.label}&rdquo; into. All items tagged with &ldquo;
              {mergingLabel?.label}&rdquo; will be re-tagged with the chosen tag, and &ldquo;{mergingLabel?.label}
              &rdquo; will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label htmlFor="merge-target" className="text-sm font-medium leading-none">
                Merge into
              </label>
              <select
                id="merge-target"
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a tag…</option>
                {otherLabels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setMergingLabel(null);
                  setMergeTargetId('');
                }}
              >
                Cancel
              </Button>
              <Button disabled={!mergeTargetId} onClick={handleMergeConfirm}>
                Merge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LabelList
        labels={data?.labels ?? []}
        onClickAdd={() => setCreateDialogOpen(true)}
        onClickDelete={handleDelete}
        onClickEdit={setEditingLabel}
        onClickMerge={(label) => {
          setMergingLabel(label);
          setMergeTargetId('');
        }}
      />
    </>
  );
}
