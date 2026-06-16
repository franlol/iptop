import { describe, expect, mock, test } from "bun:test"

let netstatOutput = ""
mock.module("../../lib/exec", () => ({ run: async () => netstatOutput, readText: async () => "" }))

const { sampleThroughput } = await import("./throughput.darwin")

const HEADER = "Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll"

function fixture(en0Rx: number, en0Tx: number, lo0: number): string {
  return [
    HEADER,
    // lo0 has no Address column (10 fields instead of 11)
    `lo0        16384 <Link#1>                        100     0  ${lo0}   100     0  ${lo0}     0`,
    `lo0        16384 127           127.0.0.1         100     -  ${lo0}   100     -  ${lo0}     -`,
    `en0        1500  <Link#4>    aa:bb:cc:dd:ee:ff   200     0  ${en0Rx}   150     0  ${en0Tx}     0`,
  ].join("\n")
}

describe("sampleThroughput (darwin)", () => {
  test("parses totals (loopback excluded) and computes rates between samples", async () => {
    netstatOutput = fixture(5000, 3000, 1000)
    const first = await sampleThroughput()
    expect(first.rxTotal).toBe(5000)
    expect(first.txTotal).toBe(3000)
    expect(first.rxRate).toBe(0) // no previous sample yet

    await Bun.sleep(30)
    netstatOutput = fixture(15000, 8000, 99000)
    const second = await sampleThroughput()
    expect(second.rxTotal).toBe(15000)
    expect(second.rxRate).toBeGreaterThan(0)
    expect(second.txRate).toBeGreaterThan(0)
    // loopback traffic must not pollute the headline rates
    const en0 = second.interfaces.find((i) => i.name === "en0")
    expect(en0).toBeDefined()
    expect(second.rxRate).toBeCloseTo(en0!.rxRate, 5)
  })
})
