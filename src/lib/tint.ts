// Per-country colors shared by the world map and the remote hosts panel.
// Identity is encoded as hue (distinct palette color per country, assigned on
// first appearance and stable for the session); traffic volume modulates how
// vivid the hue is (log-scaled, quantized so map cells merge cleanly).

import { theme } from "../theme"

// hues pulled straight from the theme; marker pink (theme.red/upload) is
// excluded because located-host markers brighten toward it and would clash
const PALETTE = [theme.cyan, theme.green, theme.orange, theme.magenta, theme.yellow, theme.accent]
// muted base the hue fades toward at low volume
const BASE = "#414868"
export const TINT_LEVELS = 6
const MIN_VIVIDNESS = 0.75

export interface CountryTint {
  level: number
  color: string
  // brightened hue for map markers, so they pop against the tinted landmass
  marker: string
}

export function lerpColor(from: string, to: string, t: number): string {
  const channel = (offset: number) => {
    const a = parseInt(from.slice(offset, offset + 2), 16)
    const b = parseInt(to.slice(offset, offset + 2), 16)
    return Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

// shuffle the palette once per session so colors are randomized across runs,
// then hand them out in that order — each new country gets a fresh hue until
// the palette is exhausted, so no two are clustered onto the same color
const shuffled = [...PALETTE].sort(() => Math.random() - 0.5)

const assignedHue = new Map<string, string>()

function hueOf(country: string): string {
  let color = assignedHue.get(country)
  if (color === undefined) {
    color = shuffled[assignedHue.size % shuffled.length] ?? PALETTE[0]!
    assignedHue.set(country, color)
  }
  return color
}

// stable hue at minimum vividness, for countries that aren't in the current
// remotes window (e.g. low-traffic connections shown in the inspector)
export function fallbackTint(country: string): string {
  return lerpColor(BASE, hueOf(country), MIN_VIVIDNESS)
}

interface CountryTraffic {
  country: string
  rxRate: number
  txRate: number
}

export function countryTints(remotes: CountryTraffic[]): Map<string, CountryTint> {
  const countryRate = new Map<string, number>()
  for (const r of remotes) {
    if (r.country) countryRate.set(r.country, (countryRate.get(r.country) ?? 0) + r.rxRate + r.txRate)
  }
  const maxRate = Math.max(...countryRate.values(), 1)
  const tints = new Map<string, CountryTint>()
  for (const [country, rate] of countryRate) {
    const t = Math.log1p(rate) / Math.log1p(maxRate)
    const level = Math.round(t * (TINT_LEVELS - 1))
    const vividness = MIN_VIVIDNESS + (1 - MIN_VIVIDNESS) * (level / (TINT_LEVELS - 1))
    const hue = hueOf(country)
    tints.set(country, {
      level,
      color: lerpColor(BASE, hue, vividness),
      marker: lerpColor(hue, "#ffffff", 0.6),
    })
  }
  return tints
}
