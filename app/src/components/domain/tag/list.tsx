import { useFragment } from '@apollo/client';
import { Tag, Trash2 } from 'lucide-react';
import { graphql } from '@/__generated__/gql';
import type { Tag_ListFragment } from '@/__generated__/graphql.ts';
import { ListLayout } from '@/components/layouts/list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner.tsx';

export const TAG_LIST = graphql(`
  fragment Tag_List on Label {
    id
    color
    label
  }
`);

interface TagRowProps {
  tag: Tag_ListFragment;
  onClickDelete: (id: string) => void;
}

function TagRow({ tag: from, onClickDelete }: TagRowProps) {
  const { data: tag, complete } = useFragment({
    fragment: TAG_LIST,
    from,
  });

  if (!complete) {
    return <Spinner />;
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 rounded-full border"
            style={{ backgroundColor: tag.color }}
            aria-hidden="true"
          />
          <p className="font-medium">{tag.label}</p>
          <p className="text-muted-foreground text-sm">{tag.color}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onClickDelete(tag.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

interface TagListProps {
  labels: Array<Tag_ListFragment>;
  onClickAdd: () => void;
  onClickDelete: (id: string) => void;
}

export function TagList({ labels, onClickAdd, onClickDelete }: TagListProps) {
  return (
    <ListLayout
      header={
        <>
          <h1 className="font-bold text-3xl">Tags</h1>
          <Button onClick={onClickAdd}>
            <Tag className="mr-2 h-4 w-4" />
            Add Tag
          </Button>
        </>
      }
      body={
        <div className="grid gap-4">
          {labels.map((tag) => (
            <TagRow key={tag.id} tag={tag} onClickDelete={onClickDelete} />
          ))}
        </div>
      }
    />
  );
}
