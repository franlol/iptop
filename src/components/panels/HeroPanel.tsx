import type { ThroughputSample } from "../../collectors/throughput"
import { formatCompact, formatRate } from "../../lib/format"
import { lerpColor } from "../../lib/tint"
import { theme } from "../../theme"
import { BrailleChart } from "../charts/BrailleChart"

interface HeroPanelProps {
  title: string
  throughput: ThroughputSample
  rxHistory: number[]
  txHistory: number[]
  chartWidth: number
}

function seriesStats(history: number[]): { peak: number; avg: number } {
  if (history.length === 0) return { peak: 0, avg: 0 }
  const peak = Math.max(...history)
  const avg = history.reduce((a, b) => a + b, 0) / history.length
  return { peak, avg }
}

interface StatsRowProps {
  arrow: string
  rate: number
  color: string
  history: number[]
  total: number
}

function StatsRow({ arrow, rate, color, history, total }: StatsRowProps) {
  const { peak, avg } = seriesStats(history)
  return (
    <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <text wrapMode="none">
        <span fg={color}>
          <b>
            {arrow} {formatRate(rate)}
          </b>
        </span>
      </text>
      <text fg={theme.dim} wrapMode="none">
        peak {formatCompact(peak)} · avg {formatCompact(avg)} · Σ {formatCompact(total)}
      </text>
    </box>
  )
}

// Column (0..width-1) of the window's peak, mapped from braille dot space back
// to character cells, so the marker hovers above the actual high point.
function peakAt(history: number[], width: number): { col: number; value: number } | null {
  if (history.length === 0) return null
  const dotWidth = width * 2
  const visible = history.slice(-dotWidth)
  let value = 0
  let idx = 0
  visible.forEach((v, i) => {
    if (v > value) {
      value = v
      idx = i
    }
  })
  if (value <= 0) return null
  const offset = dotWidth - visible.length
  return { col: Math.floor((offset + idx) / 2), value }
}

// Floating peak label: ▾ above the rx chart, ▴ below the mirrored tx chart.
// Renders a blank line (keeping the row) when there's no traffic yet, so the
// panel height stays fixed.
function PeakMarker({
  history,
  width,
  arrow,
  color,
}: {
  history: number[]
  width: number
  arrow: string
  color: string
}) {
  const peak = peakAt(history, width)
  if (!peak) return <text> </text>
  const label = ` ${formatCompact(peak.value)}`
  const left = Math.max(0, Math.min(peak.col, width - label.length - 1))
  return (
    <text wrapMode="none">
      <span>{" ".repeat(left)}</span>
      <span fg={color}>{arrow}</span>
      <span fg={theme.dim}>{label}</span>
    </text>
  )
}

export function HeroPanel({ title, throughput, rxHistory, txHistory, chartWidth }: HeroPanelProps) {
  // brightened edges read as live cursors; derived per-render so they follow
  // live theme switches
  const RX_HEAD = lerpColor(theme.download, theme.headAnchor, 0.8)
  const TX_HEAD = lerpColor(theme.upload, theme.headAnchor, 0.8)
  return (
    <box
      title={title}
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        height: 12,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <StatsRow
        arrow="▼"
        rate={throughput.rxRate}
        color={theme.download}
        history={rxHistory}
        total={throughput.rxTotal}
      />
      <PeakMarker history={rxHistory} width={chartWidth} arrow="▾" color={RX_HEAD} />
      <BrailleChart data={rxHistory} width={chartWidth} height={3} colors={theme.downloadGradient} headColor={RX_HEAD} />
      <BrailleChart
        data={txHistory}
        width={chartWidth}
        height={3}
        colors={theme.uploadGradient}
        mirror
        topTrackChar="⠉"
        headColor={TX_HEAD}
      />
      <PeakMarker history={txHistory} width={chartWidth} arrow="▴" color={TX_HEAD} />
      <StatsRow arrow="▲" rate={throughput.txRate} color={theme.upload} history={txHistory} total={throughput.txTotal} />
    </box>
  )
}
