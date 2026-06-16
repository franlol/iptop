import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import type React from "react"
import { formatCompact, padEndTrunc, padStartTrunc } from "./lib/format"
import { theme } from "./theme"

// ── dummy data ───────────────────────────────────────────────────────────
// "node" is huge on purpose so linear scaling visibly crushes the rest;
// spotify/firefox are idle. rx = download, tx = upload (bytes/s).
interface P {
  name: string
  pid: number
  rx: number
  tx: number
}
const PROCS: P[] = [
  { name: "node", pid: 4821, rx: 512_000, tx: 90_000 },
  { name: "claude", pid: 1290, rx: 4_200, tx: 700 },
  { name: "bun", pid: 3310, rx: 1_100, tx: 300 },
  { name: "chrome", pid: 880, rx: 27, tx: 4 },
  { name: "spotify", pid: 2044, rx: 0, tx: 0 },
  { name: "firefox", pid: 1572, rx: 0, tx: 0 },
]
const MAX = Math.max(...PROCS.flatMap((p) => [p.rx, p.tx]), 1)
const MAX_TOTAL = Math.max(...PROCS.map((p) => p.rx + p.tx), 1)

// synthetic recent history per pid for the sparkline style
function fakeHistory(p: P, n = 30): number[] {
  const base = p.rx + p.tx
  return Array.from({ length: n }, (_, i) => {
    const wobble = 0.5 + 0.5 * Math.sin(i * 0.6 + p.pid)
    const spike = i === n - 6 ? 1.8 : 1
    return Math.max(0, base * wobble * spike)
  })
}

// sqrt compresses the dynamic range so small flows stay visible next to a
// process doing 100× their rate.
const sqrtRatio = (v: number, max: number) => (max <= 0 || v <= 0 ? 0 : Math.min(1, Math.sqrt(v / max)))

const NAME_W = 9
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

// solid fill of `cells` width from a 0..1 ratio, with eighth-block tip
function fillFor(ratio: number, cells: number): { full: string; partial: string } {
  const e = ratio <= 0 ? 0 : Math.max(1, Math.round(ratio * cells * 8))
  return { full: "█".repeat(Math.floor(e / 8)), partial: EIGHTHS[e % 8] ?? "" }
}

const stateGlyph = (p: P) => (p.rx + p.tx >= 1 ? "● " : "○ ")
const stateColor = (p: P) => (p.rx + p.tx >= 1 ? theme.green : theme.dim)
const nameColor = (p: P) => (p.rx + p.tx >= 1 ? theme.text : theme.dim)

function Lead({ p }: { p: P }) {
  return (
    <>
      <span fg={stateColor(p)}>{stateGlyph(p)}</span>
      <span fg={nameColor(p)}>{padEndTrunc(p.name, NAME_W)} </span>
    </>
  )
}

// ── 1. mirror / pivot (calm: flat hue, dark strip, sqrt) ──────────────────
const M_SIDE = 7
function Mirror({ p }: { p: P }) {
  // left side: full blocks right-aligned against the pivot (no sub-cell tip,
  // since Unicode partials only point one way); right side uses the tip.
  const lFull = Math.round(sqrtRatio(p.rx, MAX) * M_SIDE)
  const r = fillFor(sqrtRatio(p.tx, MAX), M_SIDE)
  const rUsed = r.full.length + (r.partial ? 1 : 0)
  const surface = theme.chartBg
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={theme.dim} bg={surface}>
        {" ".repeat(M_SIDE - lFull)}
      </span>
      <span fg={theme.download} bg={surface}>
        {"█".repeat(lFull)}
      </span>
      <span fg={theme.dim} bg={surface}>
        ┊
      </span>
      <span fg={theme.upload} bg={surface}>
        {r.full}
        {r.partial}
      </span>
      <span fg={theme.dim} bg={surface}>
        {" ".repeat(M_SIDE - rUsed)}
      </span>
      <span fg={theme.cyan}> {padStartTrunc(formatCompact(p.rx + p.tx), 6)}</span>
    </text>
  )
}

