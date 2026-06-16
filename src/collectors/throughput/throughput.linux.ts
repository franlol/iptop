import { readText } from "../../lib/exec"
import type { ThroughputSample } from "../throughput"
import { type Counters, countersToSample } from "./throughput.shared"

// Counters come from /proc/net/dev: two header lines (recognizable by "|"),
// then one "iface: <rx_bytes> <7 rx cols> <tx_bytes> ..." row per interface.
// The colon may abut the first number on busy interfaces, so split on ":".
export async function sampleThroughput(): Promise<ThroughputSample> {
  const out = await readText("/proc/net/dev")

  const counters = new Map<string, Counters>()
  for (const line of out.split("\n")) {
    const sep = line.indexOf(":")
    if (sep < 0 || line.includes("|")) continue
    const name = line.slice(0, sep).trim()
    const f = line.slice(sep + 1).trim().split(/\s+/)
    const rxBytes = Number(f[0])
    const txBytes = Number(f[8])
    if (!name || Number.isNaN(rxBytes) || Number.isNaN(txBytes)) continue
    counters.set(name, { rxBytes, txBytes })
  }

  return countersToSample(counters)
}
