import type { Connection } from "../../collectors/connections"
import { formatCompact, padEndTrunc, padStartTrunc } from "../../lib/format"
import { theme } from "../../theme"

interface ConnectionsPanelProps {
  connections: Connection[]
  rates: Map<string, { rxRate: number; txRate: number }>
  nameWidth: number
}

const RATE_W = 7

function stateDot(state: string): { dot: string; color: string } {
  if (state === "ESTABLISHED") return { dot: "●", color: theme.green }
  if (state === "LISTEN") return { dot: "◌", color: theme.accent }
  return { dot: "·", color: theme.dim }
}

export function ConnectionsPanel({ connections, rates, nameWidth }: ConnectionsPanelProps) {
  const established = connections.filter((c) => c.state === "ESTABLISHED").length
  const listening = connections.filter((c) => c.state === "LISTEN").length

  const rateOf = (c: Connection) => {
    const r = rates.get(`${c.local}|${c.remote}`)
    return r ? r.rxRate + r.txRate : 0
  }
  // Coarse base-4 buckets instead of raw rates: rows only trade places on
  // order-of-magnitude changes, so the list doesn't reshuffle every sample.
  // Stable sort keeps the collector's order (established → listeners,
  // alphabetical) within a bucket.
  const bucketOf = (c: Connection) => {
    const rate = rateOf(c)
    return rate < 1 ? 0 : Math.floor(Math.log2(rate) / 2) + 1
  }
  const sorted = [...connections].sort((a, b) => bucketOf(b) - bucketOf(a))

  // fit the name column to the longest visible command — a fixed width pads
  // short names into a gap before the rate column; the prop only caps it
  const nameW = Math.min(nameWidth, Math.max(4, ...sorted.map((c) => (c.command || "—").length)))

  return (
    <box
      title={` CONNECTIONS ● ${established} ◌ ${listening} `}
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
      {sorted.length === 0 ? (
        <text fg={theme.dim}>no connections…</text>
      ) : (
      <scrollbox style={{ flexGrow: 1 }}>
        {sorted.map((c) => {
          const { dot, color } = stateDot(c.state)
          const rate = rateOf(c)
          return (
            // key mirrors the collector's dedup key, so it's unique without an index
            <text key={`${c.pid}-${c.protocol}-${c.local}-${c.remote}-${c.state}`} wrapMode="none">
              <span fg={color}>{dot} </span>
              {/* ss omits process info for sockets we don't own (needs root) */}
              <span fg={c.command ? theme.text : theme.dim}>{padEndTrunc(c.command || "—", nameW)}</span>
              <span fg={rate > 0 ? theme.cyan : theme.dim}>{padStartTrunc(formatCompact(rate), RATE_W)} </span>
              {c.remote ? (
                <span>
                  <span fg={theme.dim}>→ </span>
                  <span fg={theme.cyan}>{c.remoteDisplay}</span>
                </span>
              ) : (
                <span fg={theme.dim}>{c.local}</span>
              )}
            </text>
          )
        })}
      </scrollbox>
      )}
    </box>
  )
}
