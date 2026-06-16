const BRAILLE_BASE = 0x2800
const LEFT_DOTS = [0x01, 0x02, 0x04, 0x40]
const RIGHT_DOTS = [0x08, 0x10, 0x20, 0x80]

export interface ChartSegment {
  text: string
  // Track segments are the empty area above/below the chart.
  track: boolean
}

export interface LineSegment {
  text: string
  // Index into the caller's series array; -1 for empty track cells.
  series: number
}

const TRACK_CELL = "⠀" // blank braille cell — empty area stays clean

// Renders an area chart as `height` rows of braille cells (2x4 dots each),
// newest data right-aligned. With `mirror` the area hangs from the top edge
// instead of rising from the bottom. Cells with no lit dots become track
// segments so the caller can color the empty area differently. Pass
// `fixedMax` for an absolute scale instead of scaling to the window's peak.
// `topTrackChar` overrides the track character for the first row of a mirrored
// chart; `bottomTrackChar` does the same for the last row of a normal chart.
// Both disappear as data fills those rows.
export function brailleArea(
  data: number[],
  width: number,
  height: number,
  mirror = false,
  fixedMax?: number,
  topTrackChar?: string,
  bottomTrackChar?: string,
): ChartSegment[][] {
  const dotWidth = width * 2
  const dotHeight = height * 4
  const points = data.slice(-dotWidth).map((v) => (fixedMax ? Math.min(v, fixedMax) : v))
  const max = fixedMax ?? Math.max(...points, 1)

  const heights = new Array<number>(dotWidth).fill(0)
  const offset = dotWidth - points.length
  points.forEach((v, i) => {
    heights[offset + i] = v <= 0 ? 0 : Math.max(1, Math.round((v / max) * dotHeight))
  })

  const rows: ChartSegment[][] = []
  for (let row = 0; row < height; row++) {
    const segments: ChartSegment[] = []
    for (let cell = 0; cell < width; cell++) {
      let bits = 0
      for (let dx = 0; dx < 2; dx++) {
        const h = heights[cell * 2 + dx] ?? 0
        const dots = dx === 0 ? LEFT_DOTS : RIGHT_DOTS
        for (let dy = 0; dy < 4; dy++) {
          const dotRow = row * 4 + dy
          const filled = mirror ? dotRow < h : dotRow >= dotHeight - h
          if (filled) bits |= dots[dy] ?? 0
        }
      }
      const track = bits === 0
      let trackChar = TRACK_CELL
      if (mirror && row === 0 && topTrackChar) trackChar = topTrackChar
      else if (!mirror && row === height - 1 && bottomTrackChar) trackChar = bottomTrackChar
      const text = track ? trackChar : String.fromCharCode(BRAILLE_BASE + bits)
      const last = segments[segments.length - 1]
      if (last && last.track === track) last.text += text
      else segments.push({ text, track })
    }
    rows.push(segments)
  }
  return rows
}

// Renders one or more series as 1-dot-thick lines (outline only, no fill),
// newest data right-aligned. Consecutive samples are connected with vertical
// dot runs so the line reads as continuous. Each braille cell can only take
// one color, so where lines overlap the cell goes to the series with more lit
// dots in it (ties favor the later series, drawn "on top"). All series share
// one scale: `fixedMax` or the max across every series in the window.
export function brailleLines(
  seriesList: number[][],
  width: number,
  height: number,
  fixedMax?: number,
): LineSegment[][] {
  const dotWidth = width * 2
  const dotHeight = height * 4
  const sliced = seriesList.map((s) => s.slice(-dotWidth))
  const max = fixedMax ?? Math.max(...sliced.flat(), 1)

  // owner[y][x] = series index that lit this dot, -1 if unlit
  const owner: number[][] = Array.from({ length: dotHeight }, () => new Array<number>(dotWidth).fill(-1))
  sliced.forEach((points, si) => {
    const offset = dotWidth - points.length
    const ys = points.map((v) => {
      const clamped = Math.min(Math.max(v, 0), max)
      return dotHeight - 1 - Math.round((clamped / max) * (dotHeight - 1))
    })
    ys.forEach((y, i) => {
      const x = offset + i
      const prev = i > 0 ? (ys[i - 1] ?? y) : y
      const lo = Math.min(y, prev)
      const hi = Math.max(y, prev)
      for (let yy = lo; yy <= hi; yy++) {
        const rowOwner = owner[yy]
        if (rowOwner) rowOwner[x] = si
      }
    })
  })

  const rows: LineSegment[][] = []
  for (let row = 0; row < height; row++) {
    const segments: LineSegment[] = []
    for (let cell = 0; cell < width; cell++) {
      let bits = 0
      const counts = new Map<number, number>()
      for (let dx = 0; dx < 2; dx++) {
        const dots = dx === 0 ? LEFT_DOTS : RIGHT_DOTS
        for (let dy = 0; dy < 4; dy++) {
          const o = owner[row * 4 + dy]?.[cell * 2 + dx] ?? -1
          if (o >= 0) {
            bits |= dots[dy] ?? 0
            counts.set(o, (counts.get(o) ?? 0) + 1)
          }
        }
      }
      let series = -1
      let best = 0
      for (const [s, n] of counts) {
        if (n > best || (n === best && s > series)) {
          series = s
          best = n
        }
      }
      const text = bits === 0 ? TRACK_CELL : String.fromCharCode(BRAILLE_BASE + bits)
      const last = segments[segments.length - 1]
      if (last && last.series === series) last.text += text
      else segments.push({ text, series })
    }
    rows.push(segments)
  }
  return rows
}
