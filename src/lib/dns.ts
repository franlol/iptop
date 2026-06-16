import { reverse } from "node:dns/promises"

const cache = new Map<string, string>()
const pending = new Set<string>()

export function splitHostPort(addr: string): { ip: string; port: string } {
  if (addr.startsWith("[")) {
    const end = addr.indexOf("]")
    return { ip: addr.slice(1, end), port: addr.slice(end + 2) }
  }
  const sep = addr.lastIndexOf(":")
  return sep < 0 ? { ip: addr, port: "" } : { ip: addr.slice(0, sep), port: addr.slice(sep + 1) }
}

// Resolution is fire-and-forget: the first sample shows the raw IP and later
// samples pick the hostname up from the cache.
export function lookupHostname(ip: string): string | undefined {
  const cached = cache.get(ip)
  if (cached !== undefined) return cached || undefined
  if (!pending.has(ip) && !ip.includes("*")) {
    pending.add(ip)
    reverse(ip)
      .then((names) => cache.set(ip, names[0] ?? ""))
      .catch(() => cache.set(ip, ""))
      .finally(() => pending.delete(ip))
  }
  return undefined
}

export function displayAddr(addr: string): string {
  const { ip, port } = splitHostPort(addr)
  const host = lookupHostname(ip)
  if (!host) return addr
  return port ? `${host}:${port}` : host
}
