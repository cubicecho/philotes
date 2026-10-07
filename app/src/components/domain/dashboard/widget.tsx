import { Link } from 'expo-router';
import { CardLayout } from '@/components/card-layout';
import { EmptyState } from '@/components/page';
import { Button } from '@/components/ui/button';
import type { SlotNode } from '@/lib/utils';

interface WidgetProps {
  iconSlot: SlotNode;
  title: string;
  description?: string;
  actionHref?: string;
  /** What the card says when `contentSlot` has no rows. The tick is added here. */
  emptyTitle: string;
  /** The rows. An empty array shows `emptyTitle` instead. */
  contentSlot: SlotNode;
}

/** Shared dashboard card shell: quiet header, no per-widget pagination. */
export function Widget({ iconSlot, title, description, actionHref, emptyTitle, contentSlot }: WidgetProps) {
  return (
    <CardLayout
      className="h-full"
      level={2}
      iconSlot={iconSlot}
      title={title}
      description={description}
      actionSlot={
        actionHref ? (
          <Button size="xs" variant="outline" linkSlot={<Link href={actionHref} />} content="View all" />
        ) : null
      }
      contentSlot={contentSlot}
      emptySlot={<EmptyState compact title={`${emptyTitle} ✓`} />}
    />
  );
}
