import type { RemoteHost } from "../../collectors/traffic"
import { countryTints } from "../../lib/tint"
import { theme } from "../../theme"
import {
  WORLD_COUNTRIES,
  WORLD_COUNTRY_ROWS,
  WORLD_HEIGHT,
  WORLD_LAT_BOTTOM,
  WORLD_LAT_TOP,
  WORLD_ROWS,
  WORLD_WIDTH,
} from "../../lib/worldmap-data"

const LEFT_DOTS = [0x01, 0x02, 0x04, 0x40]
const RIGHT_DOTS = [0x08, 0x10, 0x20, 0x80]

interface WorldMapPanelProps {
  remotes: RemoteHost[]
  width: number
  height: number
  title?: string
}

interface Segment {
  text: string
  color: string
}

export function WorldMapPanel({ remotes, width, height, title }: WorldMapPanelProps) {
  // braille dots are roughly square; the world bitmap is 2.5:1 — honor the
  // aspect ratio whichever dimension is the constraint
  const availRows = Math.max(3, height - 2)
  const mapCells = Math.max(10, Math.min(width, Math.floor((availRows * 4 * 2.5) / 2)))
  const mapRows = Math.max(3, Math.min(availRows, Math.round((mapCells * 2) / 2.5 / 4)))
  const dotHeight = mapRows * 4
  const dotWidth = mapCells * 2

  const countryTint = countryTints(remotes)

  // mark destination dots from remotes that have coordinates, colored with a
  // brightened version of their country's hue
  const markers = new Map<number, string>()
  for (const r of remotes) {
    if (r.lat === null || r.lon === null) continue
    if (r.lat > WORLD_LAT_TOP || r.lat < WORLD_LAT_BOTTOM) continue
    const markerColor = countryTint.get(r.country)?.marker ?? theme.upload
    const x = Math.floor(((r.lon + 180) / 360) * dotWidth)
    const y = Math.floor(((WORLD_LAT_TOP - r.lat) / (WORLD_LAT_TOP - WORLD_LAT_BOTTOM)) * dotHeight)
    const mx = Math.min(dotWidth - 1, Math.max(0, x))
    const my = Math.min(dotHeight - 1, Math.max(0, y))
    markers.set(my * dotWidth + mx, markerColor)
  }

  const worldDot = (x: number, y: number): { land: boolean; country: string } => {
    const wx = Math.floor((x / dotWidth) * WORLD_WIDTH)
    const wy = Math.floor((y / dotHeight) * WORLD_HEIGHT)
    if (WORLD_ROWS[wy]?.[wx] !== "1") return { land: false, country: "" }
    const code = WORLD_COUNTRY_ROWS[wy]?.charCodeAt(wx) ?? 32
    return { land: true, country: code === 32 ? "" : (WORLD_COUNTRIES[code - 48] ?? "") }
  }

  const rows: Segment[][] = []
  for (let cy = 0; cy < mapRows; cy++) {
    const segments: Segment[] = []
    for (let cx = 0; cx < mapCells; cx++) {
      let bits = 0
      let markerColor: string | null = null
      let tint: { level: number; color: string } | null = null
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 4; dy++) {
          const x = cx * 2 + dx
          const y = cy * 4 + dy
          const dotMarker = markers.get(y * dotWidth + x)
          if (dotMarker) markerColor = dotMarker
          const dot = worldDot(x, y)
          if (dot.land) {
            const dotTint = countryTint.get(dot.country)
            if (dotTint && (!tint || dotTint.level > tint.level)) tint = dotTint
          }
          if (dotMarker || dot.land) bits |= (dx === 0 ? LEFT_DOTS : RIGHT_DOTS)[dy] ?? 0
        }
      }
      const color = markerColor ?? tint?.color ?? theme.chartTrack
      const text = String.fromCharCode(0x2800 + bits)
      const last = segments[segments.length - 1]
      if (last && last.color === color) last.text += text
      else segments.push({ text, color })
    }
    rows.push(segments)
  }

  const located = remotes.filter((r) => r.lat !== null).length

  return (
    <box
      title={title ?? ` WORLD · ${located} destinations `}
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        height,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {rows.map((segments, i) => (
        <text key={i} wrapMode="none">
          {segments.map((s, j) => (
            <span key={j} fg={s.color}>
              {s.text}
            </span>
          ))}
        </text>
      ))}
    </box>
  )
}
