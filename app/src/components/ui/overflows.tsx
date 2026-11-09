import { type RefObject, useRef } from "react";

/** Which ends of the box's inline axis have more past them. Never either, on device. */
export type OverflowEdges = { readonly start: boolean; readonly end: boolean };

const NO_EDGES: OverflowEdges = { start: false, end: false };

/** A ref to put on the box, `false`, and no edges: on device nothing reads the answer. */
export function useOverflows<T = unknown>(): readonly [
  RefObject<T | null>,
  boolean,
  OverflowEdges,
] {
  const ref = useRef<T>(null);
  return [ref, false, NO_EDGES] as const;
}
