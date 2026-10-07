import { useFragment } from '@apollo/client';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { Label_ListFragment } from '@/__generated__/graphql.ts';
import { ActionButton } from '@/components/action-button';
import { GitMerge } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
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
  /** Whether the row is set off from the one above it. */
  divided: boolean;
  /** Called with the label's id once the delete is confirmed; the owner deletes it. */
  onDeletePress: (id: string) => void;
  /** Called with the label when Edit is pressed; no Edit button is drawn without it. */
  onEditPress?: (label: Label_ListFragment) => void;
  /** Called with the label when Merge is pressed; no Merge button is drawn without it. */
  onMergePress?: (label: Label_ListFragment) => void;
}

/** One label: its chip, its hex colour and its edit, merge and delete buttons. */
function LabelRow({ label: from, divided, onDeletePress, onEditPress, onMergePress }: LabelRowProps) {
  const { data: label, complete } = useFragment({
    fragment: LABEL_LIST,
    from,
  });

  if (!complete) {
    return <Spinner />;
  }

  return (
    <ListItem
      className={divided ? 'rounded-none border-foreground/10 border-t' : undefined}
      leadingSlot={<LabelChip label={label.label} color={label.color} />}
      title={label.color}
      titleClassName="font-mono font-normal text-foreground/60 text-xs"
      actionSlot={
        <>
          {onEditPress && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Edit ${label.label}`}
              iconSlot={<Pencil />}
              onPress={() => onEditPress(label)}
            />
          )}
          {onMergePress && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Merge ${label.label}`}
              iconSlot={<GitMerge />}
              onPress={() => onMergePress(label)}
            />
          )}
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            label={`Delete ${label.label}`}
            iconSlot={<Trash2 />}
            title={`Delete ${label.label}?`}
            description="The label comes off every person, note, interaction and date that carries it. To keep those, merge it into another label instead."
            onConfirm={() => onDeletePress(label.id)}
          />
        </>
      }
    />
  );
}

interface LabelListProps {
  labels: Array<Label_ListFragment>;
  onAddPress: () => void;
  /** Called with a label's id once its delete is confirmed; the owner deletes it. */
  onDeletePress: (id: string) => void;
  /** Called with a label when its Edit is pressed; no Edit buttons are drawn without it. */
  onEditPress?: (label: Label_ListFragment) => void;
  /** Called with a label when its Merge is pressed; no Merge buttons are drawn without it. */
  onMergePress?: (label: Label_ListFragment) => void;
}

/** The labels screen: it is its own `PageLayout`, so a route renders it as the whole page. */
export function LabelList({ labels, onAddPress, onDeletePress, onEditPress, onMergePress }: LabelListProps) {
  return (
    <PageLayout
      title="Labels"
      actionSlot={<Button content="Add Label" iconSlot={<Tag />} onPress={onAddPress} />}
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
                  onDeletePress={onDeletePress}
                  onEditPress={onEditPress}
                  onMergePress={onMergePress}
                />
              </View>
            ))}
          </View>
        )
      }
    />
  );
}
