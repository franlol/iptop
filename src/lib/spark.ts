const BLOCKS = "▁▂▃▄▅▆▇█"

export function sparkline(data: number[], width: number): string {
  const points = data.slice(-width)
  const max = Math.max(...points, 1)
  const chars = points
    .map((v) => {
      if (v <= 0) return BLOCKS[0]
      const index = Math.max(1, Math.min(7, Math.round((v / max) * 7)))
      return BLOCKS[index]
    })
    .join("")
  return chars.padStart(width)
}
