import { useFragment } from '@apollo/client';
import { GitMerge, Pencil, Tag, Trash2 } from 'lucide-react';
import { graphql } from '@/__generated__/gql';
import type { Label_ListFragment } from '@/__generated__/graphql.ts';
import { ListLayout } from '@/components/layouts/list';
import { Button } from '@/components/ui/button';
import { LabelChip } from '@/components/ui/label-chip';
import { Spinner } from '@/components/ui/spinner.tsx';

const LABEL_LIST = graphql(`
  fragment Label_List on Label {
    id
    color
    label
  }
`);

interface LabelRowProps {
  label: Label_ListFragment;
  onClickDelete: (id: string) => void;
  onClickEdit?: (label: Label_ListFragment) => void;
  onClickMerge?: (label: Label_ListFragment) => void;
}

function LabelRow({ label: from, onClickDelete, onClickEdit, onClickMerge }: LabelRowProps) {
  const { data: label, complete } = useFragment({
    fragment: LABEL_LIST,
    from,
  });

  if (!complete) {
    return <Spinner />;
  }

  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <LabelChip label={label.label} color={label.color} />
        <p className="text-muted-foreground text-xs font-mono">{label.color}</p>
      </div>
      <div className="flex items-center">
        {onClickEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onClickEdit(label)}
            aria-label={`Edit ${label.label}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onClickMerge && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onClickMerge(label)}
            aria-label={`Merge ${label.label}`}
          >
            <GitMerge className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"
          onClick={() => onClickDelete(label.id)}
          aria-label={`Delete ${label.label}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface LabelListProps {
  labels: Array<Label_ListFragment>;
  onClickAdd: () => void;
  onClickDelete: (id: string) => void;
  onClickEdit?: (label: Label_ListFragment) => void;
  onClickMerge?: (label: Label_ListFragment) => void;
}

export function LabelList({ labels, onClickAdd, onClickDelete, onClickEdit, onClickMerge }: LabelListProps) {
  return (
    <ListLayout
      spacing={false}
      header={
        <div className="flex items-center justify-between pt-3">
          <h1 className="font-bold text-2xl tracking-tight">Labels</h1>
          <Button onClick={onClickAdd}>
            <Tag className="mr-2 h-4 w-4" />
            Add Label
          </Button>
        </div>
      }
      body={
        labels.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <p>No labels yet. Labels help you group people — Friends, Work, Book Club…</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                onClickDelete={onClickDelete}
                onClickEdit={onClickEdit}
                onClickMerge={onClickMerge}
              />
            ))}
          </div>
        )
      }
    />
  );
}
