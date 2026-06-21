// Color palettes. `theme` is a single mutable object that every module imports
// by reference — switching themes mutates it in place (see `applyTheme`) and the
// App bumps a render counter so the whole tree re-reads the new colors.

export interface Palette {
  bg: string
  panel: string
  text: string
  dim: string
  border: string
  accent: string
  cyan: string
  magenta: string
  // magenta blended ~50% over the chart surface — matches how the dithered
  // (▒) half of the process bars reads next to the solid (█) half
  magentaDim: string
  green: string
  red: string
  orange: string
  yellow: string
  download: string
  upload: string
  // surfaces behind charts and gauge tracks
  chartBg: string
  track: string
  // neutral grey for the "::" texture in chart empty areas
  chartTrack: string
  // chart gradients, index 0 = row nearest the peaks
  downloadGradient: string[]
  uploadGradient: string[]
  // high-contrast color the live-cursor chart heads brighten toward — white on
  // dark themes, a dark color on light themes so the leading edge stays visible
  headAnchor: string
}

// linear blend between two #rrggbb colors (duplicated from lib/tint to avoid a
// circular import — tint imports theme)
function mix(from: string, to: string, t: number): string {
  const channel = (offset: number) => {
    const a = parseInt(from.slice(offset, offset + 2), 16)
    const b = parseInt(to.slice(offset, offset + 2), 16)
    return Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

// 4-stop gradient fading a base hue toward a dark anchor (index 0 = brightest,
// nearest the chart peaks)
const grad = (base: string, dark: string): string[] => [
  base,
  mix(base, dark, 0.3),
  mix(base, dark, 0.55),
  mix(base, dark, 0.78),
]

interface ThemeDef {
  name: string
  colors: {
    bg: string
    panel: string
    text: string
    dim: string
    border: string
    accent: string
    cyan: string
    magenta: string
    green: string
    red: string
    orange: string
    yellow: string
    chartBg: string
    track: string
    chartTrack: string
  }
  // optional overrides for derived/special colors
  download?: string
  upload?: string
  downloadGradient?: string[]
  uploadGradient?: string[]
  // override for light themes (defaults to white)
  headAnchor?: string
}

function buildPalette(def: ThemeDef): Palette {
  const c = def.colors
  const download = def.download ?? c.green
  const upload = def.upload ?? c.red
  return {
    ...c,
    download,
    upload,
    magentaDim: mix(c.magenta, c.chartBg, 0.5),
    downloadGradient: def.downloadGradient ?? grad(download, c.bg),
    uploadGradient: def.uploadGradient ?? grad(upload, c.bg),
    headAnchor: def.headAnchor ?? "#ffffff",
  }
}

const DEFS: ThemeDef[] = [
  {
    name: "Tokyo Night",
    colors: {
      bg: "#1a1b26",
      panel: "#16161e",
      text: "#c0caf5",
      dim: "#565f89",
      border: "#3b4261",
      accent: "#7aa2f7",
      cyan: "#7dcfff",
      magenta: "#bb9af7",
      green: "#9ece6a",
      red: "#f7768e",
      orange: "#ff9e64",
      yellow: "#e0af68",
      chartBg: "#1f2335",
      track: "#292e42",
      chartTrack: "#41434f",
    },
    // hand-tuned gradients shift hue (green→teal→blue, red→maroon)
    downloadGradient: ["#9ece6a", "#73daca", "#41a6b5", "#33635c"],
    uploadGradient: ["#f7768e", "#c75070", "#8c3a52", "#552737"],
  },
  {
    name: "Catppuccin Mocha",
    colors: {
      bg: "#1e1e2e",
      panel: "#181825",
      text: "#cdd6f4",
      dim: "#6c7086",
      border: "#45475a",
      accent: "#89b4fa",
      cyan: "#94e2d5",
      magenta: "#cba6f7",
      green: "#a6e3a1",
      red: "#f38ba8",
      orange: "#fab387",
      yellow: "#f9e2af",
      chartBg: "#232336",
      track: "#313244",
      chartTrack: "#45475a",
    },
  },
  {
    name: "Gruvbox Dark",
    colors: {
      bg: "#1d2021",
      panel: "#282828",
      text: "#ebdbb2",
      dim: "#928374",
      border: "#504945",
      accent: "#83a598",
      cyan: "#8ec07c",
      magenta: "#d3869b",
      green: "#b8bb26",
      red: "#fb4934",
      orange: "#fe8019",
      yellow: "#fabd2f",
      chartBg: "#282828",
      track: "#3c3836",
      chartTrack: "#504945",
    },
  },
  {
    name: "Nord",
    colors: {
      bg: "#2e3440",
      panel: "#272c36",
      text: "#eceff4",
      dim: "#616e88",
      border: "#434c5e",
      accent: "#88c0d0",
      cyan: "#8fbcbb",
      magenta: "#b48ead",
      green: "#a3be8c",
      red: "#bf616a",
      orange: "#d08770",
      yellow: "#ebcb8b",
      chartBg: "#2b303b",
      track: "#3b4252",
      chartTrack: "#4c566a",
    },
  },
  {
    name: "Dracula",
    colors: {
      bg: "#282a36",
      panel: "#21222c",
      text: "#f8f8f2",
      dim: "#6272a4",
      border: "#44475a",
      accent: "#bd93f9",
      cyan: "#8be9fd",
      magenta: "#ff79c6",
      green: "#50fa7b",
      red: "#ff5555",
      orange: "#ffb86c",
      yellow: "#f1fa8c",
      chartBg: "#242631",
      track: "#343746",
      chartTrack: "#44475a",
    },
  },
  {
    name: "Rosé Pine",
    colors: {
      bg: "#191724",
      panel: "#1f1d2e",
      text: "#e0def4",
      dim: "#6e6a86",
      border: "#403d52",
      accent: "#c4a7e7",
      cyan: "#9ccfd8",
      magenta: "#c4a7e7",
      green: "#31748f",
      red: "#eb6f92",
      orange: "#ebbcba",
      yellow: "#f6c177",
      chartBg: "#21202e",
      track: "#2a283e",
      chartTrack: "#403d52",
    },
    download: "#9ccfd8",
    upload: "#eb6f92",
  },
  {
    name: "Solarized Dark",
    colors: {
      bg: "#002b36",
      panel: "#073642",
      text: "#839496",
      dim: "#586e75",
      border: "#0e4a59",
      accent: "#268bd2",
      cyan: "#2aa198",
      magenta: "#d33682",
      green: "#859900",
      red: "#dc322f",
      orange: "#cb4b16",
      yellow: "#b58900",
      chartBg: "#073642",
      track: "#0a3a47",
      chartTrack: "#586e75",
    },
  },
  {
    name: "One Dark",
    colors: {
      bg: "#282c34",
      panel: "#21252b",
      text: "#abb2bf",
      dim: "#5c6370",
      border: "#3e4451",
      accent: "#61afef",
      cyan: "#56b6c2",
      magenta: "#c678dd",
      green: "#98c379",
      red: "#e06c75",
      orange: "#d19a66",
      yellow: "#e5c07b",
      chartBg: "#2c313a",
      track: "#3a3f4b",
      chartTrack: "#4b5263",
    },
  },
  {
    name: "Everforest",
    colors: {
      bg: "#2d353b",
      panel: "#272e33",
      text: "#d3c6aa",
      dim: "#859289",
      border: "#3d484d",
      accent: "#7fbbb3",
      cyan: "#83c092",
      magenta: "#d699b6",
      green: "#a7c080",
      red: "#e67e80",
      orange: "#e69875",
      yellow: "#dbbc7f",
      chartBg: "#323d43",
      track: "#3d484d",
      chartTrack: "#56635f",
    },
  },
  {
    name: "Kanagawa",
    colors: {
      bg: "#1f1f28",
      panel: "#16161d",
      text: "#dcd7ba",
      dim: "#727169",
      border: "#363646",
      accent: "#7e9cd8",
      cyan: "#7aa89f",
      magenta: "#957fb8",
      green: "#98bb6c",
      red: "#e46876",
      orange: "#ffa066",
      yellow: "#e6c384",
      chartBg: "#2a2a37",
      track: "#363646",
      chartTrack: "#54546d",
    },
  },
  {
    name: "Monokai",
    colors: {
      bg: "#272822",
      panel: "#1e1f1c",
      text: "#f8f8f2",
      dim: "#75715e",
      border: "#49483e",
      accent: "#66d9ef",
      cyan: "#66d9ef",
      magenta: "#ae81ff",
      green: "#a6e22e",
      red: "#f92672",
      orange: "#fd971f",
      yellow: "#e6db74",
      chartBg: "#2d2e28",
      track: "#3a3b34",
      chartTrack: "#49483e",
    },
  },
  {
    name: "Ayu Dark",
    colors: {
      bg: "#0b0e14",
      panel: "#0d1017",
      text: "#bfbdb6",
      dim: "#565b66",
      border: "#1c212b",
      accent: "#59c2ff",
      cyan: "#95e6cb",
      magenta: "#d2a6ff",
      green: "#aad94c",
      red: "#f07178",
      orange: "#ff8f40",
      yellow: "#ffb454",
      chartBg: "#0d1017",
      track: "#131721",
      chartTrack: "#565b66",
    },
  },
  {
    name: "Catppuccin Latte",
    colors: {
      bg: "#eff1f5",
      panel: "#e6e9ef",
      text: "#4c4f69",
      dim: "#8c8fa1",
      border: "#bcc0cc",
      accent: "#1e66f5",
      cyan: "#179299",
      magenta: "#8839ef",
      green: "#40a02b",
      red: "#d20f39",
      orange: "#fe640b",
      yellow: "#df8e1d",
      chartBg: "#e6e9ef",
      track: "#ccd0da",
      chartTrack: "#acb0be",
    },
    headAnchor: "#1e1e2e",
  },
  {
    name: "Rosé Pine Dawn",
    colors: {
      bg: "#faf4ed",
      panel: "#fffaf3",
      text: "#575279",
      dim: "#9893a5",
      border: "#cecacd",
      accent: "#907aa9",
      cyan: "#56949f",
      magenta: "#907aa9",
      green: "#286983",
      red: "#b4637a",
      orange: "#d7827e",
      yellow: "#ea9d34",
      chartBg: "#fffaf3",
      track: "#dfdad9",
      chartTrack: "#cecacd",
    },
    download: "#56949f",
    upload: "#b4637a",
    headAnchor: "#26233a",
  },
]

export const themes = DEFS.map((def) => ({ name: def.name, palette: buildPalette(def) }))
export const themeNames = themes.map((t) => t.name)

// the live, mutable palette — exported by reference and mutated by applyTheme
export const theme: Palette = { ...themes[0]!.palette }

let currentThemeIndex = 0

export function getThemeIndex(): number {
  return currentThemeIndex
}

export function applyTheme(index: number): void {
  const next = themes[index]
  if (!next) return
  currentThemeIndex = index
  Object.assign(theme, next.palette)
}
