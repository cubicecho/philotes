import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Button } from '@/components/ui/button';
import { NETWORK_GRAPH_DEFAULTS } from '@/lib/defaults';
import { nameToColor } from '@/lib/name-color';
import { fullName } from '@/lib/person-name';
import type { NetworkGraphProps, NetworkPerson } from './types';

/** A person as a node of the d3 simulation, which adds the position and velocity. */
type SimNode = d3.SimulationNodeDatum & NetworkPerson;

/** A relationship as a link of the simulation; `type` is the relationship's name, drawn on the edge. */
type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: string;
};

/** The person under the pointer and where the pointer is in the graph's box; `null` over no one. */
type TooltipState = {
  x: number;
  y: number;
  person: NetworkPerson;
} | null;

const GRAPH = NETWORK_GRAPH_DEFAULTS;

const HALF_TURN_DEGREES = 180;
const QUARTER_TURN_DEGREES = 90;

/** The stroke the edge lines and the hub rings share. */
const FAINT_STROKE = { width: 1.5, opacity: 0.4 };
/** The pill behind a relationship label. */
const EDGE_PILL = { cornerRadius: 3, strokeWidth: 0.5, strokeOpacity: 0.1, opacity: 0.9 };

/**
 * A link's end as a node. d3 holds the id the link was built with until the simulation swaps in the node.
 *
 * @param end - One end of a link.
 * @returns The node, or `null` while the end is still an id.
 */
function resolvedNode(end: SimLink['source']): SimNode | null {
  const isResolved = typeof end === 'object';
  return isResolved ? end : null;
}

/**
 * The node id at a link's end, whether or not the simulation has swapped the node in yet.
 *
 * @param end - One end of a link.
 * @returns The id of the person at that end.
 */
function linkEndId(end: SimLink['source']): string {
  return resolvedNode(end)?.id ?? String(end);
}

/**
 * A node's radius, which grows with the person's connections up to a ceiling.
 *
 * @param connections - How many relationships the person is part of, on either side.
 * @returns The radius in svg units, from `minNodeRadius` up to `maxNodeRadius` at `nodeRadiusFullAt` connections.
 */
function getNodeRadius(connections: number): number {
  const { minNodeRadius, maxNodeRadius, nodeRadiusFullAt } = GRAPH;
  const counted = Math.min(connections, nodeRadiusFullAt);
  return minNodeRadius + ((maxNodeRadius - minNodeRadius) * counted) / nodeRadiusFullAt;
}

