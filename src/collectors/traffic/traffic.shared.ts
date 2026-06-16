import { displayAddr, lookupHostname, splitHostPort } from "../../lib/dns"
import { lookupGeo } from "../../lib/geo"
import type { ProcessConnection, ProcessHistory, ProcessRate, RemoteHost, TrafficSample } from "../traffic"

export const EMPTY_TRAFFIC: TrafficSample = {
  processes: [],
  remotes: [],
  connectionRates: new Map(),
  processConnections: new Map(),
  histories: new Map(),
}

// Cumulative byte counters as parsed from the platform tool; aggregate()
// turns them into rates, smoothed series, and per-remote aggregates.
export interface RawProcess {
  name: string
  pid: number
  rxBytes: number
  txBytes: number
}

export interface RawConnection {
  pid: number
  local: string
  remote: string
  rxBytes: number
  txBytes: number
}

export interface RawTraffic {
  processes: RawProcess[]
  connections: RawConnection[]
  // darwin's nettop process counters are cumulative for the process lifetime,
  // so deltas on them are trustworthy. linux's are sums over currently-live
  // sockets — they go backwards when a socket closes, so per-process rates
  // must derive from per-socket deltas instead.
  monotonicProcessTotals?: boolean
}

interface Totals {
  rx: number
  tx: number
}

let prevTotals = new Map<string, Totals>()
let prevAt = 0
const histories = new Map<number, ProcessHistory>()
const HISTORY_SIZE = 160

// Panels sort/display exponentially smoothed rates so rows don't reshuffle
// on every 2s sample; SMOOTHING is the weight of the newest sample.
const SMOOTHING = 0.45

// Processes persist and decay like remotes do: Linux only reports processes
// with currently-open sockets, so short-lived connection churn would
// otherwise flash rows in at zero and ramp them up every few seconds.
interface ProcessEntry {
  name: string
  emaRx: number
  emaTx: number
  rxTotal: number
  txTotal: number
}
const processEntries = new Map<number, ProcessEntry>()

interface RemoteEntry {
  emaRx: number
  emaTx: number
}

const remoteEntries = new Map<string, RemoteEntry>()

function smooth(prev: number, next: number): number {
  return prev + SMOOTHING * (next - prev)
}