// ── 2. stacked split bar (rx segment + tx segment, sqrt of total) ─────────
const S_W = 16
function StackedSplit({ p }: { p: P }) {
  const total = p.rx + p.tx
  const totalCells = sqrtRatio(total, MAX_TOTAL) * S_W
  const rxCells = total > 0 ? Math.round(totalCells * (p.rx / total)) : 0
  const txCells = Math.max(0, Math.round(totalCells) - rxCells)
  const empty = S_W - rxCells - txCells
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={theme.download} bg={theme.chartBg}>
        {"█".repeat(rxCells)}
      </span>
      <span fg={theme.upload} bg={theme.chartBg}>
        {"█".repeat(txCells)}
      </span>
      <span bg={theme.chartBg}>{" ".repeat(Math.max(0, empty))}</span>
      <span fg={theme.cyan}> {padStartTrunc(formatCompact(total), 6)}</span>
    </text>
  )
}

// ── 3. dual stacked bars (rx top-half, tx bottom-half, one row) ───────────
const D_W = 16
function DualHalf({ p }: { p: P }) {
  const rx = Math.round(sqrtRatio(p.rx, MAX) * D_W)
  const tx = Math.round(sqrtRatio(p.tx, MAX) * D_W)
  const cells = Array.from({ length: D_W }, (_, c) => {
    const r = c < rx
    const t = c < tx
    if (r && t) return { ch: "▀", fg: theme.download, bg: theme.upload }
    if (r) return { ch: "▀", fg: theme.download, bg: theme.chartBg }
    if (t) return { ch: "▄", fg: theme.upload, bg: theme.chartBg }
    return { ch: " ", fg: theme.dim, bg: theme.chartBg }
  })
  return (
    <text wrapMode="none">
      <Lead p={p} />
      {cells.map((c, i) => (
        <span key={i} fg={c.fg} bg={c.bg}>
          {c.ch}
        </span>
      ))}
      <span fg={theme.cyan}> {padStartTrunc(formatCompact(p.rx + p.tx), 6)}</span>
    </text>
  )
}

// ── 4. sparkline trail (braille, 2 samples/cell, recent history) ──────────
const SPARK_W = 12
const LVL_L = [0, 0x40, 0x44, 0x46, 0x47]
const LVL_R = [0, 0x80, 0xa0, 0xb0, 0xb8]
function brailleSpark(samples: number[], max: number, width: number): string {
  let out = ""
  for (let c = 0; c < width; c++) {
    const a = samples[2 * c] ?? 0
    const b = samples[2 * c + 1] ?? 0
    const ha = Math.round(sqrtRatio(a, max) * 4)
    const hb = Math.round(sqrtRatio(b, max) * 4)
    out += String.fromCharCode(0x2800 | (LVL_L[ha] ?? 0) | (LVL_R[hb] ?? 0))
  }
  return out
}
function Spark({ p }: { p: P }) {
  const hist = fakeHistory(p, SPARK_W * 2)
  const active = p.rx + p.tx >= 1
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={active ? theme.green : theme.dim} bg={theme.chartBg}>
        {brailleSpark(hist, MAX_TOTAL, SPARK_W)}
      </span>
      <span fg={theme.cyan}> {padStartTrunc(formatCompact(p.rx + p.tx), 6)}</span>
    </text>
  )
}

// ── 5. numbers-first (aligned ▼/▲ columns, intensity by magnitude) ────────
function heat(v: number, max: number, ramp: readonly string[]): string {
  if (v <= 0) return theme.dim
  const idx = Math.min(ramp.length - 1, Math.floor(sqrtRatio(v, max) * ramp.length))
  return ramp[ramp.length - 1 - idx] ?? (ramp[0] as string)
}
function NumbersFirst({ p }: { p: P }) {
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={theme.dim}> ▼</span>
      <span fg={heat(p.rx, MAX, theme.downloadGradient)}> {padStartTrunc(formatCompact(p.rx), 6)}</span>
      <span fg={theme.dim}>   ▲</span>
      <span fg={heat(p.tx, MAX, theme.uploadGradient)}> {padStartTrunc(formatCompact(p.tx), 6)}</span>
    </text>
  )
}

