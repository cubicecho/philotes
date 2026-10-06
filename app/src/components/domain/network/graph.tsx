import { Share2 } from '@/components/app-icons';
import { EmptyState } from '@/components/page';
import type { NetworkGraphProps } from './types';

/** The graph is drawn by d3 into an `<svg>`, which only the web has: see `graph.web.tsx`. */
export function NetworkGraph(_props: NetworkGraphProps) {
  return (
    <EmptyState
      icon={Share2}
      title="The network graph is on the web"
      description="Open Philotes in a browser to explore how your people connect."
    />
  );
}
