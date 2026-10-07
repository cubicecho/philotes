import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Button } from '@/components/ui/button';
import { personName } from '@/lib/person-name';
import { primaryEmail } from '@/lib/primary-contact';
import { drawGraph } from './graph-drawing';
import { buildGraphData, GRAPH, type SimLink, type SimNode, type TooltipState } from './graph-model';
import type { NetworkGraphProps } from './types';

/**
 * The force-directed graph. d3 owns the `<svg>` — it builds, zooms and drags the nodes itself — so
 * this is the one DOM element in the app, kept to this web-only file and to `graph-drawing`, which
 * only this file imports. Everything around it (the measured box, the reset button, the tooltip) is
 * React Native.
 */
export function NetworkGraph({ persons, onOpenPerson }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tooltipEmail = tooltip ? primaryEmail(tooltip.person.contactInfos ?? []) : null;

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

    const { simulation, zoom } = drawGraph({
      ...buildGraphData(persons),
      svgEl,
      width,
      height,
      // Read through the ref at click time, so the newest callback is the one called.
      onOpenPerson: (id) => onOpenPersonRef.current(id),
      setTooltip,
    });
    zoomRef.current = zoom;
    simulationRef.current = simulation;

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
          <Text className="font-semibold text-foreground text-sm">{personName(tooltip.person)}</Text>
          {tooltipEmail ? <Text className="mt-0.5 text-foreground/60 text-xs">{tooltipEmail}</Text> : null}
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
