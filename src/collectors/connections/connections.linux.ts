import { displayAddr } from "../../lib/dns"
import { run } from "../../lib/exec"
import type { Connection } from "../connections"
import { sortConnections } from "./connections.shared"

// ss state names → the BSD-style names the UI and sort order expect.
const STATE_MAP: Record<string, string> = {
  ESTAB: "ESTABLISHED",
  UNCONN: "",
  "SYN-SENT": "SYN_SENT",
  "SYN-RECV": "SYN_RCVD",
}

// `ss -tunap` lists every TCP/UDP socket: "Netid State Recv-Q Send-Q
// Local:Port Peer:Port [users:((\"cmd\",pid=N,fd=M))]". A wildcard peer
// ("0.0.0.0:*") means no remote endpoint; "%iface" zone suffixes are noise.
export async function sampleConnections(): Promise<Connection[]> {
  const out = await run(["ss", "-tunap"])
  const connections: Connection[] = []
  const seen = new Set<string>()

  for (const line of out.split("\n")) {
    const f = line.trim().split(/\s+/)
    const netid = f[0] ?? ""
    if (netid !== "tcp" && netid !== "udp") continue
    const protocol = netid.toUpperCase()
    const rawState = f[1] ?? ""
    const state = STATE_MAP[rawState] ?? rawState.replace(/-/g, "_")
    const local = (f[4] ?? "").replace(/%[^:]*/, "")
    const peer = f[5] ?? ""
    const remote = peer.includes("*") ? "" : peer
    const user = (f[6] ?? "").match(/\("([^"]+)",pid=(\d+)/)
    const command = user?.[1] ?? ""
    const pid = user ? Number(user[2]) : 0

    const key = `${pid}|${protocol}|${local}|${remote}|${state}`
    if (seen.has(key)) continue
    seen.add(key)
    const remoteDisplay = remote && state === "ESTABLISHED" ? displayAddr(remote) : remote
    connections.push({ command, pid, protocol, local, remote, remoteDisplay, state })
  }

  return sortConnections(connections)
}
