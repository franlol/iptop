import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useCallback, useRef, useState } from "react"
import { sampleConnections } from "./collectors/connections"
import { EMPTY_LATENCY, sampleLatency } from "./collectors/latency"
import { EMPTY_SYSTEM, getSystemInfo } from "./collectors/system"
import { EMPTY_THROUGHPUT, sampleThroughput } from "./collectors/throughput"
import { EMPTY_TRAFFIC, sampleTraffic } from "./collectors/traffic"
import { ConnectionsPanel } from "./components/panels/ConnectionsPanel"
import { HeroPanel } from "./components/panels/HeroPanel"
import { InspectorPanel } from "./components/panels/InspectorPanel"
import { LatencyPanel } from "./components/panels/LatencyPanel"
import { ProcessesPanel, type ProcessSort } from "./components/panels/ProcessesPanel"
import { RemoteHostsPanel } from "./components/panels/RemoteHostsPanel"
import { ServicesPanel } from "./components/panels/ServicesPanel"
import { WorldMapPanel } from "./components/panels/WorldMapPanel"
import { usePoll } from "./hooks/usePoll"
import { useSeries } from "./hooks/useSeries"
import { theme } from "./theme"

const HISTORY_SIZE = 600
const MAP_HEIGHT = 14

// Global refresh-rate ladder (ms). `[` steps slower, `]` steps faster.
const RATES = [500, 1_000, 2_000] as const
const DEFAULT_RATE_INDEX = 0 // 500ms (fastest allowed)

export function App() {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [sort, setSort] = useState<ProcessSort>("total")
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const selectedPidRef = useRef<number | null>(null)
  selectedPidRef.current = selectedPid
  const [inspectedPid, setInspectedPid] = useState<number | null>(null)
  const [showMap, setShowMap] = useState(true)
  const [rateIndex, setRateIndex] = useState(DEFAULT_RATE_INDEX)
  const intervalMs = RATES[rateIndex] ?? RATES[DEFAULT_RATE_INDEX]

  const system = usePoll(getSystemInfo, intervalMs, EMPTY_SYSTEM)
  const throughput = usePoll(sampleThroughput, intervalMs, EMPTY_THROUGHPUT)
  const net = usePoll(sampleTraffic, intervalMs, EMPTY_TRAFFIC)
  const connections = usePoll(sampleConnections, intervalMs, [])

  const pingTargets = useCallback(() => sampleLatency(system.gateway), [system.gateway])
  const latency = usePoll(pingTargets, intervalMs, EMPTY_LATENCY)

  const processes =
    sort === "total"
      ? [...net.processes].sort((a, b) => b.rxTotal + b.txTotal - (a.rxTotal + a.txTotal))
      : net.processes
  const processesRef = useRef(processes)
  processesRef.current = processes
  const selectedIndex = processes.findIndex((p) => p.pid === selectedPid)

  useKeyboard((key) => {
    if (key.name === "q") {
      renderer.destroy()
      process.exit(0)
    }
    if (key.name === "escape") {
      if (inspectedPid !== null) setInspectedPid(null)
      else {
        renderer.destroy()
        process.exit(0)
      }
    }
    if (key.name === "s") setSort((prev) => (prev === "rate" ? "total" : "rate"))
    if (key.name === "m") setShowMap((prev) => !prev)
    if (key.name === "[") setRateIndex((i) => Math.min(i + 1, RATES.length - 1)) // slower
    if (key.name === "]") setRateIndex((i) => Math.max(i - 1, 0)) // faster
    if (key.name === "j" || key.name === "down") {
      const procs = processesRef.current
      if (procs.length > 0) {
        const idx = procs.findIndex((p) => p.pid === selectedPidRef.current)
        const next = Math.min(idx === -1 ? 0 : idx + 1, procs.length - 1)
        setSelectedPid(procs[next]?.pid ?? null)
      }
    }
    if (key.name === "k" || key.name === "up") {
      const procs = processesRef.current
      if (procs.length > 0) {
        const idx = procs.findIndex((p) => p.pid === selectedPidRef.current)
        const next = Math.max(idx === -1 ? 0 : idx - 1, 0)
        setSelectedPid(procs[next]?.pid ?? null)
      }
    }
    if (key.name === "return" || key.name === "enter") {
      if (selectedPidRef.current !== null) setInspectedPid(selectedPidRef.current)
    }
  })

  const [rxHistory = [], txHistory = []] = useSeries(
    throughput,
    [throughput.rxRate, throughput.txRate],
    HISTORY_SIZE,
  )
  const [gatewayHistory = [], internetHistory = [], dnsHistory = []] = useSeries(
    latency,
    [latency.gatewayMs ?? 0, latency.internetMs ?? 0, latency.dnsMs ?? 0],
    HISTORY_SIZE,
  )
  // -1 marks "not probed" so loss averages only count real bursts
  const [gatewayLoss = [], internetLoss = [], dnsLoss = []] = useSeries(
    latency,
    [latency.gatewayLoss ?? -1, latency.internetLoss ?? -1, latency.dnsLoss ?? -1],
    HISTORY_SIZE,
  )

  const chartWidth = Math.max(20, width - 4)
  const halfInner = Math.max(20, Math.floor(width / 2) - 4)
  const time = new Date().toLocaleTimeString("en-GB")
  const heroTitle = ` iptop ─ ${system.localIp || "…"} · ⇄ ${system.publicIp || "…"} · gw ${system.gateway || "…"} · ${time} `

  const inspected = inspectedPid !== null ? (net.processes.find((p) => p.pid === inspectedPid) ?? null) : null
  const mapVisible = showMap && inspectedPid === null && height >= 32

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg }}>
      <HeroPanel
        title={heroTitle}
        throughput={throughput}
        rxHistory={rxHistory}
        txHistory={txHistory}
        chartWidth={chartWidth}
      />
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        <box style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
          <ProcessesPanel
            processes={processes}
            sort={sort}
            selectedIndex={selectedIndex}
            nameWidth={Math.max(10, halfInner - 29)}
          />
          <ConnectionsPanel
            connections={connections}
            rates={net.connectionRates}
            nameWidth={Math.min(20, Math.max(12, halfInner - 38))}
          />
        </box>
        <box style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
          {inspectedPid !== null ? (
            <InspectorPanel
              process={inspected}
              history={net.histories.get(inspectedPid) ?? { rx: [], tx: [] }}
              connections={inspectedPid !== null ? (net.processConnections.get(inspectedPid) ?? []) : []}
              remotes={net.remotes}
              width={halfInner}
            />
          ) : (
            <>
              {mapVisible ? <WorldMapPanel remotes={net.remotes} width={halfInner} height={MAP_HEIGHT} /> : null}
              <RemoteHostsPanel remotes={net.remotes} nameWidth={Math.max(10, halfInner - 20)} />
              <ServicesPanel connections={connections} rates={net.connectionRates} />
              <LatencyPanel
                latency={latency}
                histories={{ gateway: gatewayHistory, internet: internetHistory, dns: dnsHistory }}
                losses={{ gateway: gatewayLoss, internet: internetLoss, dns: dnsLoss }}
                width={halfInner}
              />
            </>
          )}
        </box>
      </box>
      <box style={{ height: 1, paddingLeft: 1 }}>
        <text fg={theme.dim}>
          q quit · j/k select · ⏎ inspect · esc back · s sort · m map · [/] {intervalMs}ms · mouse scrolls
        </text>
      </box>
    </box>
  )
}
