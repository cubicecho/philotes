import { useFragment } from '@apollo/client';
import { GitMerge, Pencil, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { Label_ListFragment } from '@/__generated__/graphql.ts';
import { ListLayout } from '@/components/layouts/list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 rounded-full border"
            style={{ backgroundColor: label.color }}
            aria-hidden="true"
          />
          <p className="font-medium">{label.label}</p>
          <p className="text-muted-foreground text-sm">{label.color}</p>
        </div>
        <div className="flex items-center gap-1">
          {onClickEdit && (
            <Button variant="ghost" size="icon" onClick={() => onClickEdit(label)} aria-label={`Edit ${label.label}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onClickMerge && (
            <Button variant="ghost" size="icon" onClick={() => onClickMerge(label)} aria-label={`Merge ${label.label}`}>
              <GitMerge className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onClickDelete(label.id)}
            aria-label={`Delete ${label.label}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface LabelListProps {
  labels: Array<Label_ListFragment>;
  onClickAdd: () => void;
  onClickDelete: (id: string) => void;
  onClickEdit?: (label: Label_ListFragment) => void;
  onClickMerge?: (label: Label_ListFragment) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function LabelList({ labels, onClickAdd, onClickDelete, onClickEdit, onClickMerge }: LabelListProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(0);
  };

  const pageItems = labels.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pageItems.length < pageSize;

  return (
    <ListLayout
      header={
        <div className="flex items-center justify-between pt-3">
          <h1 className="font-bold text-3xl">Labels</h1>
          <Button onClick={onClickAdd}>
            <Tag className="mr-2 h-4 w-4" />
            Add Label
          </Button>
        </div>
      }
      body={
        <div className="grid gap-4">
          {pageItems.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              onClickDelete={onClickDelete}
              onClickEdit={onClickEdit}
              onClickMerge={onClickMerge}
            />
          ))}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="labels-page-size" className="text-xs text-muted-foreground">
              Per page
            </label>
            <select
              id="labels-page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Pagination className="w-auto mx-0 justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => p - 1)}
                  className={isFirstPage ? 'pointer-events-none opacity-50' : ''}
                  aria-disabled={isFirstPage}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => p + 1)}
                  className={isLastPage ? 'pointer-events-none opacity-50' : ''}
                  aria-disabled={isLastPage}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      }
    />
  );
}
