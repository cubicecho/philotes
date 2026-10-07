import * as d3 from 'd3';
import type { Dispatch, SetStateAction } from 'react';
import { nameToColor } from '@/lib/name-color';
import { initialsOf, personName } from '@/lib/person-name';
import {
  GRAPH,
  type GraphData,
  getNodeRadius,
  linkEndId,
  resolvedNode,
  type SimLink,
  type SimNode,
  type TooltipState,
} from './graph-model';

const HALF_TURN_DEGREES = 180;
const QUARTER_TURN_DEGREES = 90;

/** The stroke the edge lines and the hub rings share. */
const FAINT_STROKE = { width: 1.5, opacity: 0.4 };
/** The pill behind a relationship label. */
const EDGE_PILL = { cornerRadius: 3, strokeWidth: 0.5, strokeOpacity: 0.1, opacity: 0.9 };

/** What `drawGraph` draws, where, and whom it tells. */
export interface DrawGraphOptions extends GraphData {
  /** The `<svg>` to draw into. Whatever it holds is removed first. */
  svgEl: SVGSVGElement;
  /** The box the graph is laid out for, in pixels. */
  width: number;
  height: number;
  /** Called with a person's id when their node is clicked. */
  onOpenPerson: (id: string) => void;
  /** Sets the tooltip as the pointer enters, moves over and leaves a node. */
  setTooltip: Dispatch<SetStateAction<TooltipState>>;
}

/** What `drawGraph` leaves running. */
export interface DrawnGraph {
  simulation: d3.Simulation<SimNode, SimLink>;
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
}

/**
 * Draws the graph into an `<svg>` and starts its simulation. d3 owns everything inside the element from
 * here on: the edges, their labels, the nodes, and the zoom, pan and drag on them.
 *
 * @param options - The nodes and links, the element and its box, and the callbacks.
 * @returns The running simulation and the zoom behaviour, for the caller to stop and to reset.
 */
export function drawGraph({
  svgEl,
  width,
  height,
  nodes,
  links,
  connectionCount,
  onOpenPerson,
  setTooltip,
}: DrawGraphOptions): DrawnGraph {
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
      d3.forceCollide<SimNode>((d) => getNodeRadius(connectionCount.get(d.id) ?? 0) + GRAPH.collidePadding).strength(1),
    )
    .alphaDecay(GRAPH.alphaDecay)
    .velocityDecay(GRAPH.velocityDecay);

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
      onOpenPerson(d.id);
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

  const nodeColor = (d: SimNode) => d.labels[0]?.color ?? nameToColor(personName(d));

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
    .text((d) => initialsOf(personName(d)))
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
    .text((d) => personName(d))
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

  return { simulation, zoom };
}
