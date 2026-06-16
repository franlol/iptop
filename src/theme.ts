// Tokyo Night palette
export const theme = {
  bg: "#1a1b26",
  panel: "#16161e",
  text: "#c0caf5",
  dim: "#565f89",
  border: "#3b4261",
  accent: "#7aa2f7",
  cyan: "#7dcfff",
  magenta: "#bb9af7",
  // magenta blended ~50% over the chart surface — matches how the dithered
  // (▒) half of the process bars reads next to the solid (█) half
  magentaDim: "#6d5f96",
  green: "#9ece6a",
  red: "#f7768e",
  orange: "#ff9e64",
  yellow: "#e0af68",
  download: "#9ece6a",
  upload: "#f7768e",
  // surfaces behind charts and gauge tracks
  chartBg: "#1f2335",
  track: "#292e42",
  // neutral grey for the "::" texture in chart empty areas
  chartTrack: "#41434f",
  // chart gradients, index 0 = row nearest the peaks
  downloadGradient: ["#9ece6a", "#73daca", "#41a6b5", "#33635c"],
  uploadGradient: ["#f7768e", "#c75070", "#8c3a52", "#552737"],
} as const
