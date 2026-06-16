import type { ProcessConnection, ProcessHistory, ProcessRate, RemoteHost } from "../../collectors/traffic"
import { useStickyMax } from "../../hooks/useStickyMax"
import { formatBytes, formatRate, padEndTrunc, padStartTrunc } from "../../lib/format"
import { remotePort, serviceName } from "../../lib/services"
import { countryTints, fallbackTint, lerpColor } from "../../lib/tint"
import { theme } from "../../theme"
import { BrailleChart } from "../charts/BrailleChart"

interface InspectorPanelProps {
  process: ProcessRate | null
  history: ProcessHistory
  connections: ProcessConnection[]
  remotes: RemoteHost[]
  width: number
}

const RATE_W = 10
const SVC_W = 7
// kept at the hero chart's height so the inspector never out-weighs it
const CHART_H = 3
// brightened edge so the newest column reads as a live cursor (matches HeroPanel)
const RX_HEAD = lerpColor(theme.download, "#ffffff", 0.8)

export function InspectorPanel({ process, history, connections, remotes, width }: InspectorPanelProps) {
  // same per-country colors as the world map and remote hosts
  const tints = countryTints(remotes)
  // the chart slices the last width*2 dots; scale to that window's peak, decaying
  // instead of snapping down so the ceiling doesn't pump on every spike. The
  // chart plots download only, so the scale tracks rx.
  const windowPeak = Math.max(...history.rx.slice(-width * 2), 1)
  const scaleMax = useStickyMax(windowPeak, 0.9, process?.pid)

  if (!process) {
    return (
      <box
        title=" INSPECTOR "
        style={{ border: true, borderStyle: "rounded", borderColor: theme.border, flexGrow: 1, padding: 1 }}
      >
        <text fg={theme.dim}>process exited · esc to go back</text>
      </box>
    )
  }

  const addrWidth = Math.max(12, width - 4 - 3 - SVC_W - 2 * RATE_W)

  return (
    <box
      title={` ⊙ ${process.name} · ${process.pid} `}
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        flexGrow: 1,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {/* height pinned: an auto-height row box next to a scrollbox sibling
          mis-measures and the chart below loses a row to it */}
      <box style={{ flexDirection: "row", justifyContent: "space-between", height: 1, flexShrink: 0 }}>
        <text wrapMode="none">
          <span fg={theme.download}>
            <b>▼ {formatRate(process.rxRate)}</b>
          </span>{" "}
          <span fg={theme.upload}>
            <b>▲ {formatRate(process.txRate)}</b>
          </span>
        </text>
        <text fg={theme.dim} wrapMode="none">
          Σ <span fg={theme.download}>▼</span> {formatBytes(process.rxTotal)} <span fg={theme.upload}>▲</span>{" "}
          {formatBytes(process.txTotal)}
        </text>
      </box>
      <BrailleChart
        data={history.rx}
        width={width}
        height={CHART_H}
        colors={theme.downloadGradient}
        max={scaleMax}
        headColor={RX_HEAD}
        bottomTrackChar="⣀"
      />
      {/* count on the left, the chart's scale ceiling on the right so the
          braille has a readable y-axis without spending a row on it */}
      <box style={{ flexDirection: "row", justifyContent: "space-between", height: 1, flexShrink: 0 }}>
        <text fg={theme.dim} wrapMode="none">{`CONNECTIONS · ${connections.length}`}</text>
        <text fg={theme.dim} wrapMode="none">
          ┄ peak {formatRate(scaleMax)}
        </text>
      </box>
      {/* spacer so the chart and its peak label read separate from the table */}
      <box style={{ height: 1, flexShrink: 0 }} />
      {/* column headers, padded to the same widths as the rows below so they align */}
      <text fg={theme.dim} wrapMode="none" style={{ flexShrink: 0 }}>
        {padEndTrunc("CC", 3)}
        {padEndTrunc("SVC", SVC_W)}
        {padEndTrunc("REMOTE", addrWidth)}
        {padStartTrunc("▼ RX", RATE_W)}
        {padStartTrunc("▲ TX", RATE_W)}
      </text>
      <scrollbox style={{ flexGrow: 1 }}>
        {connections.map((c, i) => {
          const port = remotePort(c.remote)
          const svc = port !== null ? serviceName(port) : ""
          return (
            <text key={`${c.local}-${c.remote}-${i}`} wrapMode="none">
              <span fg={c.country ? (tints.get(c.country)?.color ?? fallbackTint(c.country)) : theme.dim}>
                {padEndTrunc(c.country || "—", 3)}
              </span>
              <span fg={svc ? theme.text : theme.dim}>
                {padEndTrunc(svc || (port !== null ? `:${port}` : "—"), SVC_W)}
              </span>
              <span fg={theme.cyan}>{padEndTrunc(c.remoteDisplay, addrWidth)}</span>
              <span fg={c.rxRate > 0 ? theme.download : theme.dim}>
                {padStartTrunc(c.rxRate > 0 ? formatRate(c.rxRate) : "—", RATE_W)}
              </span>
              <span fg={c.txRate > 0 ? theme.upload : theme.dim}>
                {padStartTrunc(c.txRate > 0 ? formatRate(c.txRate) : "—", RATE_W)}
              </span>
            </text>
          )
        })}
      </scrollbox>
      <text fg={theme.dim} wrapMode="none">
        esc back
      </text>
    </box>
  )
}
