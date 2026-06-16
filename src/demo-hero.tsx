import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import type React from "react"
import { BrailleChart } from "./components/charts/BrailleChart"
import { formatBytes, formatRate } from "./lib/format"
import { theme } from "./theme"

// ── dummy data ───────────────────────────────────────────────────────────
// Download is a busy wave that fills the top chart. Upload deliberately ramps
// from near-zero on the left to a peak on the right, so the "separator that
// disappears as the graph grows" variants visibly clear from left to right.
const W = 40
const rxHistory = Array.from({ length: W }, (_, i) => {
  const wobble = 0.55 + 0.45 * Math.sin(i * 0.5)
  const spike = i === W - 8 ? 1.7 : 1
  return Math.max(0, 480_000 * wobble * spike)
})
const txHistory = Array.from({ length: W }, (_, i) => {
  // ramp 0 → 1 across the width, with a little texture
  const ramp = i / (W - 1)
  const wobble = 0.7 + 0.3 * Math.sin(i * 0.8)
  return Math.max(0, 120_000 * ramp * ramp * wobble)
})
const rxRate = rxHistory[rxHistory.length - 1] ?? 0
const txRate = txHistory[txHistory.length - 1] ?? 0
const rxTotal = 8_400_000_000
const txTotal = 1_200_000_000

const CHART_W = W

// ── shared stats row (matches HeroPanel) ──────────────────────────────────
function seriesStats(history: number[]): { peak: number; avg: number } {
  if (history.length === 0) return { peak: 0, avg: 0 }
  return {
    peak: Math.max(...history),
    avg: history.reduce((a, b) => a + b, 0) / history.length,
  }
}

function StatsRow({
  arrow,
  rate,
  color,
  history,
  total,
}: {
  arrow: string
  rate: number
  color: string
  history: number[]
  total: number
}) {
  const { peak, avg } = seriesStats(history)
  return (
    <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <text wrapMode="none">
        <span fg={color}>
          <b>
            {arrow} {formatRate(rate)}
          </b>
        </span>
      </text>
      <text fg={theme.dim} wrapMode="none">
        peak {formatBytes(peak)}/s · avg {formatBytes(avg)}/s · Σ {formatBytes(total)}
      </text>
    </box>
  )
}

// Top half (download) is identical across every variant; only what sits
// between the two charts changes. `Separator` is rendered between them, and
// `uploadTrackChar` feeds the upload chart's disappearing-track feature.
function HeroVariant({
  Separator,
  uploadTrackChar,
}: {
  Separator?: () => React.ReactNode
  uploadTrackChar?: string
}) {
  return (
    <box style={{ flexDirection: "column" }}>
      <StatsRow arrow="▼" rate={rxRate} color={theme.download} history={rxHistory} total={rxTotal} />
      <BrailleChart data={rxHistory} width={CHART_W} height={4} colors={theme.downloadGradient} />
      {Separator ? <Separator /> : null}
      <BrailleChart
        data={txHistory}
        width={CHART_W}
        height={3}
        colors={theme.uploadGradient}
        mirror
        topTrackChar={uploadTrackChar}
      />
      <StatsRow arrow="▲" rate={txRate} color={theme.upload} history={txHistory} total={txTotal} />
    </box>
  )
}

// ── separator variants ────────────────────────────────────────────────────
const VARIANTS: { title: string; render: () => React.ReactNode }[] = [
  {
    title: "1 · SOLID LINE ─ (original)",
    render: () => (
      <HeroVariant
        Separator={() => (
          <text fg={theme.border} wrapMode="none">
            {"─".repeat(CHART_W)}
          </text>
        )}
      />
    ),
  },
  {
    title: "2 · NO SEPARATOR (charts touch)",
    render: () => <HeroVariant />,
  },
  {
    title: "3 · DOTTED ROW ·",
    render: () => (
      <HeroVariant
        Separator={() => (
          <text fg={theme.border} wrapMode="none">
            {"·".repeat(CHART_W)}
          </text>
        )}
      />
    ),
  },
  {
    title: "4 · BRAILLE BLOCK ⣿",
    render: () => (
      <HeroVariant
        Separator={() => (
          <text fg={theme.border} wrapMode="none">
            {"⣿".repeat(CHART_W)}
          </text>
        )}
      />
    ),
  },
  {
    title: "5 · TOP-DOTS ⠉ (static, full width)",
    render: () => (
      <HeroVariant
        Separator={() => (
          <text fg={theme.border} wrapMode="none">
            {"⠉".repeat(CHART_W)}
          </text>
        )}
      />
    ),
  },
  {
    title: "6 · DISAPPEARING ⠉ (upload top track) ★",
    render: () => <HeroVariant uploadTrackChar="⠉" />,
  },
  {
    title: "7 · BIG NUMBERS as separator",
    render: () => (
      <HeroVariant
        Separator={() => (
          <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <text wrapMode="none">
              <span fg={theme.border}>{"─".repeat(4)}</span>
              <span fg={theme.download}>
                <b> ▼ {formatRate(rxRate)} </b>
              </span>
              <span fg={theme.border}>{"─".repeat(4)}</span>
            </text>
            <text wrapMode="none">
              <span fg={theme.border}>{"─".repeat(4)}</span>
              <span fg={theme.upload}>
                <b> ▲ {formatRate(txRate)} </b>
              </span>
              <span fg={theme.border}>{"─".repeat(4)}</span>
            </text>
          </box>
        )}
      />
    ),
  },
  {
    title: "8 · INLINE RATES (centered, fills line)",
    render: () => (
      <HeroVariant
        Separator={() => {
          const dl = ` ▼ ${formatRate(rxRate)} `
          const ul = ` ▲ ${formatRate(txRate)} `
          const inner = CHART_W
          const used = dl.length + ul.length
          const gap = Math.max(0, inner - used)
          const leftPad = Math.floor(gap / 2)
          const rightPad = gap - leftPad
          return (
            <text wrapMode="none">
              <span fg={theme.border}>{"·".repeat(leftPad)}</span>
              <span fg={theme.download}>{dl}</span>
              <span fg={theme.border}>{"·".repeat(rightPad)}</span>
              <span fg={theme.upload}>{ul}</span>
            </text>
          )
        }}
      />
    ),
  },
]

function Demo() {
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: theme.bg, padding: 1 }}>
      <text fg={theme.accent}>
        {" "}
        HERO throughput chart — separator variants · same dummy data (upload ramps L→R) · press q / ctrl-c to quit
      </text>
      <box style={{ flexDirection: "row", flexWrap: "wrap", flexGrow: 1 }}>
        {VARIANTS.map((v) => (
          <box
            key={v.title}
            title={` ${v.title} `}
            style={{
              border: true,
              borderStyle: "rounded",
              borderColor: theme.border,
              flexDirection: "column",
              paddingLeft: 1,
              paddingRight: 1,
              width: CHART_W + 4,
              marginRight: 1,
              marginBottom: 1,
            }}
          >
            {v.render()}
          </box>
        ))}
      </box>
    </box>
  )
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30 })
createRoot(renderer).render(<Demo />)
