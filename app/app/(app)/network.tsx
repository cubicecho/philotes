import { useQuery } from '@apollo/client';
import { useRouter } from 'expo-router';
import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { graphql } from '@/__generated__/gql.js';

const GET_NETWORK_DATA = graphql(`
  query GetNetworkData {
    persons {
      id
      firstName
      lastName
      email
      avatarPath
      labels {
        id
        label
        color
      }
      relationshipsFrom {
        id
        toPersonId
        type
      }
    }
  }
`);

// djb2 hash → hsl color
function nameToColor(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

type PersonLabel = {
  id: string;
  label: string;
  color: string;
};

type RelationshipFrom = {
  id: string;
  toPersonId: string;
  type: string;
};

type PersonNode = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath?: string | null;
  labels: PersonLabel[];
  relationshipsFrom: RelationshipFrom[];
};

type SimNode = d3.SimulationNodeDatum & PersonNode;

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: string;
};

type TooltipState = {
  x: number;
  y: number;
  person: PersonNode;
} | null;

function getNodeRadius(connections: number): number {
  const min = 18;
  const max = 32;
  const clamped = Math.min(connections, 10);
  return min + ((max - min) * clamped) / 10;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function NetworkPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const { data, loading, error } = useQuery(GET_NETWORK_DATA);

  useEffect(() => {
    if (!data?.persons || !svgRef.current) return;

    const persons = data.persons as PersonNode[];

    if (persons.length === 0) return;

    const svgEl = svgRef.current;
    const width = svgEl.clientWidth || 1000;
    const height = svgEl.clientHeight || 700;

    // Build connection count map
    const connectionCount = new Map<string, number>();
    for (const p of persons) {
      if (!connectionCount.has(p.id)) connectionCount.set(p.id, 0);
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
        if (!seenEdges.has(edgeKey) && nodeIndex.has(rel.toPersonId)) {
          seenEdges.add(edgeKey);
          links.push({
            source: p.id,
            target: rel.toPersonId,
            type: rel.type,
          });
        }
      }
    }

    // Clear previous render
    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl).attr('width', width).attr('height', height);

    // All drawn content lives here so zoom/pan transforms it as one unit
    const container = svg.append('g').attr('class', 'zoom-container');

    // Zoom + pan behaviour
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString());
      });

    zoomRef.current = zoom;
    d3.select(svgEl).call(zoom);

    // Start fully zoomed out to show all nodes
    d3.select(svgEl).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.5)
        .translate(-width / 2, -height / 2),
    );

    // ── Force simulation ────────────────────────────────────────────────────
    // Longer link distances for well-connected nodes so clusters breathe
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const sc = connectionCount.get((d.source as SimNode).id) ?? 0;
            const tc = connectionCount.get((d.target as SimNode).id) ?? 0;
            return 120 + (sc + tc) * 8;
          })
          .strength(0.5),
      )
      .force(
        'charge',
        d3.forceManyBody<SimNode>().strength((d) => -300 - (connectionCount.get(d.id) ?? 0) * 30),
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collide', d3.forceCollide<SimNode>((d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + 50).strength(1))
      .alphaDecay(0.02) // slower cooling = better final layout
      .velocityDecay(0.4);

    // ── Edge lines ──────────────────────────────────────────────────────────
    const link = container
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .style('cursor', 'default');

    // ── Edge label groups (pill background + rotated text) ──────────────────
    const edgeLabelGroups = container
      .append('g')
      .attr('class', 'edge-labels')
      .selectAll<SVGGElement, SimLink>('g')
      .data(links)
      .join('g')
      .attr('pointer-events', 'none');

    // Background pill
    edgeLabelGroups
      .append('rect')
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#1e293b')
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.9);

    // Label text
    edgeLabelGroups
      .append('text')
      .text((d) => d.type)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#f1f5f9')
      .attr('font-size', '9px')
      .style('user-select', 'none');

    // Size each pill rect to fit its text (approximate via getBBox)
    edgeLabelGroups.each(function () {
      const g = d3.select(this);
      const textEl = g.select('text').node() as SVGTextElement | null;
      if (!textEl) return;
      const bbox = textEl.getBBox();
      const pad = { x: 4, y: 2 };
      g.select('rect')
        .attr('x', -bbox.width / 2 - pad.x)
        .attr('y', -bbox.height / 2 - pad.y)
        .attr('width', bbox.width + pad.x * 2)
        .attr('height', bbox.height + pad.y * 2);
    });

    // ── Node groups ─────────────────────────────────────────────────────────
    const nodeGroup = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: SimNode) => {
        router.push(`/persons/${d.id}`);
      })
      .on('mouseenter', (event: MouseEvent, d: SimNode) => {
        setTooltip({ x: event.clientX, y: event.clientY, person: d });
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
      })
      .on('mouseleave', () => {
        setTooltip(null);
      });

    // Apply drag — stopPropagation prevents drag events from bubbling to zoom
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        event.sourceEvent.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    // Outer ring for well-connected hub nodes (drawn before main circle so it sits underneath)
    nodeGroup
      .filter((d) => (connectionCount.get(d.id) ?? 0) > 3)
      .append('circle')
      .attr('r', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.labels && d.labels.length > 0) return d.labels[0].color;
        return nameToColor(`${d.firstName} ${d.lastName}`);
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('pointer-events', 'none');

    // Main filled circle
    nodeGroup
      .append('circle')
      .attr('r', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0))
      .attr('fill', (d) => {
        if (d.labels && d.labels.length > 0) {
          return d.labels[0].color;
        }
        return nameToColor(`${d.firstName} ${d.lastName}`);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Initials text centred inside the circle
    nodeGroup
      .append('text')
      .text((d) => getInitials(d.firstName, d.lastName))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', (d) => {
        const r = getNodeRadius(connectionCount.get(d.id) ?? 0);
        return `${Math.floor(r * 0.6)}px`;
      })
      .attr('pointer-events', 'none');

    // Full name label below node — paint-order halo keeps it readable over any bg
    nodeGroup
      .append('text')
      .text((d) => `${d.firstName} ${d.lastName}`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('fill', 'currentColor')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('y', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + 6)
      .attr('pointer-events', 'none')
      .style('user-select', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--background, white)')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round');

    // ── Tick handler ────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      edgeLabelGroups.attr('transform', (d) => {
        const sx = (d.source as SimNode).x ?? 0;
        const sy = (d.source as SimNode).y ?? 0;
        const tx = (d.target as SimNode).x ?? 0;
        const ty = (d.target as SimNode).y ?? 0;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        // Rotate text to follow edge direction (flip if upside-down)
        let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        return `translate(${mx},${my}) rotate(${angle})`;
      });

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading network...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">Error: {error.message}</p>;
  }

  const persons = data?.persons ?? [];

  if (persons.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No contacts yet.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: '80vh' }}>
      <svg ref={svgRef} className="w-full h-full" style={{ display: 'block' }} />

      {/* Reset zoom button */}
      <button
        type="button"
        className="absolute top-3 right-3 z-10 bg-background border border-border rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground shadow-sm"
        onClick={() => {
          if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);
          }
        }}
      >
        Reset zoom
      </button>

      {/* Node tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-popover-foreground min-w-40"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}
        >
          <p className="font-semibold text-sm">
            {tooltip.person.firstName} {tooltip.person.lastName}
          </p>
          {tooltip.person.email && <p className="text-xs text-muted-foreground mt-0.5">{tooltip.person.email}</p>}
          {tooltip.person.labels && tooltip.person.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tooltip.person.labels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: lbl.color }}
                >
                  {lbl.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