// ── 6. heat badge (intensity dots + number) ───────────────────────────────
function HeatBadge({ p }: { p: P }) {
  const total = p.rx + p.tx
  const lvl = Math.round(sqrtRatio(total, MAX_TOTAL) * 5)
  const dots = "●".repeat(lvl) + "·".repeat(5 - lvl)
  const color = heat(total, MAX_TOTAL, theme.downloadGradient)
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={color}>{dots}</span>
      <span fg={theme.cyan}>  {padStartTrunc(formatCompact(total), 6)}</span>
      <span fg={p.tx > 0 ? theme.upload : theme.dim}>  ▲{padStartTrunc(formatCompact(p.tx), 5)}</span>
    </text>
  )
}

// ── 7. bar + number + trend arrow ─────────────────────────────────────────
const B_W = 10
function BarTrend({ p }: { p: P }) {
  const total = p.rx + p.tx
  const f = fillFor(sqrtRatio(total, MAX_TOTAL), B_W)
  const used = f.full.length + (f.partial ? 1 : 0)
  // fake trend from the synthetic history (last vs mean)
  const h = fakeHistory(p)
  const mean = h.reduce((a, b) => a + b, 0) / h.length
  const last = h[h.length - 1] ?? 0
  const arrow = total < 1 ? "·" : last > mean * 1.15 ? "↑" : last < mean * 0.85 ? "↓" : "→"
  const arrowColor = arrow === "↑" ? theme.green : arrow === "↓" ? theme.red : theme.dim
  return (
    <text wrapMode="none">
      <Lead p={p} />
      <span fg={theme.download} bg={theme.chartBg}>
        {f.full}
        {f.partial}
      </span>
      <span bg={theme.chartBg}>{" ".repeat(Math.max(0, B_W - used))}</span>
      <span fg={theme.cyan}> {padStartTrunc(formatCompact(total), 6)}</span>
      <span fg={arrowColor}> {arrow}</span>
    </text>
  )
}

const STYLES: { title: string; Row: (props: { p: P }) => React.ReactNode }[] = [
  { title: "1 · MIRROR / PIVOT (calm, sqrt)", Row: Mirror },
  { title: "2 · STACKED SPLIT BAR", Row: StackedSplit },
  { title: "3 · DUAL HALF-BARS (rx top / tx bottom)", Row: DualHalf },
  { title: "4 · SPARKLINE TRAIL (braille)", Row: Spark },
  { title: "5 · NUMBERS-FIRST", Row: NumbersFirst },
  { title: "6 · HEAT BADGE", Row: HeatBadge },
  { title: "7 · BAR + NUMBER + TREND", Row: BarTrend },
]

function Demo() {
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg, padding: 1 }}>
      <text fg={theme.accent}> PROCESSES panel — 7 style options · same dummy data · press q / ctrl-c to quit</text>
      <box style={{ flexDirection: "row", flexWrap: "wrap", flexGrow: 1 }}>
        {STYLES.map((s) => (
          <box
            key={s.title}
            title={` ${s.title} `}
            style={{
              border: true,
              borderStyle: "rounded",
              borderColor: theme.border,
              flexDirection: "column",
              paddingLeft: 1,
              paddingRight: 1,
              width: 44,
              marginRight: 1,
            }}
          >
            {PROCS.map((p) => (
              <s.Row key={p.pid} p={p} />
            ))}
          </box>
        ))}
      </box>
    </box>
  )
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30 })
createRoot(renderer).render(<Demo />)
