import { describe, expect, mock, test } from "bun:test"

// mock.module is process-global across test files: spread the real module so
// only the network-touching functions are replaced
import * as realDns from "../../lib/dns"

let nettopOutput = ""
mock.module("../../lib/exec", () => ({ run: async () => nettopOutput, readText: async () => "" }))
mock.module("../../lib/geo", () => ({ lookupGeo: () => undefined }))
mock.module("../../lib/dns", () => ({
  ...realDns,
  lookupHostname: () => undefined,
  displayAddr: (addr: string) => addr,
}))

const { sampleTraffic } = await import("./traffic.darwin")

// the leading time column is present when stdout is not a TTY
function fixture(curlBytes: number): string {
  return [
    "time,,bytes_in,bytes_out,",
    `10:00:00.000,kernel_task.0,100,200,`,
    `10:00:00.000,curl.123,${curlBytes},${Math.floor(curlBytes / 2)},`,
    `10:00:00.000,tcp4 192.168.1.2:50000<->93.184.216.34:443,${curlBytes},${Math.floor(curlBytes / 2)},`,
    `10:00:00.000,udp4 *:*<->*:*,,,`,
  ].join("\n")
}

describe("sampleTraffic (darwin)", () => {
  test("parses processes, per-connection rates, and remote aggregation", async () => {
    nettopOutput = fixture(1000)
    const first = await sampleTraffic()
    expect(first.processes.map((p) => p.name)).toContain("curl")
    const curl = first.processes.find((p) => p.name === "curl")!
    expect(curl.pid).toBe(123)
    expect(curl.rxTotal).toBe(1000)

    await Bun.sleep(30)
    nettopOutput = fixture(5000)
    const second = await sampleTraffic()

    const curl2 = second.processes.find((p) => p.name === "curl")!
    expect(curl2.rxRate).toBeGreaterThan(0)

    // per-connection rate keyed by local|remote for the connections join
    const connRate = second.connectionRates.get("192.168.1.2:50000|93.184.216.34:443")
    expect(connRate).toBeDefined()
    expect(connRate!.rxRate).toBeGreaterThan(0)

    // connection is attributed to curl (the preceding process row)
    const conns = second.processConnections.get(123)
    expect(conns).toBeDefined()
    expect(conns![0]!.remote).toBe("93.184.216.34:443")

    // aggregated remote host
    expect(second.remotes.map((r) => r.ip)).toContain("93.184.216.34")
    const rate = second.remotes.find((r) => r.ip === "93.184.216.34")!.rxRate

    // history accumulates per pid
    expect(second.histories.get(123)!.rx.length).toBeGreaterThan(0)

    // a remote that goes quiet decays instead of vanishing
    await Bun.sleep(30)
    nettopOutput = ["time,,bytes_in,bytes_out,", "10:00:00.000,kernel_task.0,100,200,"].join("\n")
    const third = await sampleTraffic()
    const decayed = third.remotes.find((r) => r.ip === "93.184.216.34")
    expect(decayed).toBeDefined()
    expect(decayed!.rxRate).toBeLessThan(rate)
    expect(decayed!.rxRate).toBeGreaterThan(0)
  })

  test("returns empty sample on unexpected header", async () => {
    nettopOutput = "garbage\nmore garbage"
    const sample = await sampleTraffic()
    expect(sample.processes).toEqual([])
  })

  test("a process that disappears decays instead of vanishing", async () => {
    // valid output, but curl is gone; only the idle kernel_task remains
    nettopOutput = ["time,,bytes_in,bytes_out,", "10:00:00.000,kernel_task.0,100,200,"].join("\n")
    const first = await sampleTraffic()
    // curl had live rate, so it lingers with a decaying rate
    const curl = first.processes.find((p) => p.name === "curl")
    expect(curl).toBeDefined()
    expect(curl!.rxRate).toBeGreaterThan(0)

    let sample = first
    for (let i = 0; i < 60 && sample.processes.some((p) => p.name === "curl"); i++) {
      sample = await sampleTraffic()
    }
    expect(sample.processes.map((p) => p.name)).not.toContain("curl")
  })
})
