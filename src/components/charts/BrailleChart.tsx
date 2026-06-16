import { brailleArea, type ChartSegment } from "../../lib/braille"
import { theme } from "../../theme"

interface BrailleChartProps {
  data: number[]
  width: number
  height: number
  colors: readonly string[]
  mirror?: boolean
  // absolute scale ceiling; defaults to the window's peak
  max?: number
  // custom track character for the first row of a mirrored chart
  topTrackChar?: string
  // custom track character for the last row of a normal chart — draws a zero
  // baseline across the empty area until the first data cell
  bottomTrackChar?: string
  // bright color for the newest (rightmost) column, so the live edge pops
  headColor?: string
}

// Splits the final character off the row's last data segment so it can render
// in the head color. Data is right-aligned, so that character is always the
// newest sample.
function splitHead(segments: ChartSegment[]): { body: ChartSegment[]; head: string } {
  const last = segments[segments.length - 1]
  if (!last || last.track) return { body: segments, head: "" }
  const head = last.text.slice(-1)
  const trimmed = last.text.slice(0, -1)
  const body = trimmed ? [...segments.slice(0, -1), { ...last, text: trimmed }] : segments.slice(0, -1)
  return { body, head }
}

export function BrailleChart({
  data,
  width,
  height,
  colors,
  mirror = false,
  max,
  topTrackChar,
  bottomTrackChar,
  headColor,
}: BrailleChartProps) {
  const rows = brailleArea(data, width, height, mirror, max, topTrackChar, bottomTrackChar)
  const fallback = colors[colors.length - 1] ?? "#ffffff"
  return (
    // pin the height so a full sibling (e.g. a scrollbox) can't squash the
    // chart and make its rows paint over the content below
    <box style={{ flexDirection: "column", height, flexShrink: 0 }}>
      {rows.map((segments, i) => {
        const { body, head } = headColor ? splitHead(segments) : { body: segments, head: "" }
        return (
          <text key={i} wrapMode="none">
            {body.map((s, j) => (
              <span key={j} fg={s.track ? theme.chartTrack : (colors[i] ?? fallback)}>
                {s.text}
              </span>
            ))}
            {head ? <span fg={headColor}>{head}</span> : null}
          </text>
        )
      })}
    </box>
  )
}
