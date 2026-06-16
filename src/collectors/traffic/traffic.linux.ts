import { run } from "../../lib/exec"
import type { TrafficSample } from "../traffic"
import { aggregate, type RawConnection, type RawProcess } from "./traffic.shared"

// `ss -tinp` prints one line per established TCP socket
// ("ESTAB 0 0 local:port peer:port users:((\"cmd\",pid=N,fd=M)) <tcp-info>").
// The cumulative bytes_sent/bytes_received counters live in the tcp-info, which
// newer iproute2 appends to the socket line itself while older versions print
// on a following indented line — we accept either. Per-process totals are the
// sum of that process's live sockets. Linux keeps no per-socket byte counters
// for UDP, so UDP traffic (e.g. QUIC) shows up in interface throughput but not
// in per-process rates. (Some ss builds omit the byte counters entirely; then
// per-process/per-host rates can't be derived from ss.)
export async function sampleTraffic(): Promise<TrafficSample> {
  const out = await run(["ss", "-tinp"])

  const connections: RawConnection[] = []
  const perProcess = new Map<number, RawProcess>()
  let current: RawConnection | null = null
  let currentUser: { name: string; pid: number } | null = null

  // pull cumulative byte counters out of a tcp-info fragment, wherever it lands
  const readBytes = (line: string, conn: RawConnection) => {
    const tx = line.match(/bytes_sent:(\d+)/)?.[1] ?? line.match(/bytes_acked:(\d+)/)?.[1]
    if (tx !== undefined) conn.txBytes = Number(tx)
    const rx = line.match(/bytes_received:(\d+)/)?.[1]
    if (rx !== undefined) conn.rxBytes = Number(rx)
  }

  // commit the pending socket once its tcp-info has been read (or once the next
  // socket line proves there was no indented continuation to wait for)
  const flush = () => {
    if (!current) return
    connections.push(current)
    if (currentUser) {
      const p = perProcess.get(currentUser.pid) ?? { ...currentUser, rxBytes: 0, txBytes: 0 }
      p.rxBytes += current.rxBytes
      p.txBytes += current.txBytes
      perProcess.set(currentUser.pid, p)
    }
    current = null
    currentUser = null
  }

  for (const line of out.split("\n")) {
    if (!line || line.startsWith("State")) continue

    if (/^\s/.test(line)) {
      // legacy continuation: tcp-info for the preceding socket on its own line
      if (current) readBytes(line, current)
      flush()
      continue
    }

    // a new socket line begins: the previous socket (if any) is now complete
    flush()

    // socket line: State Recv-Q Send-Q Local:Port Peer:Port [Process] [tcp-info]
    const f = line.trim().split(/\s+/)
    if (f[0] !== "ESTAB") continue
    const local = (f[3] ?? "").replace(/%[^:]*/, "")
    const remote = f[4] ?? ""
    if (!local || !remote || remote.includes("*")) continue
    const user = (f[5] ?? "").match(/\("([^"]+)",pid=(\d+)/)
    if (user) currentUser = { name: user[1]!, pid: Number(user[2]) }
    current = { pid: currentUser?.pid ?? 0, local, remote, rxBytes: 0, txBytes: 0 }
    // newer ss appends the tcp-info (incl. byte counters) to this same line
    readBytes(line, current)
  }
  flush()

  return aggregate({ processes: [...perProcess.values()], connections })
}
