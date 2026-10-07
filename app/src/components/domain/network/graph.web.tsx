import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Button } from '@/components/ui/button';
import { nameToColor } from '@/lib/name-color';
import { fullName } from '@/lib/person-name';
import type { NetworkGraphProps, NetworkPerson } from './types';

type SimNode = d3.SimulationNodeDatum & NetworkPerson;

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: string;
};

type TooltipState = {
  x: number;
  y: number;
  person: NetworkPerson;
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

/**
 * The force-directed graph. d3 owns the `<svg>` — it builds, zooms and drags the nodes itself — so
 * this is the one DOM element in the app, kept to this web-only file. Everything around it (the
 * measured box, the reset button, the tooltip) is React Native.
 */
export function NetworkGraph({ persons, onOpenPerson }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Read through a ref so a new callback identity does not rebuild the simulation.
  const onOpenPersonRef = useRef(onOpenPerson);
  onOpenPersonRef.current = onOpenPerson;

  // The simulation is laid out once, for the first measured box; later resizes only re-centre it.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const measured = size.width > 0 && size.height > 0;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !measured || persons.length === 0) {
      return;
    }

    const { width, height } = sizeRef.current;

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

    // Clear previous render
    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl);

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
    svg.call(zoom);

    // Start fully zoomed out to show all nodes
    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.5)
        .translate(-width / 2, -height / 2),
    );

    // ── Force simulation ────────────────────────────────────────────────────
    // Longer link distances for well-connected nodes so clusters breathe
    const simulation = d3
      .forceSimulation<SimNode, SimLink>(nodes)
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

    simulationRef.current = simulation;

    // ── Edge lines ──────────────────────────────────────────────────────────
    const link = container
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--muted-foreground)')
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
      .attr('fill', 'var(--popover)')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.9);

    // Label text
    edgeLabelGroups
      .append('text')
      .text((d) => d.type)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'var(--popover-foreground)')
      .attr('font-size', '9px')
      .style('user-select', 'none');

    // Size each pill rect to fit its text (approximate via getBBox)
    edgeLabelGroups.each(function () {
      const g = d3.select(this);
      const textEl = g.select('text').node() as SVGTextElement | null;
      if (!textEl) {
        return;
      }
      const bbox = textEl.getBBox();
      const pad = { x: 4, y: 2 };
      g.select('rect')
        .attr('x', -bbox.width / 2 - pad.x)
        .attr('y', -bbox.height / 2 - pad.y)
        .attr('width', bbox.width + pad.x * 2)
        .attr('height', bbox.height + pad.y * 2);
    });

    // The tooltip is positioned inside the graph's own box, so the pointer is read against the svg.
    const pointerIn = (event: MouseEvent) => {
      const [x, y] = d3.pointer(event, svgEl);
      return { x, y };
    };

    // ── Node groups ─────────────────────────────────────────────────────────
    const nodeGroup = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: SimNode) => {
        onOpenPersonRef.current(d.id);
      })
      .on('mouseenter', (event: MouseEvent, d: SimNode) => {
        setTooltip({ ...pointerIn(event), person: d });
      })
      .on('mousemove', (event: MouseEvent) => {
        const point = pointerIn(event);
        setTooltip((prev) => (prev ? { ...prev, ...point } : prev));
      })
      .on('mouseleave', () => {
        setTooltip(null);
      });

    // Apply drag — stopPropagation prevents drag events from bubbling to zoom
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        event.sourceEvent.stopPropagation();
        if (!event.active) {
          simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    const nodeColor = (d: SimNode) => d.labels[0]?.color ?? nameToColor(fullName(d));

    // Outer ring for well-connected hub nodes (drawn before main circle so it sits underneath)
    nodeGroup
      .filter((d) => (connectionCount.get(d.id) ?? 0) > 3)
      .append('circle')
      .attr('r', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + 4)
      .attr('fill', 'none')
      .attr('stroke', nodeColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('pointer-events', 'none');

    // Main filled circle
    nodeGroup
      .append('circle')
      .attr('r', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0))
      .attr('fill', nodeColor)
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
      .text((d) => fullName(d))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('fill', 'var(--foreground)')
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
        if (angle > 90 || angle < -90) {
          angle += 180;
        }
        return `translate(${mx},${my}) rotate(${angle})`;
      });

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
      setTooltip(null);
    };
  }, [persons, measured]);

  // A resized box keeps the laid-out graph and pulls it toward the new middle.
  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation || size.width === 0 || size.height === 0) {
      return;
    }
    simulation.force('center', d3.forceCenter(size.width / 2, size.height / 2).strength(0.05));
    simulation.alpha(0.3).restart();
  }, [size.width, size.height]);

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <View
      className="relative min-h-96 flex-1 overflow-hidden"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {/* Sized from the measured box: an svg has no intrinsic size for flex to work from. */}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        role="img"
        aria-label="Network of people and their relationships"
        style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
      />

      <View className="absolute top-3 right-3">
        <Button variant="outline" size="xs" content="Reset zoom" onPress={handleResetZoom} />
      </View>

      {tooltip && (
        <View
          pointerEvents="none"
          className="absolute min-w-40 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}
        >
          <Text className="font-semibold text-popover-foreground text-sm">
            {tooltip.person.firstName} {tooltip.person.lastName}
          </Text>
          {tooltip.person.email ? (
            <Text className="mt-0.5 text-muted-foreground text-xs">{tooltip.person.email}</Text>
          ) : null}
          {tooltip.person.labels.length > 0 && (
            <View className="mt-1.5 flex-row flex-wrap gap-1">
              {tooltip.person.labels.map((lbl) => (
                <LabelChip key={lbl.id} label={lbl.label} color={lbl.color} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
