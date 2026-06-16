import { useEffect, useState } from "react"

// Appends one point per new sample to each series; `trigger` should be the
// sample object so identical consecutive values still get recorded.
export function useSeries(trigger: unknown, values: number[], size: number): number[][] {
  const [series, setSeries] = useState<number[][]>(() => values.map(() => []))

  useEffect(
    function appendSeries() {
      setSeries((prev) => values.map((v, i) => [...(prev[i] ?? []), v].slice(-size)))
    },
    [trigger],
  )

  return series
}