/**
 * The two letters drawn inside a person's node.
 *
 * @param firstName - The person's first name.
 * @param lastName - The person's last name.
 * @returns The first character of each name, uppercased; an empty name adds nothing.
 */
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
    const hasNothingToDraw = measured === false || persons.length === 0;
    if (!svgEl || hasNothingToDraw) {
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
      .scaleExtent([GRAPH.minZoom, GRAPH.maxZoom])
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
        .scale(GRAPH.initialZoom)
        .translate(-width / 2, -height / 2),
    );

    // Force simulation
    // Longer link distances for well-connected nodes so clusters breathe
    const simulation = d3
      .forceSimulation<SimNode, SimLink>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const sc = connectionCount.get(linkEndId(d.source)) ?? 0;
            const tc = connectionCount.get(linkEndId(d.target)) ?? 0;
            return GRAPH.linkDistance + (sc + tc) * GRAPH.linkDistancePerConnection;
          })
          .strength(GRAPH.linkStrength),
      )
      .force(
        'charge',
        d3
          .forceManyBody<SimNode>()
          .strength((d) => GRAPH.chargeStrength + (connectionCount.get(d.id) ?? 0) * GRAPH.chargeStrengthPerConnection),
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(GRAPH.centerStrength))
      .force(
        'collide',
        d3
          .forceCollide<SimNode>((d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + GRAPH.collidePadding)
          .strength(1),
      )
      .alphaDecay(GRAPH.alphaDecay)
      .velocityDecay(GRAPH.velocityDecay);

    simulationRef.current = simulation;

    // Edge lines
    const link = container
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--foreground)')
      .attr('stroke-width', FAINT_STROKE.width)
      .attr('stroke-opacity', FAINT_STROKE.opacity)
      .style('cursor', 'default');

    // Edge label groups (pill background + rotated text)
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
      .attr('rx', EDGE_PILL.cornerRadius)
      .attr('ry', EDGE_PILL.cornerRadius)
      .attr('fill', 'var(--secondary)')
      .attr('stroke', 'var(--foreground)')
      .attr('stroke-opacity', EDGE_PILL.strokeOpacity)
      .attr('stroke-width', EDGE_PILL.strokeWidth)
      .attr('opacity', EDGE_PILL.opacity);

    // Label text
    edgeLabelGroups
      .append('text')
      .text((d) => d.type)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'var(--foreground)')
      .attr('font-size', '9px')
      .style('user-select', 'none');

    // Size each pill rect to fit its text (approximate via getBBox)
    edgeLabelGroups.each(function () {
      const g = d3.select(this);
      const textEl = g.select<SVGTextElement>('text').node();
      if (!textEl) {
        return;
      }
      const bbox = textEl.getBBox();
      const pad = { x: GRAPH.edgeLabelPaddingX, y: GRAPH.edgeLabelPaddingY };
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

    // Node groups
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
        const isOnlyDrag = event.active === 0;
        if (isOnlyDrag) {
          simulation.alphaTarget(GRAPH.reheatAlpha).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        const isOnlyDrag = event.active === 0;
        if (isOnlyDrag) {
          simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    const nodeColor = (d: SimNode) => d.labels[0]?.color ?? nameToColor(fullName(d));

    // Outer ring for well-connected hub nodes (drawn before main circle so it sits underneath)
    nodeGroup
      .filter((d) => (connectionCount.get(d.id) ?? 0) > GRAPH.hubAboveConnections)
      .append('circle')
      .attr('r', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + GRAPH.hubRingGap)
      .attr('fill', 'none')
      .attr('stroke', nodeColor)
      .attr('stroke-width', FAINT_STROKE.width)
      .attr('stroke-opacity', FAINT_STROKE.opacity)
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
        return `${Math.floor(r * GRAPH.initialsSizeRatio)}px`;
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
      .attr('y', (d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + GRAPH.nameGap)
      .attr('pointer-events', 'none')
      .style('user-select', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--background, white)')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round');

    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => resolvedNode(d.source)?.x ?? 0)
        .attr('y1', (d) => resolvedNode(d.source)?.y ?? 0)
        .attr('x2', (d) => resolvedNode(d.target)?.x ?? 0)
        .attr('y2', (d) => resolvedNode(d.target)?.y ?? 0);

      edgeLabelGroups.attr('transform', (d) => {
        const source = resolvedNode(d.source);
        const target = resolvedNode(d.target);
        const sx = source?.x ?? 0;
        const sy = source?.y ?? 0;
        const tx = target?.x ?? 0;
        const ty = target?.y ?? 0;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        // The label follows the edge's direction, turned over when that would leave it upside down.
        const edgeAngle = (Math.atan2(ty - sy, tx - sx) * HALF_TURN_DEGREES) / Math.PI;
        const isUpsideDown = Math.abs(edgeAngle) > QUARTER_TURN_DEGREES;
        const angle = isUpsideDown ? edgeAngle + HALF_TURN_DEGREES : edgeAngle;
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
    const isUnmeasured = size.width === 0 || size.height === 0;
    if (!simulation || isUnmeasured) {
      return;
    }
    simulation.force('center', d3.forceCenter(size.width / 2, size.height / 2).strength(GRAPH.centerStrength));
    simulation.alpha(GRAPH.reheatAlpha).restart();
  }, [size.width, size.height]);

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(GRAPH.resetZoomMs)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <View
      className="relative min-h-96 flex-1 overflow-hidden"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) => {
          const isSameSize = prev.width === width && prev.height === height;
          return isSameSize ? prev : { width, height };
        });
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
          className="absolute min-w-40 rounded-lg border border-foreground/10 bg-secondary px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + GRAPH.tooltipOffsetX, top: tooltip.y - GRAPH.tooltipOffsetY }}
        >
          <Text className="font-semibold text-foreground text-sm">
            {tooltip.person.firstName} {tooltip.person.lastName}
          </Text>
          {tooltip.person.email ? (
            <Text className="mt-0.5 text-foreground/60 text-xs">{tooltip.person.email}</Text>
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
