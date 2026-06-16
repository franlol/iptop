import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { BrailleChart } from "./components/charts/BrailleChart"
import { LineChart } from "./components/charts/LineChart"
import { useStickyMax } from "./hooks/useStickyMax"
import { formatBytes, formatRate } from "./lib/format"
import { lerpColor } from "./lib/tint"
import { theme } from "./theme"

// ── INSPECTOR chart — the two candidates, side by side, live dummy data ─────
// A · NEW (restored): braille area, download only, green vertical gradient —
//     what the panel ships today, matching the hero's chart language.
// B · OLD (current-before): line graph, rx + tx as two overlaid 1-dot lines.
// Run: bun run src/demo-inspector.tsx — kept so the choice can be revisited.

const CHART_W = 60
const CHART_H = 4
const SAMPLES = CHART_W * 2 // 2 braille dot-columns per cell
const TICK_MS = 120

const RX_HEAD = lerpColor(theme.download, "#ffffff", 0.8)

// random walk pulled toward `base`, with occasional bursts so peaks rescale
function step(prev: number, base: number): number {
  const drift = (Math.random() - 0.5) * base * 0.5
  const burst = Math.random() < 0.03 ? base * (2 + Math.random() * 3) : 0
  return Math.max(0, prev * 0.88 + base * 0.12 + drift + burst)
}

function RatesRow({ rx, tx, rxTotal, txTotal }: { rx: number; tx: number; rxTotal: number; txTotal: number }) {
  return (
    <box style={{ flexDirection: "row", justifyContent: "space-between", height: 1, flexShrink: 0 }}>
      <text wrapMode="none">
        <span fg={theme.download}>
          <b>▼ {formatRate(rx)}</b>
        </span>{" "}
        <span fg={theme.upload}>
          <b>▲ {formatRate(tx)}</b>
        </span>
      </text>
      <text fg={theme.dim} wrapMode="none">
        Σ <span fg={theme.download}>▼</span> {formatBytes(rxTotal)} <span fg={theme.upload}>▲</span> {formatBytes(txTotal)}
      </text>
    </box>
  )
}

function Demo() {
  const [hist, setHist] = useState(() => ({ rx: [200_000], tx: [40_000], rxTotal: 0, txTotal: 0 }))

  useEffect(() => {
    const id = setInterval(() => {
      setHist((h) => {
        const rx = step(h.rx[h.rx.length - 1] ?? 0, 200_000)
        const tx = step(h.tx[h.tx.length - 1] ?? 0, 45_000)
        return {
          rx: [...h.rx, rx].slice(-SAMPLES),
          tx: [...h.tx, tx].slice(-SAMPLES),
          rxTotal: h.rxTotal + rx * (TICK_MS / 1000),
          txTotal: h.txTotal + tx * (TICK_MS / 1000),
        }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const rxNow = hist.rx[hist.rx.length - 1] ?? 0
  const txNow = hist.tx[hist.tx.length - 1] ?? 0
  const rxScale = useStickyMax(Math.max(...hist.rx.slice(-SAMPLES), 1), 0.9)
  const bothScale = useStickyMax(Math.max(...hist.rx.slice(-SAMPLES), ...hist.tx.slice(-SAMPLES), 1), 0.9)

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg, padding: 1 }}>
      <text fg={theme.accent}> INSPECTOR chart — 2 candidates · same live dummy data · ctrl-c to quit</text>

      <box
        title=" A · NEW — braille download gradient (ships today) "
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
        <RatesRow rx={rxNow} tx={txNow} rxTotal={hist.rxTotal} txTotal={hist.txTotal} />
        <BrailleChart
          data={hist.rx}
          width={CHART_W}
          height={CHART_H}
          colors={theme.downloadGradient}
          max={rxScale}
          headColor={RX_HEAD}
          bottomTrackChar="⣀"
        />
        <box style={{ flexDirection: "row", justifyContent: "space-between", height: 1, flexShrink: 0 }}>
          <text fg={theme.dim} wrapMode="none">
            CONNECTIONS · 4
          </text>
          <text fg={theme.dim} wrapMode="none">
            ┄ peak {formatRate(rxScale)}
          </text>
        </box>
      </box>

      <box
        title=" B · OLD — line overlay, rx ▼ + tx ▲ "
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
        <RatesRow rx={rxNow} tx={txNow} rxTotal={hist.rxTotal} txTotal={hist.txTotal} />
        <LineChart
          series={[hist.rx, hist.tx]}
          colors={[theme.download, theme.upload]}
          width={CHART_W}
          height={CHART_H}
          max={bothScale}
        />
        <box style={{ flexDirection: "row", justifyContent: "space-between", height: 1, flexShrink: 0 }}>
          <text wrapMode="none">
            <span fg={theme.download}>── rx ▼</span>
            <span fg={theme.dim}> · </span>
            <span fg={theme.upload}>── tx ▲</span>
          </text>
          <text fg={theme.dim} wrapMode="none">
            ┄ peak {formatRate(bothScale)}
          </text>
        </box>
      </box>
    </box>
  )
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30 })
createRoot(renderer).render(<Demo />)
