import { brailleLines } from "../../lib/braille"
import { theme } from "../../theme"

interface LineChartProps {
  // one history array per line, all sharing the same scale
  series: number[][]
  // one color per series, same order
  colors: readonly string[]
  width: number
  height: number
  // absolute scale ceiling; defaults to the window's peak across all series
  max?: number
}

export function LineChart({ series, colors, width, height, max }: LineChartProps) {
  const rows = brailleLines(series, width, height, max)
  return (
    // pin the height so a full sibling (e.g. a scrollbox) can't squash the
    // chart and make its rows paint over the content below
    <box style={{ flexDirection: "column", height, flexShrink: 0 }}>
      {rows.map((segments, i) => (
        <text key={i} wrapMode="none">
          {segments.map((s, j) => (
            <span key={j} fg={s.series < 0 ? theme.chartTrack : (colors[s.series] ?? "#ffffff")}>
              {s.text}
            </span>
          ))}
        </text>
      ))}
    </box>
  )
}
