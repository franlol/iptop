// Aggregates connections into per-service traffic: connections are grouped by
// remote port + protocol and joined with the per-connection rates the traffic
// collector tracks, so "https is 90% of my traffic" falls out of data we
// already have.

import type { Connection } from "../collectors/connections"

// Well-known remote ports, keyed "proto:port". TCP/443 vs UDP/443
// distinguishes https from QUIC for free.
const SERVICE_NAMES: Record<string, string> = {
  "tcp:443": "https",
  "udp:443": "quic",
  "tcp:80": "http",
  "tcp:53": "dns",
  "udp:53": "dns",
  "tcp:853": "dot",
  "udp:853": "doq",
  "tcp:22": "ssh",
  "udp:123": "ntp",
  "tcp:21": "ftp",
  "tcp:25": "smtp",
  "tcp:587": "smtp",
  "tcp:465": "smtps",
  "tcp:143": "imap",
  "tcp:993": "imaps",
  "tcp:110": "pop3",
  "tcp:995": "pop3s",
  "tcp:5222": "xmpp",
  "udp:5353": "mdns",
  "udp:1900": "ssdp",
  "udp:3478": "stun",
  "tcp:3478": "stun",
  "udp:51820": "wireguard",
  "tcp:1194": "openvpn",
  "udp:1194": "openvpn",
  "udp:500": "ipsec",
  "udp:4500": "ipsec",
  "tcp:8080": "http-alt",
  "tcp:8443": "https-alt",
  "tcp:5432": "postgres",
  "tcp:3306": "mysql",
  "tcp:6379": "redis",
  "tcp:27017": "mongodb",
}

export interface ServiceRate {
  key: string
  // "" when the port isn't a well-known service
  name: string
  protocol: string
  port: number
  rate: number
  rxRate: number
  txRate: number
  connections: number
}

// Port-only lookup for callers that don't know the protocol (the traffic
// collector's connection rows carry no proto). tcp wins ties since that's
// what both platform collectors can actually meter.
export function serviceName(port: number): string {
  return SERVICE_NAMES[`tcp:${port}`] ?? SERVICE_NAMES[`udp:${port}`] ?? ""
}

// Last colon handles IPv6 remotes like "[2a00::1]:443".
export function remotePort(remote: string): number | null {
  const i = remote.lastIndexOf(":")
  if (i < 0) return null
  const port = Number(remote.slice(i + 1))
  return Number.isInteger(port) && port > 0 ? port : null
}

export function aggregateServices(
  connections: Connection[],
  rates: Map<string, { rxRate: number; txRate: number }>,
): ServiceRate[] {
  const services = new Map<string, ServiceRate>()
  for (const c of connections) {
    if (!c.remote) continue
    const port = remotePort(c.remote)
    if (port === null) continue
    const key = `${c.protocol.toLowerCase()}:${port}`
    const r = rates.get(`${c.local}|${c.remote}`)
    const rxRate = r?.rxRate ?? 0
    const txRate = r?.txRate ?? 0
    const entry = services.get(key)
    if (entry) {
      entry.rate += rxRate + txRate
      entry.rxRate += rxRate
      entry.txRate += txRate
      entry.connections++
    } else {
      services.set(key, {
        key,
        name: SERVICE_NAMES[key] ?? "",
        protocol: c.protocol,
        port,
        rate: rxRate + txRate,
        rxRate,
        txRate,
        connections: 1,
      })
    }
  }
  return [...services.values()].sort(
    (a, b) => b.rate - a.rate || b.connections - a.connections || a.port - b.port,
  )
}
