import { displayAddr } from "../../lib/dns"
import { run } from "../../lib/exec"
import type { Connection } from "../connections"
import { sortConnections } from "./connections.shared"

// `lsof -F` emits one field per line: p<pid> c<command> start a process
// section, f<fd> starts a file entry, then P<proto> n<addresses> T<state>.
export async function sampleConnections(): Promise<Connection[]> {
  const out = await run(["lsof", "-nP", "-i", "-FpcnPT"])
  const connections: Connection[] = []
  const seen = new Set<string>()

  let pid = 0
  let command = ""
  let protocol = ""
  let name = ""
  let state = ""

  const flush = () => {
    if (name) {
      const arrow = name.indexOf("->")
      const local = arrow >= 0 ? name.slice(0, arrow) : name
      const remote = arrow >= 0 ? name.slice(arrow + 2) : ""
      const key = `${pid}|${protocol}|${name}|${state}`
      if (!seen.has(key)) {
        seen.add(key)
        const remoteDisplay = remote && state === "ESTABLISHED" ? displayAddr(remote) : remote
        connections.push({ command, pid, protocol, local, remote, remoteDisplay, state })
      }
    }
    protocol = ""
    name = ""
    state = ""
  }

  for (const line of out.split("\n")) {
    const tag = line[0]
    const value = line.slice(1)
    if (tag === "p") {
      flush()
      pid = Number(value)
    } else if (tag === "c") {
      command = value
    } else if (tag === "f") {
      flush()
    } else if (tag === "P") {
      protocol = value
    } else if (tag === "n") {
      name = value
    } else if (tag === "T" && value.startsWith("ST=")) {
      state = value.slice(3)
    }
  }
  flush()

  return sortConnections(connections)
}
