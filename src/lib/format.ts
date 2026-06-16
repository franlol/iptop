const UNITS = ["B", "KB", "MB", "GB", "TB"]
const COMPACT_UNITS = ["B", "K", "M", "G", "T"]

function scaleBytes(n: number): { value: string; unit: string } {
  let value = n
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
  return { value: value.toFixed(digits), unit: UNITS[unit] ?? "B" }
}

export function formatBytes(n: number): string {
  const { value, unit } = scaleBytes(n)
  return `${value} ${unit}`
}

// Rate split into number and unit so callers can typeset them differently
// (e.g. the hero panel's large ASCII-font readout).
export function splitRate(n: number): { value: string; unit: string } {
  const { value, unit } = scaleBytes(n)
  return { value, unit: `${unit}/s` }
}

export function formatRate(n: number): string {
  return `${formatBytes(n)}/s`
}

export function formatCompact(n: number): string {
  if (n < 1) return "0"
  let value = n
  let unit = 0
  while (value >= 1024 && unit < COMPACT_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)}${COMPACT_UNITS[unit]}`
}

const FILL_EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

export interface GaugeParts {
  fill: string
  track: string
}

// Solid-block fill over a dashed-line track; render the two parts as
// separate spans so the track can be dimmer than the fill.
export function gaugeParts(value: number, max: number, width: number): GaugeParts {
  const ratio = max <= 0 || value <= 0 ? 0 : Math.min(1, value / max)
  const eighths = ratio === 0 ? 0 : Math.max(1, Math.round(ratio * width * 8))
  const full = Math.floor(eighths / 8)
  const partial = FILL_EIGHTHS[eighths % 8] ?? ""
  const fill = "█".repeat(full) + partial
  return { fill, track: "╌".repeat(width - fill.length) }
}

export interface MirrorGaugeParts {
  leftTrack: string
  // left-eighths glyph for the rx boundary cell; draw it inverted (fg = the
  // surface color, bg = the fill color) so the ink reads as right-aligned
  leftPartial: string
  leftFill: string
  rightFill: string
  rightPartial: string
  rightTrack: string
}

// Center-pivot gauge: rx grows leftward, tx rightward, both sides scaled to
// the same max so rows compare across the pivot. `width` includes the pivot
// cell, which the caller renders between the two halves. Unicode only has
// left-aligned partial blocks, hence the inverted leftPartial cell.
export function mirrorGaugeParts(rx: number, tx: number, max: number, width: number): MirrorGaugeParts {
  const side = Math.floor((width - 1) / 2)
  const eighthsFor = (v: number) => {
    const ratio = max <= 0 || v <= 0 ? 0 : Math.min(1, v / max)
    return ratio === 0 ? 0 : Math.max(1, Math.round(ratio * side * 8))
  }
  const le = eighthsFor(rx)
  const lFull = Math.floor(le / 8)
  const lPart = le % 8
  const re = eighthsFor(tx)
  const rFull = Math.floor(re / 8)
  const rPart = re % 8
  return {
    leftTrack: "░".repeat(side - lFull - (lPart ? 1 : 0)),
    leftPartial: lPart ? (FILL_EIGHTHS[8 - lPart] ?? "") : "",
    leftFill: "█".repeat(lFull),
    rightFill: "█".repeat(rFull),
    rightPartial: FILL_EIGHTHS[rPart] ?? "",
    rightTrack: "░".repeat(side - rFull - (rPart ? 1 : 0)),
  }
}

export function padEndTrunc(s: string, width: number): string {
  if (s.length > width) return `${s.slice(0, Math.max(0, width - 1))}…`
  return s.padEnd(width)
}

export function padStartTrunc(s: string, width: number): string {
  if (s.length > width) return `${s.slice(0, Math.max(0, width - 1))}…`
  return s.padStart(width)
}
