import { run } from "../../lib/exec"
import type { ThroughputSample } from "../throughput"
import { type Counters, countersToSample } from "./throughput.shared"

// Counters come from `netstat -ibn` "<Link#N>" rows. The Address column is
// absent for interfaces without a MAC (e.g. lo0), so column positions are
// resolved from the right edge using the header.
export async function sampleThroughput(): Promise<ThroughputSample> {
  const out = await run(["netstat", "-ibn"])
  const lines = out.split("\n")
  const header = (lines[0] ?? "").trim().split(/\s+/)
  const rxFromEnd = header.length - header.indexOf("Ibytes")
  const txFromEnd = header.length - header.indexOf("Obytes")

  const counters = new Map<string, Counters>()
  for (const line of lines) {
    if (!line.includes("<Link#")) continue
    const f = line.trim().split(/\s+/)
    const name = f[0] ?? ""
    const rxBytes = Number(f[f.length - rxFromEnd])
    const txBytes = Number(f[f.length - txFromEnd])
    if (!name || Number.isNaN(rxBytes) || Number.isNaN(txBytes)) continue
    counters.set(name, { rxBytes, txBytes })
  }

  return countersToSample(counters)
}