// Platform-independent half of traffic sampling: cumulative counters in,
// TrafficSample out. Stateful across calls (deltas, EMAs, histories, decay).
export function aggregate(raw: RawTraffic): TrafficSample {
  const now = Date.now()
  const elapsed = (now - prevAt) / 1000

  const totals = new Map<string, Totals>()
  const connectionRates = new Map<string, { rxRate: number; txRate: number }>()
  const processConnections = new Map<number, ProcessConnection[]>()
  const remoteAgg = new Map<string, { rxRate: number; txRate: number }>()

  const rates = (key: string, rx: number, tx: number): { rxRate: number; txRate: number } | null => {
    totals.set(key, { rx, tx })
    const prev = prevTotals.get(key)
    if (!prev || elapsed <= 0) return null
    return { rxRate: Math.max(0, (rx - prev.rx) / elapsed), txRate: Math.max(0, (tx - prev.tx) / elapsed) }
  }

  // per-connection deltas first; socket keys are stable, so these never go
  // backwards — a closed socket simply stops contributing
  const processRates = new Map<number, { rx: number; tx: number }>()
  for (const c of raw.connections) {
    const r = rates(`c|${c.pid}|${c.local}|${c.remote}`, c.rxBytes, c.txBytes)
    if (!r) continue
    const pr = processRates.get(c.pid) ?? { rx: 0, tx: 0 }
    pr.rx += r.rxRate
    pr.tx += r.txRate
    processRates.set(c.pid, pr)
    connectionRates.set(`${c.local}|${c.remote}`, r)
    const { ip } = splitHostPort(c.remote)
    const geo = lookupGeo(ip)
    const conns = processConnections.get(c.pid) ?? []
    conns.push({
      local: c.local,
      remote: c.remote,
      remoteDisplay: displayAddr(c.remote),
      country: geo?.country ?? "",
      rxRate: r.rxRate,
      txRate: r.txRate,
    })
    processConnections.set(c.pid, conns)
    if (r.rxRate + r.txRate > 0) {
      const agg = remoteAgg.get(ip) ?? { rxRate: 0, txRate: 0 }
      agg.rxRate += r.rxRate
      agg.txRate += r.txRate
      remoteAgg.set(ip, agg)
    }
  }

  const livePids = new Set<number>()
  for (const p of raw.processes) {
    livePids.add(p.pid)
    let r: { rxRate: number; txRate: number } | null
    if (raw.monotonicProcessTotals) {
      r = rates(`p|${p.name}.${p.pid}`, p.rxBytes, p.txBytes)
    } else {
      // non-monotonic counters: the process rate is the sum of its sockets'
      // rates; null (no socket had a previous sample) freezes the EMA
      const pr = processRates.get(p.pid)
      r = pr ? { rxRate: pr.rx, txRate: pr.tx } : null
    }
    const entry = processEntries.get(p.pid) ?? { name: p.name, emaRx: 0, emaTx: 0, rxTotal: 0, txTotal: 0 }
    entry.name = p.name
    entry.rxTotal = p.rxBytes
    entry.txTotal = p.txBytes
    if (r) {
      entry.emaRx = smooth(entry.emaRx, r.rxRate)
      entry.emaTx = smooth(entry.emaTx, r.txRate)
      const history = histories.get(p.pid) ?? { rx: [], tx: [] }
      history.rx.push(r.rxRate)
      history.tx.push(r.txRate)
      histories.set(p.pid, { rx: history.rx.slice(-HISTORY_SIZE), tx: history.tx.slice(-HISTORY_SIZE) })
    }
    processEntries.set(p.pid, entry)
  }

  prevTotals = totals
  prevAt = now

  // a process whose sockets all closed decays toward zero (its history
  // records the silence) and is pruned once it falls below 1 B/s
  for (const [pid, entry] of processEntries) {
    if (livePids.has(pid)) continue
    entry.emaRx = smooth(entry.emaRx, 0)
    entry.emaTx = smooth(entry.emaTx, 0)
    if (entry.emaRx + entry.emaTx < 1) {
      processEntries.delete(pid)
      histories.delete(pid)
      continue
    }
    const history = histories.get(pid)
    if (history) {
      history.rx.push(0)
      history.tx.push(0)
      histories.set(pid, { rx: history.rx.slice(-HISTORY_SIZE), tx: history.tx.slice(-HISTORY_SIZE) })
    }
  }

  const processes: ProcessRate[] = [...processEntries.entries()].map(([pid, e]) => ({
    name: e.name,
    pid,
    rxRate: e.emaRx,
    txRate: e.emaTx,
    rxTotal: e.rxTotal,
    txTotal: e.txTotal,
  }))

  for (const conns of processConnections.values()) conns.sort((a, b) => b.rxRate + b.txRate - (a.rxRate + a.txRate))

  // remotes persist and decay instead of vanishing the moment they go quiet
  for (const [ip, agg] of remoteAgg) {
    const entry = remoteEntries.get(ip) ?? { emaRx: 0, emaTx: 0 }
    entry.emaRx = smooth(entry.emaRx, agg.rxRate)
    entry.emaTx = smooth(entry.emaTx, agg.txRate)
    remoteEntries.set(ip, entry)
  }
  for (const [ip, entry] of remoteEntries) {
    if (!remoteAgg.has(ip)) {
      entry.emaRx = smooth(entry.emaRx, 0)
      entry.emaTx = smooth(entry.emaTx, 0)
      if (entry.emaRx + entry.emaTx < 1) remoteEntries.delete(ip)
    }
  }

  const remotes: RemoteHost[] = []
  for (const [ip, entry] of remoteEntries) {
    const geo = lookupGeo(ip)
    const host = lookupHostname(ip) ?? ip
    remotes.push({
      ip,
      host,
      country: geo?.country ?? "",
      org: geo?.org ?? "",
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      rxRate: entry.emaRx,
      txRate: entry.emaTx,
    })
  }
  remotes.sort((a, b) => b.rxRate + b.txRate - (a.rxRate + a.txRate) || a.ip.localeCompare(b.ip))

  processes.sort(
    (a, b) =>
      b.rxRate + b.txRate - (a.rxRate + a.txRate) ||
      b.rxTotal + b.txTotal - (a.rxTotal + a.txTotal) ||
      a.pid - b.pid,
  )

  return { processes, remotes: remotes.slice(0, 20), connectionRates, processConnections, histories }
}
