import { testRender } from "@opentui/react/test-utils"
import { expect, test } from "bun:test"
import type { ProcessConnection } from "../../collectors/traffic"
import { InspectorPanel } from "./InspectorPanel"

const conns: ProcessConnection[] = Array.from({ length: 3 }, (_, i) => ({
  local: `10.0.0.1:${5000 + i}`,
  remote: `93.184.216.${i}:443`,
  remoteDisplay: `93.184.216.${i}:443`,
  country: "US",
  rxRate: 1000 * (i + 1),
  txRate: 100 * (i + 1),
}))

test("chart rows and connections table do not overlap", async () => {
  const history = {
    rx: Array.from({ length: 120 }, (_, i) => 1000 + 500 * Math.sin(i / 5)),
    tx: Array.from({ length: 120 }, (_, i) => 200 + 100 * Math.cos(i / 7)),
  }
  const { renderer, renderOnce, captureCharFrame } = await testRender(
    <InspectorPanel
      process={{ name: "chrome", pid: 1234, rxRate: 1000, txRate: 200, rxTotal: 1_000_000, txTotal: 200_000 }}
      history={history}
      connections={conns}
      remotes={[]}
      width={54}
    />,
    { width: 60, height: 24 },
  )
  await renderOnce()
  const frame = captureCharFrame()
  const lines = frame.split("\n")
  const headerRow = lines.findIndex((l) => l.includes("CONNECTIONS"))
  // header must not contain lit braille (would mean the chart painted under it)
  const headerLine = lines[headerRow] ?? ""
  const lit = [...headerLine].filter((ch) => ch >= "⠁" && ch <= "⣿")
  expect(lit).toEqual([])
  // rates row 1, chart rows 2..4 (CHART_H=3, hero height), header row 5
  expect(headerRow).toBe(5)
  renderer.destroy()
})
