import { Text } from 'react-native';
import { Page } from '@/components/page';
import type { SlotNode } from '@/lib/utils';

type DetailPageProps<T> = {
  /** The loaded entity, or null/undefined while loading or when missing. */
  entity: T | null | undefined;
  loading?: boolean;
  /** Shown when the entity is absent and not loading. */
  notFoundLabel: string;
  className?: string;
  /** Rendered only once the entity is present, so it is non-null inside. */
  contentSlot: (entity: T) => SlotNode;
};

export function DetailPage<T>({ entity, loading, notFoundLabel, className, contentSlot }: DetailPageProps<T>) {
  return (
    <Page
      {...(className ? { className } : {})}
      contentSlot={
        entity ? (
          contentSlot(entity)
        ) : (
          <Text className="text-foreground/60">{loading ? 'Loading…' : notFoundLabel}</Text>
        )
      }
    />
  );
}
