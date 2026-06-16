import type { ScrollBoxRenderable } from "@opentui/core"
import { useEffect, useRef } from "react"
import type { ProcessRate } from "../../collectors/traffic"
import { useStickyMax } from "../../hooks/useStickyMax"
import { formatCompact, padEndTrunc, padStartTrunc } from "../../lib/format"
import { theme } from "../../theme"

export type ProcessSort = "rate" | "total"

interface ProcessesPanelProps {
  processes: ProcessRate[]
  sort: ProcessSort
  selectedIndex: number
  nameWidth: number
}

const BAR_W = 12
const RATE_W = 5

// sqrt compresses the dynamic range so a process doing 1 KB/s stays visible
// next to one doing 1 MB/s; the bar length still reads as "more = bigger".
const sqrtRatio = (v: number, max: number) => (max <= 0 || v <= 0 ? 0 : Math.min(1, Math.sqrt(v / max)))

export function ProcessesPanel({ processes, sort, selectedIndex, nameWidth }: ProcessesPanelProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  useEffect(() => {
    const pid = processes[selectedIndex]?.pid
    if (pid !== undefined) scrollRef.current?.scrollChildIntoView(`proc-${pid}`)
  }, [selectedIndex])

  // bar and numbers describe the same quantity: live rate, or lifetime total
  const comp = (p: ProcessRate): [number, number] =>
    sort === "rate" ? [p.rxRate, p.txRate] : [p.rxTotal, p.txTotal]
  const max = useStickyMax(
    Math.max(
      ...processes.map((p) => {
        const [rx, tx] = comp(p)
        return rx + tx
      }),
      1,
    ),
    0.9,
    sort,
  )

  return (
    <box
      title={` PROCESSES · ▼ ▲ · by ${sort === "rate" ? "rate" : "Σ total"} `}
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
      <scrollbox ref={scrollRef} style={{ flexGrow: 1 }}>
        {processes.map((p, i) => {
          const [rx, tx] = comp(p)
          const total = rx + tx
          const active = p.rxRate + p.txRate >= 1
          const selected = i === selectedIndex
          const surface = selected ? theme.track : theme.chartBg

          // single magenta bar: rx (█) then tx (▒), sqrt-scaled length.
          const cells = total > 0 ? Math.max(1, Math.round(sqrtRatio(total, max) * BAR_W)) : 0
          let rxCells = total > 0 ? Math.round(cells * (rx / total)) : 0
          let txCells = cells - rxCells
          if (cells >= 2) {
            if (rx > 0 && rxCells === 0) { rxCells = 1; txCells = cells - 1 }
            else if (tx > 0 && txCells === 0) { txCells = 1; rxCells = cells - 1 }
          }
          const empty = BAR_W - cells

          // name bright, "(pid)" dim right after it — the name is what the
          // eye scans for; remaining padding keeps the bar column aligned
          const pidStr = ` (${p.pid})`
          const maxName = Math.max(1, nameWidth - pidStr.length)
          const nameText = p.name.length > maxName ? padEndTrunc(p.name, maxName) : p.name
          const pad = Math.max(0, nameWidth - nameText.length - pidStr.length)

          return (
            <text key={p.pid} id={`proc-${p.pid}`} bg={selected ? theme.track : undefined} wrapMode="none">
              <span fg={selected ? theme.accent : active ? theme.green : theme.dim}>
                {selected ? "▸ " : active ? "● " : "○ "}
              </span>
              <span fg={selected ? theme.text : active ? theme.text : theme.dim}>{nameText}</span>
              <span fg={theme.dim}>{pidStr}</span>
              <span>{" ".repeat(pad + 1)}</span>
              <span fg={theme.magenta} bg={surface}>{"█".repeat(rxCells)}</span>
              <span fg={theme.magenta} bg={surface}>{"▒".repeat(txCells)}</span>
              <span bg={surface}>{" ".repeat(empty)}</span>
              <span fg={active ? theme.magenta : theme.dim}> ▼</span>
              <span fg={active ? theme.text : theme.dim}>{padStartTrunc(formatCompact(rx), RATE_W)}</span>
              <span fg={active ? theme.magentaDim : theme.dim}> ▲</span>
              <span fg={active ? theme.text : theme.dim}>{padStartTrunc(formatCompact(tx), RATE_W)}</span>
            </text>
          )
        })}
      </scrollbox>
    </box>
  )
}
