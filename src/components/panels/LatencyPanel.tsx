import type { LatencySample } from "../../collectors/latency"
import { theme } from "../../theme"
import { BrailleChart } from "../charts/BrailleChart"

interface LatencyPanelProps {
  latency: LatencySample
  histories: { gateway: number[]; internet: number[]; dns: number[] }
  // per-sample loss fractions; -1 marks samples where the target wasn't probed
  losses: { gateway: number[]; internet: number[]; dns: number[] }
  width: number
}

const CHART_HEIGHT = 2
// Stable links would render as a constant solid band on an absolute scale,
// so charts plot deviation from the window's minimum (i.e. jitter) instead.
// The span floor keeps sub-ms noise from being amplified to full height.
const MIN_SPAN_MS = 5

function latencyColor(ms: number | null, pending: boolean): string {
  if (pending) return theme.dim
  if (ms === null) return theme.red
  if (ms < 30) return theme.green
  if (ms < 100) return theme.yellow
  return theme.red
}

function ms(v: number): string {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

// Windowed average loss in percent, or null with no probe data yet.
function lossPercent(lossHistory: number[]): number | null {
  const probes = lossHistory.filter((v) => v >= 0)
  if (probes.length === 0) return null
  return (probes.reduce((a, b) => a + b, 0) / probes.length) * 100
}

// Sustained loss degrades the link even when replies are fast.
function withLoss(color: string, lossPct: number | null): string {
  if (lossPct === null || lossPct < 1 || color === theme.red) return color
  return lossPct >= 10 ? theme.red : theme.yellow
}

interface LatencyCardProps {
  label: string
  value: number | null
  history: number[]
  lossHistory: number[]
  chartWidth: number
}

function LatencyCard({ label, value, history, lossHistory, chartWidth }: LatencyCardProps) {
  const samples = history.filter((v) => v > 0)
  const pending = value === null && samples.length === 0
  const lossPct = lossPercent(lossHistory)
  const color = withLoss(latencyColor(value, pending), lossPct)
  const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : null
  const worst = samples.length > 0 ? Math.max(...samples) : null

  // baseline-relative: the window's best ping sits at one dot, jitter rises
  const base = samples.length > 0 ? Math.min(...samples) : 0
  const jitter = history.map((v) => (v > 0 ? Math.max(v - base, 0.001) : 0))
  const span = Math.max((worst ?? 0) - base, MIN_SPAN_MS)

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
      <text wrapMode="none">
        <span fg={color}>● </span>
        <span fg={theme.text}>{label} </span>
        <span fg={color}>
          <b>{pending ? "…" : value === null ? "lost" : `${ms(value)}ms`}</b>
        </span>
      </text>
      <BrailleChart
        data={jitter}
        width={chartWidth}
        height={CHART_HEIGHT}
        colors={[color, color]}
        max={span}
      />
      <text wrapMode="none">
        <span fg={theme.dim}>{avg !== null && worst !== null ? `avg ${ms(avg)} · max ${ms(worst)}` : " "}</span>
        {lossPct !== null && lossPct > 0 ? (
          <span fg={lossPct >= 10 ? theme.red : theme.yellow}>
            {` · loss ${lossPct >= 1 ? Math.round(lossPct) : lossPct.toFixed(1)}%`}
          </span>
        ) : null}
      </text>
    </box>
  )
}

export function LatencyPanel({ latency, histories, losses, width }: LatencyPanelProps) {
  // three cards share the inner width; leave a 2-cell gutter between charts
  const chartWidth = Math.max(8, Math.floor((width - 7) / 3))
  return (
    <box
      title=" LATENCY "
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        height: 6,
        flexDirection: "row",
        paddingLeft: 2,
        paddingRight: 1,
      }}
    >
      <LatencyCard
        label="internet"
        value={latency.internetMs}
        history={histories.internet}
        lossHistory={losses.internet}
        chartWidth={chartWidth}
      />
      <LatencyCard
        label="gateway"
        value={latency.gatewayMs}
        history={histories.gateway}
        lossHistory={losses.gateway}
        chartWidth={chartWidth}
      />
      <LatencyCard
        label="dns"
        value={latency.dnsMs}
        history={histories.dns}
        lossHistory={losses.dns}
        chartWidth={chartWidth}
      />
    </box>
  )
}
