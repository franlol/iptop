import { run } from "../../lib/exec"
import type { TrafficSample } from "../traffic"
import { aggregate, EMPTY_TRAFFIC, type RawConnection, type RawProcess } from "./traffic.shared"

// One `nettop` run (without -P) yields process rows ("name.pid") each
// followed by that process's connection rows ("tcp4 local<->remote"), all
// with cumulative byte counters; the shared engine turns them into rates.
export async function sampleTraffic(): Promise<TrafficSample> {
  const out = await run(["nettop", "-x", "-J", "bytes_in,bytes_out", "-L", "1"])

  const lines = out.split("\n")
  const header = (lines[0] ?? "").split(",")
  const rxCol = header.indexOf("bytes_in")
  const txCol = header.indexOf("bytes_out")
  const idCol = rxCol - 1
  if (rxCol < 1 || txCol < 0) return EMPTY_TRAFFIC

  const processes: RawProcess[] = []
  const connections: RawConnection[] = []
  let currentPid = 0

  for (const line of lines.slice(1)) {
    const f = line.split(",")
    const id = f[idCol] ?? ""
    if (!id) continue
    const rx = Number(f[rxCol] || NaN)
    const tx = Number(f[txCol] || NaN)
    if (Number.isNaN(rx) || Number.isNaN(tx)) continue

    const sep = id.indexOf("<->")
    if (sep < 0) {
      // process row
      const lastDot = id.lastIndexOf(".")
      const name = lastDot > 0 ? id.slice(0, lastDot) : id
      currentPid = lastDot > 0 ? Number(id.slice(lastDot + 1)) : 0
      processes.push({ name, pid: currentPid, rxBytes: rx, txBytes: tx })
    } else {
      // connection row belonging to the last seen process
      const local = id.slice(id.indexOf(" ") + 1, sep)
      const remote = id.slice(sep + 3)
      if (!remote || remote.startsWith("*")) continue
      connections.push({ pid: currentPid, local, remote, rxBytes: rx, txBytes: tx })
    }
  }

  // nettop's process counters accumulate for the process lifetime, so direct
  // deltas on them are reliable (unlike linux's live-socket sums)
  return aggregate({ processes, connections, monotonicProcessTotals: true })
}
