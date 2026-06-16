import { describe, expect, test } from "bun:test"
import {
  formatBytes,
  formatCompact,
  formatRate,
  gaugeParts,
  mirrorGaugeParts,
  padEndTrunc,
  padStartTrunc,
} from "./format"

describe("formatBytes", () => {
  test("scales units", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1024)).toBe("1.00 KB")
    expect(formatBytes(1536)).toBe("1.50 KB")
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.0 MB")
    expect(formatBytes(5.5 * 1024 ** 3)).toBe("5.50 GB")
  })
})

describe("formatRate", () => {
  test("appends /s", () => {
    expect(formatRate(2048)).toBe("2.00 KB/s")
  })
})

describe("formatCompact", () => {
  test("compact units", () => {
    expect(formatCompact(0)).toBe("0")
    expect(formatCompact(999)).toBe("999B")
    expect(formatCompact(2048)).toBe("2.0K")
    expect(formatCompact(150 * 1024)).toBe("150K")
    expect(formatCompact(3 * 1024 * 1024)).toBe("3.0M")
  })
})

describe("gaugeParts", () => {
  test("fill + track always sum to width", () => {
    for (const value of [0, 1, 31, 50, 99, 100, 250]) {
      const { fill, track } = gaugeParts(value, 100, 14)
      expect(fill.length + track.length).toBe(14)
    }
  })

  test("full and empty extremes", () => {
    expect(gaugeParts(100, 100, 10).fill).toBe("█".repeat(10))
    expect(gaugeParts(0, 100, 10).fill).toBe("")
    expect(gaugeParts(0, 100, 10).track).toBe("╌".repeat(10))
  })

  test("tiny values are still visible", () => {
    expect(gaugeParts(0.1, 1000, 10).fill.length).toBeGreaterThan(0)
  })
})

describe("mirrorGaugeParts", () => {
  const sideLen = (g: ReturnType<typeof mirrorGaugeParts>) => ({
    left: g.leftTrack.length + g.leftPartial.length + g.leftFill.length,
    right: g.rightFill.length + g.rightPartial.length + g.rightTrack.length,
  })

  test("each half always fills its side exactly", () => {
    const cases: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [30, 25],
      [99, 1],
      [100, 100],
      [200, 100],
      [0.05, 0.05],
    ]
    for (const [rx, tx] of cases) {
      const { left, right } = sideLen(mirrorGaugeParts(rx, tx, 100, 15))
      expect(left).toBe(7)
      expect(right).toBe(7)
    }
  })

  test("halves mirror exactly at the half mark", () => {
    // side = 7 cells, 50% = 28 eighths = 3 full + ▌
    const g = mirrorGaugeParts(50, 50, 100, 15)
    expect(g.leftFill).toBe("███")
    expect(g.leftPartial).toBe("▌") // 4/8 inverted: ink covers the left half, bg shows right
    expect(g.leftTrack).toBe("░░░")
    expect(g.rightFill).toBe("███")
    expect(g.rightPartial).toBe("▌")
    expect(g.rightTrack).toBe("░░░")
  })

  test("one-directional traffic leaves the other side as track", () => {
    const rxOnly = mirrorGaugeParts(100, 0, 100, 15)
    expect(rxOnly.leftFill).toBe("█".repeat(7))
    expect(rxOnly.leftTrack).toBe("")
    expect(rxOnly.rightFill).toBe("")
    expect(rxOnly.rightTrack).toBe("░".repeat(7))
  })

  test("tiny values stay visible on their side", () => {
    const g = mirrorGaugeParts(0.1, 0.1, 1000, 15)
    expect(g.leftPartial.length + g.leftFill.length).toBeGreaterThan(0)
    expect(g.rightPartial.length + g.rightFill.length).toBeGreaterThan(0)
  })

  test("idle gauge is all track", () => {
    const g = mirrorGaugeParts(0, 0, 100, 11)
    expect(g.leftTrack).toBe("░".repeat(5))
    expect(g.rightTrack).toBe("░".repeat(5))
    expect(g.leftFill + g.leftPartial + g.rightFill + g.rightPartial).toBe("")
  })
})

describe("padding", () => {
  test("padEndTrunc truncates with ellipsis", () => {
    expect(padEndTrunc("abcdef", 4)).toBe("abc…")
    expect(padEndTrunc("ab", 4)).toBe("ab  ")
  })
  test("padStartTrunc pads left", () => {
    expect(padStartTrunc("42", 5)).toBe("   42")
  })
})
