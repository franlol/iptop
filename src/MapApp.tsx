import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { EMPTY_THROUGHPUT, sampleThroughput } from "./collectors/throughput"
import { EMPTY_TRAFFIC, sampleTraffic } from "./collectors/traffic"
import { WorldMapPanel } from "./components/panels/WorldMapPanel"
import { usePoll } from "./hooks/usePoll"
import { formatRate } from "./lib/format"
import { theme } from "./theme"

// Fullscreen world-map mode (`iptop --map`): your live traffic as wall art.
export function MapApp() {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy()
      process.exit(0)
    }
  })

  const throughput = usePoll(sampleThroughput, 1_000, EMPTY_THROUGHPUT)
  const net = usePoll(sampleTraffic, 2_000, EMPTY_TRAFFIC)
  const located = net.remotes.filter((r) => r.lat !== null).length

  const title = ` iptop ─ ▼ ${formatRate(throughput.rxRate)} · ▲ ${formatRate(throughput.txRate)} · ${located} destinations `

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg }}>
      <WorldMapPanel remotes={net.remotes} width={width - 4} height={height - 1} title={title} />
      <box style={{ height: 1, paddingLeft: 1 }}>
        <text fg={theme.dim}>q quit</text>
      </box>
    </box>
  )
}
