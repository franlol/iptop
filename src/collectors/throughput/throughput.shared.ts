import type { InterfaceRate, ThroughputSample } from "../throughput"

export interface Counters {
  rxBytes: number
  txBytes: number
}

let prevCounters: Map<string, Counters> | null = null
let prevAt = 0

// Platform-independent half of throughput sampling: each platform parses its
// counter source into a Map and this turns counter deltas into rates.
// Loopback is excluded from the headline numbers.
export function countersToSample(counters: Map<string, Counters>): ThroughputSample {
  const now = Date.now()
  const elapsed = (now - prevAt) / 1000

  const interfaces: InterfaceRate[] = []
  let rxRate = 0
  let txRate = 0
  let rxTotal = 0
  let txTotal = 0

  for (const [name, current] of counters) {
    const isLoopback = name.startsWith("lo")
    if (!isLoopback) {
      rxTotal += current.rxBytes
      txTotal += current.txBytes
    }
    const prev = prevCounters?.get(name)
    if (!prev || elapsed <= 0) continue
    const rx = Math.max(0, (current.rxBytes - prev.rxBytes) / elapsed)
    const tx = Math.max(0, (current.txBytes - prev.txBytes) / elapsed)
    if (rx > 0 || tx > 0) interfaces.push({ name, rxRate: rx, txRate: tx })
    if (!isLoopback) {
      rxRate += rx
      txRate += tx
    }
  }

  prevCounters = counters
  prevAt = now
  interfaces.sort((a, b) => b.rxRate + b.txRate - (a.rxRate + a.txRate))
  return { rxRate, txRate, rxTotal, txTotal, interfaces }
}
