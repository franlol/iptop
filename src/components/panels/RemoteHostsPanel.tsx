import type { RemoteHost } from "../../collectors/traffic"
import { useStickyMax } from "../../hooks/useStickyMax"
import { formatCompact, gaugeParts, padEndTrunc, padStartTrunc } from "../../lib/format"
import { countryTints } from "../../lib/tint"
import { theme } from "../../theme"

interface RemoteHostsPanelProps {
  remotes: RemoteHost[]
  nameWidth: number
}

const GAUGE_W = 8
const RATE_W = 8

// sqrt compresses the dynamic range so a host doing a few KB/s stays visible
// next to one doing MB/s — same scaling the processes panel uses.
const sqrtRatio = (v: number, max: number) => (max <= 0 || v <= 0 ? 0 : Math.min(1, Math.sqrt(v / max)))

export function RemoteHostsPanel({ remotes, nameWidth }: RemoteHostsPanelProps) {
  // sticky + decaying so bars don't all rescale the moment the busiest host
  // quiets down (matches the processes panel)
  const max = useStickyMax(Math.max(...remotes.map((r) => r.rxRate + r.txRate), 1), 0.9)
  // same per-country colors as the world map landmass
  const tints = countryTints(remotes)

  return (
    <box
      title=" REMOTE HOSTS "
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {remotes.length === 0 ? (
        <text fg={theme.dim}>listening for traffic…</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {remotes.map((r) => {
            const gauge = gaugeParts(sqrtRatio(r.rxRate + r.txRate, max), 1, GAUGE_W)
            const tint = r.country ? (tints.get(r.country)?.color ?? theme.text) : theme.text
            // a host shows on the world map only if it has coordinates; mark the
            // located ones with the same brightened hue the map draws their dot,
            // so a row can be traced to its blip (others get a blank gutter)
            const located = r.lat !== null && r.lon !== null
            const marker = (r.country ? tints.get(r.country)?.marker : undefined) ?? theme.upload
            return (
              <text key={r.ip} wrapMode="none">
                <span fg={located ? marker : theme.dim}>{located ? "● " : "  "}</span>
                <span fg={tint}>{padEndTrunc(r.host !== r.ip ? r.host : r.org || r.ip, nameWidth - 2)}</span>
                <span fg={r.country ? tint : theme.dim}>{padEndTrunc(r.country || "—", 3)}</span>
                <span fg={theme.magenta} bg={theme.chartBg}>
                  {gauge.fill}
                </span>
                <span fg={theme.border} bg={theme.chartBg}>
                  {gauge.track}
                </span>
                <span fg={theme.cyan}>{padStartTrunc(`${formatCompact(r.rxRate + r.txRate)}/s`, RATE_W)}</span>
              </text>
            )
          })}
        </scrollbox>
      )}
    </box>
  )
}
