import type * as d3 from 'd3';
import { NETWORK_GRAPH_DEFAULTS } from '@/lib/defaults';
import type { NetworkPerson } from './types';

/** A person as a node of the d3 simulation, which adds the position and velocity. */
export type SimNode = d3.SimulationNodeDatum & NetworkPerson;

/** A relationship as a link of the simulation; `type` is the relationship's name, drawn on the edge. */
export type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: string;
};

/** The person under the pointer and where the pointer is in the graph's box; `null` over no one. */
export type TooltipState = {
  x: number;
  y: number;
  person: NetworkPerson;
} | null;

export const GRAPH = NETWORK_GRAPH_DEFAULTS;

/**
 * A link's end as a node. d3 holds the id the link was built with until the simulation swaps in the node.
 *
 * @param end - One end of a link.
 * @returns The node, or `null` while the end is still an id.
 */
export function resolvedNode(end: SimLink['source']): SimNode | null {
  const isResolved = typeof end === 'object';
  return isResolved ? end : null;
}

/**
 * The node id at a link's end, whether or not the simulation has swapped the node in yet.
 *
 * @param end - One end of a link.
 * @returns The id of the person at that end.
 */
export function linkEndId(end: SimLink['source']): string {
  return resolvedNode(end)?.id ?? String(end);
}

/**
 * A node's radius, which grows with the person's connections up to a ceiling.
 *
 * @param connections - How many relationships the person is part of, on either side.
 * @returns The radius in svg units, from `minNodeRadius` up to `maxNodeRadius` at `nodeRadiusFullAt` connections.
 */
export function getNodeRadius(connections: number): number {
  const { minNodeRadius, maxNodeRadius, nodeRadiusFullAt } = GRAPH;
  const counted = Math.min(connections, nodeRadiusFullAt);
  return minNodeRadius + ((maxNodeRadius - minNodeRadius) * counted) / nodeRadiusFullAt;
}

/** What the simulation is built from. */
export interface GraphData {
  nodes: SimNode[];
  links: SimLink[];
  /** How many relationships each person is part of, on either side, by person id. */
  connectionCount: Map<string, number>;
}

/**
 * Turns the people into the simulation's nodes and links. A pair of people gets one link however many
 * relationships join them, and a relationship to a person who is not in the list gets none.
 *
 * @param persons - Everyone to draw.
 * @returns The nodes, the links and each person's connection count.
 */
export function buildGraphData(persons: NetworkPerson[]): GraphData {
  // Build connection count map
  const connectionCount = new Map<string, number>();
  for (const p of persons) {
    const isUncounted = connectionCount.has(p.id) === false;
    if (isUncounted) {
      connectionCount.set(p.id, 0);
    }
    for (const rel of p.relationshipsFrom) {
      connectionCount.set(p.id, (connectionCount.get(p.id) ?? 0) + 1);
      connectionCount.set(rel.toPersonId, (connectionCount.get(rel.toPersonId) ?? 0) + 1);
    }
  }

  const nodes: SimNode[] = persons.map((p) => ({ ...p }));
  const nodeIndex = new Map<string, SimNode>(nodes.map((n) => [n.id, n]));

  const links: SimLink[] = [];
  const seenEdges = new Set<string>();
  for (const p of persons) {
    for (const rel of p.relationshipsFrom) {
      const edgeKey = [p.id, rel.toPersonId].sort().join('--');
      const isNewEdge = seenEdges.has(edgeKey) === false && nodeIndex.has(rel.toPersonId);
      if (isNewEdge) {
        seenEdges.add(edgeKey);
        links.push({
          source: p.id,
          target: rel.toPersonId,
          type: rel.type,
        });
      }
    }
  }

  return { nodes, links, connectionCount };
}
