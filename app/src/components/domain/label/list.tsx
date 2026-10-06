import { useFragment } from '@apollo/client';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { Label_ListFragment } from '@/__generated__/graphql.ts';
import { ActionButton } from '@/components/action-button';
import { GitMerge } from '@/components/app-icons';
import { LabelChip } from '@/components/domain/label/label-chip';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { Button } from '@/components/ui/button';
import { Pencil, Tag, Trash2 } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';

const LABEL_LIST = graphql(`
  fragment Label_List on Label {
    id
    color
    label
  }
`);

interface LabelRowProps {
  label: Label_ListFragment;
  divided: boolean;
  onClickDelete: (id: string) => void;
  onClickEdit?: (label: Label_ListFragment) => void;
  onClickMerge?: (label: Label_ListFragment) => void;
}

function LabelRow({ label: from, divided, onClickDelete, onClickEdit, onClickMerge }: LabelRowProps) {
  const { data: label, complete } = useFragment({
    fragment: LABEL_LIST,
    from,
  });

  if (!complete) {
    return <Spinner />;
  }

  return (
    <ListItem
      className={divided ? 'rounded-none border-border/60 border-t' : undefined}
      leadingSlot={<LabelChip label={label.label} color={label.color} />}
      title={label.color}
      titleClassName="font-mono font-normal text-muted-foreground text-xs"
      actionSlot={
        <>
          {onClickEdit && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Edit ${label.label}`}
              iconSlot={<Pencil />}
              onPress={() => onClickEdit(label)}
            />
          )}
          {onClickMerge && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Merge ${label.label}`}
              iconSlot={<GitMerge />}
              onPress={() => onClickMerge(label)}
            />
          )}
          <ActionButton
            variant="ghost"
            size="icon-sm"
            label={`Delete ${label.label}`}
            iconSlot={<Trash2 />}
            onPress={() => onClickDelete(label.id)}
          />
        </>
      }
    />
  );
}

interface LabelListProps {
  labels: Array<Label_ListFragment>;
  onClickAdd: () => void;
  onClickDelete: (id: string) => void;
  onClickEdit?: (label: Label_ListFragment) => void;
  onClickMerge?: (label: Label_ListFragment) => void;
}

/** The labels screen: it is its own `PageLayout`, so a route renders it as the whole page. */
export function LabelList({ labels, onClickAdd, onClickDelete, onClickEdit, onClickMerge }: LabelListProps) {
  return (
    <PageLayout
      title="Labels"
      actionSlot={<Button content="Add Label" iconSlot={<Tag />} onPress={onClickAdd} />}
      contentSlot={
        labels.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No labels yet"
            description="Labels help you group people — Friends, Work, Book Club…"
          />
        ) : (
          <View role="list">
            {labels.map((label, index) => (
              <View key={label.id} role="listitem">
                <LabelRow
                  label={label}
                  divided={index > 0}
                  onClickDelete={onClickDelete}
                  onClickEdit={onClickEdit}
                  onClickMerge={onClickMerge}
                />
              </View>
            ))}
          </View>
        )
      }
    />
  );
}
