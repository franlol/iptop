import type { Connection } from "../../collectors/connections"
import { useStickyMax } from "../../hooks/useStickyMax"
import { formatCompact, mirrorGaugeParts, padEndTrunc, padStartTrunc } from "../../lib/format"
import { aggregateServices } from "../../lib/services"
import { theme } from "../../theme"

interface ServicesPanelProps {
  connections: Connection[]
  rates: Map<string, { rxRate: number; txRate: number }>
}

const NAME_W = 9
const PROTO_W = 5
// right-aligned so digits line up; 5-digit ports (60123) + a gap fit
const PORT_W = 6
// odd so the pivot sits dead center
const GAUGE_W = 11
const RATE_W = 6
const MAX_ROWS = 6

export function ServicesPanel({ connections, rates }: ServicesPanelProps) {
  const services = aggregateServices(connections, rates)
  // a full half-bar = the largest single-direction flow on screen
  const max = useStickyMax(Math.max(...services.flatMap((s) => [s.rxRate, s.txRate]), 1))
  // size to content; scrollbox takes over past MAX_ROWS. +1 for the header row
  // (only when there are rows to label), +2 for the box border.
  const rows = Math.min(Math.max(services.length, 1), MAX_ROWS)
  const height = (services.length === 0 ? 1 : rows + 1) + 2

  return (
    <box
      title=" SERVICES "
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        height,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {services.length === 0 ? (
        <text fg={theme.dim}>no active connections…</text>
      ) : (
        <>
          {/* Legend: DOWN/UP sit over the two halves of the gauge and reuse the
              bar colors, so the center-pivot mirror reads without guesswork.
              flexShrink:0 keeps the header's line when the column squeezes the
              panel — otherwise it collapses and the scrollbox rows draw over it. */}
          <text wrapMode="none" style={{ flexShrink: 0 }}>
            <span fg={theme.dim}>{padEndTrunc("name", NAME_W)}</span>
            <span fg={theme.dim}>{padEndTrunc("proto", PROTO_W)}</span>
            <span fg={theme.dim}>{padStartTrunc("port", PORT_W)}</span>
            <span>  </span>
            <span fg={theme.download}> DOWN</span>
            <span fg={theme.dim}>┊</span>
            <span fg={theme.upload}>UP   </span>
            <span>  </span>
            <span fg={theme.dim}>{padStartTrunc("RATE", RATE_W)}</span>
          </text>
          <scrollbox style={{ flexGrow: 1 }}>
          {services.map((s) => {
            const gauge = mirrorGaugeParts(s.rxRate, s.txRate, max, GAUGE_W)
            return (
              <text key={s.key} wrapMode="none">
                <span fg={s.name ? theme.text : theme.dim}>{padEndTrunc(s.name || "—", NAME_W)}</span>
                <span fg={theme.dim}>{padEndTrunc(s.protocol.toLowerCase(), PROTO_W)}</span>
                <span fg={theme.dim}>{padStartTrunc(`:${s.port}`, PORT_W)}</span>
                <span>  </span>
                <span fg={theme.border} bg={theme.chartBg}>
                  {gauge.leftTrack}
                </span>
                {gauge.leftPartial ? (
                  <span fg={theme.chartBg} bg={theme.download}>
                    {gauge.leftPartial}
                  </span>
                ) : null}
                <span fg={theme.download} bg={theme.chartBg}>
                  {gauge.leftFill}
                </span>
                <span fg={theme.dim} bg={theme.chartBg}>
                  ┊
                </span>
                <span fg={theme.upload} bg={theme.chartBg}>
                  {gauge.rightFill}
                  {gauge.rightPartial}
                </span>
                <span fg={theme.border} bg={theme.chartBg}>
                  {gauge.rightTrack}
                </span>
                <span>  </span>
                <span fg={s.rate > 0 ? theme.cyan : theme.dim}>
                  {padStartTrunc(`${formatCompact(s.rate)}/s`, RATE_W)}
                </span>
              </text>
            )
          })}
          </scrollbox>
        </>
      )}
    </box>
  )
}
