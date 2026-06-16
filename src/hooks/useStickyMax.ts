import { useRef } from "react"

// Gauge scale that decays instead of snapping down, so every bar doesn't
// rescale the moment the busiest row spikes or disappears. Decay is per
// second of wall time — App re-renders several times per poll interval, so
// decaying per render would drain the ceiling far faster than intended.
// Pass resetKey to hard-reset the accumulated max when a mode change (e.g.
// rate vs total) would otherwise leave the scale many orders of magnitude
// too large.
export function useStickyMax(current: number, decayPerSec = 0.9, resetKey?: unknown): number {
  const ref = useRef(0)
  const atRef = useRef(0)
  const prevKeyRef = useRef(resetKey)
  if (prevKeyRef.current !== resetKey) {
    ref.current = 0
    prevKeyRef.current = resetKey
  }
  const now = Date.now()
  const dt = atRef.current === 0 ? 0 : (now - atRef.current) / 1000
  atRef.current = now
  ref.current = Math.max(current, ref.current * decayPerSec ** dt)
  return Math.max(ref.current, 1)
}
