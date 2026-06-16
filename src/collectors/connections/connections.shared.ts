import type { Connection } from "../connections"

const STATE_ORDER: Record<string, number> = {
  ESTABLISHED: 0,
  SYN_SENT: 1,
  SYN_RCVD: 1,
  LISTEN: 3,
}

// Established first, listeners last, stable by command name.
export function sortConnections(connections: Connection[]): Connection[] {
  connections.sort(
    (a, b) => (STATE_ORDER[a.state] ?? 2) - (STATE_ORDER[b.state] ?? 2) || a.command.localeCompare(b.command),
  )
  return connections
}
