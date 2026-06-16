import { describe, expect, mock, test } from "bun:test"

let procNetDev = ""
mock.module("../../lib/exec", () => ({ run: async () => "", readText: async () => procNetDev }))

const { sampleThroughput } = await import("./throughput.linux")

function fixture(ethRx: number, ethTx: number, lo: number): string {
  return [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    `    lo:  ${lo}    2208    0    0    0     0          0         0   ${lo}    2208    0    0    0     0       0          0`,
    // the colon can abut the first counter on busy interfaces
    `enp39s0:${ethRx}  701377    0    2    0     0          0       371 ${ethTx}  105134    0    0    0     0       0          0`,
  ].join("\n")
}

describe("sampleThroughput (linux)", () => {
  test("parses totals (loopback excluded) and computes rates between samples", async () => {
    procNetDev = fixture(5000, 3000, 1000)
    const first = await sampleThroughput()
    expect(first.rxTotal).toBe(5000)
    expect(first.txTotal).toBe(3000)

    await Bun.sleep(30)
    procNetDev = fixture(15000, 8000, 99000)
    const second = await sampleThroughput()
    expect(second.rxTotal).toBe(15000)
    expect(second.txTotal).toBe(8000)
    expect(second.rxRate).toBeGreaterThan(0)
    expect(second.txRate).toBeGreaterThan(0)
    // loopback traffic must not pollute the headline rates
    const eth = second.interfaces.find((i) => i.name === "enp39s0")
    expect(eth).toBeDefined()
    expect(second.rxRate).toBeCloseTo(eth!.rxRate, 5)
  })
})
