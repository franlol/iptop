import { describe, expect, test } from "bun:test"
import { brailleArea } from "./braille"

const rowText = (segments: { text: string }[]) => segments.map((s) => s.text).join("")

describe("brailleArea", () => {
  test("dimensions match width and height", () => {
    const rows = brailleArea([1, 2, 3], 20, 4)
    expect(rows.length).toBe(4)
    for (const row of rows) expect(rowText(row).length).toBe(20)
  })

  test("empty data renders blank track cells", () => {
    const rows = brailleArea([], 10, 2)
    for (const row of rows) {
      expect(row.length).toBe(1)
      expect(row[0]?.track).toBe(true)
      expect(rowText(row)).toBe("⠀".repeat(10))
    }
  })

  test("max value fills the full column height", () => {
    const rows = brailleArea([100], 5, 3)
    // newest data is right-aligned: last cell of every row holds the column
    for (const row of rows) {
      const text = rowText(row)
      expect(text[text.length - 1]).toBe("⢸") // right dot column fully lit
    }
  })

  test("mirror hangs from the top", () => {
    const rows = brailleArea([100, 100], 1, 2, true)
    expect(rowText(rows[0]!)).toBe("⣿")
    expect(rowText(rows[1]!)).toBe("⣿")
    // a small value next to the max fills only the topmost dots of its column
    const partial = brailleArea([100, 25], 1, 2, true)
    expect(rowText(partial[1]!)).toBe("⡇") // bottom row: left column full, right column empty
  })

  test("fixedMax gives an absolute scale", () => {
    // 25 of 100 lights 1 of 4 dots even though it is the window max
    const rows = brailleArea([25, 25], 1, 1, false, 100)
    expect(rowText(rows[0]!)).toBe("⣀")
    // values above the scale are clamped, not overflowing
    const clamped = brailleArea([500, 500], 1, 1, false, 100)
    expect(rowText(clamped[0]!)).toBe("⣿")
  })

  test("zero values become track segments", () => {
    const rows = brailleArea([0, 0, 100, 100], 2, 1)
    const last = rows[0]!
    expect(last[0]?.track).toBe(true)
    expect(last[last.length - 1]?.track).toBe(false)
  })
})
