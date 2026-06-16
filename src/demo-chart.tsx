import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { BrailleChart } from "./components/charts/BrailleChart"
import { LineChart } from "./components/charts/LineChart"
import { formatRate } from "./lib/format"
import { theme } from "./theme"

// ── INSPECTOR chart — 2 model options · same live dummy data ──────────────
// A: the area chart the inspector uses today (rx only, vertical gradient).
// B: line graph, rx and tx as two 1-dot-thick overlaid lines.

const CHART_W = 70
const CHART_H = 5
const SAMPLES = CHART_W * 2 // 2 braille dot-columns per cell
const TICK_MS = 120

// random walk pulled toward `base`, with occasional bursts so peaks rescale
function step(prev: number, base: number): number {
  const drift = (Math.random() - 0.5) * base * 0.5
  const burst = Math.random() < 0.03 ? base * (2 + Math.random() * 3) : 0
  return Math.max(0, prev * 0.88 + base * 0.12 + drift + burst)
}

function Demo() {
  const [hist, setHist] = useState(() => ({ rx: [200_000], tx: [40_000] }))

  useEffect(() => {
    const id = setInterval(() => {
      setHist((h) => ({
        rx: [...h.rx, step(h.rx[h.rx.length - 1] ?? 0, 200_000)].slice(-SAMPLES),
        tx: [...h.tx, step(h.tx[h.tx.length - 1] ?? 0, 45_000)].slice(-SAMPLES),
      }))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const rxNow = hist.rx[hist.rx.length - 1] ?? 0
  const txNow = hist.tx[hist.tx.length - 1] ?? 0

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg, padding: 1 }}>
      <text fg={theme.accent}> INSPECTOR chart — 2 model options · same live dummy data · ctrl-c to quit</text>
      <text wrapMode="none">
        {" "}
        <span fg={theme.download}>
          <b>▼ {formatRate(rxNow)}</b>
        </span>{" "}
        <span fg={theme.upload}>
          <b>▲ {formatRate(txNow)}</b>
        </span>
      </text>
      <box
        title=" A · AREA — current model (rx only, gradient fill) "
        style={{
          border: true,
          borderStyle: "rounded",
          borderColor: theme.border,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: CHART_W + 4,
        }}
      >
        <BrailleChart data={hist.rx} width={CHART_W} height={CHART_H} colors={theme.downloadGradient} />
      </box>
      <box
        title=" B · LINE — rx + tx overlay (green down, red up) "
        style={{
          border: true,
          borderStyle: "rounded",
          borderColor: theme.border,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: CHART_W + 4,
        }}
      >
        <LineChart
          series={[hist.rx, hist.tx]}
          colors={[theme.download, theme.upload]}
          width={CHART_W}
          height={CHART_H}
        />
        <text wrapMode="none">
          <span fg={theme.download}>── rx ▼</span>
          <span fg={theme.dim}> · </span>
          <span fg={theme.upload}>── tx ▲</span>
        </text>
      </box>
    </box>
  )
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30 })
createRoot(renderer).render(<Demo />)
