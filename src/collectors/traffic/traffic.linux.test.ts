import { describe, expect, mock, test } from "bun:test"

// mock.module is process-global across test files: spread the real module so
// only the network-touching functions are replaced
import * as realDns from "../../lib/dns"

let ssOutput = ""
mock.module("../../lib/exec", () => ({ run: async () => ssOutput, readText: async () => "" }))
mock.module("../../lib/geo", () => ({ lookupGeo: () => undefined }))
mock.module("../../lib/dns", () => ({
  ...realDns,
  lookupHostname: () => undefined,
  displayAddr: (addr: string) => addr,
}))

const { sampleTraffic } = await import("./traffic.linux")

// distinct pids/IPs from the darwin fixture: the shared engine keeps state
// across test files within the process
function fixture(zenBytes: number): string {
  return [
    "State Recv-Q Send-Q Local Address:Port     Peer Address:Port Process",
    `ESTAB 0      0       192.168.1.42%enp39s0:50001    151.101.1.69:443   users:(("zen",pid=777,fd=48))`,
    `\t cubic wscale:7,10 rto:212 rtt:11.1/1.0 mss:1440 bytes_sent:${Math.floor(zenBytes / 2)} bytes_acked:5484 bytes_received:${zenBytes} segs_out:22 segs_in:22`,
    // a socket without process attribution (another user's)
    `ESTAB 0      0       192.168.1.42:60000    10.0.0.9:8009`,
    `\t cubic bytes_sent:10 bytes_received:20`,
    `LISTEN 0     128     127.0.0.1:45569       0.0.0.0:*     users:(("steam",pid=888,fd=66))`,
  ].join("\n")
}

describe("sampleTraffic (linux)", () => {
  test("parses ss -tinp sockets into processes, connection rates, and remotes", async () => {
    ssOutput = fixture(1000)
    const first = await sampleTraffic()
    const zen = first.processes.find((p) => p.name === "zen")!
    expect(zen).toBeDefined()
    expect(zen.pid).toBe(777)
    expect(zen.rxTotal).toBe(1000)
    expect(zen.txTotal).toBe(500)
    // listeners and unattributed sockets don't become processes
    expect(first.processes.map((p) => p.name)).not.toContain("steam")

    await Bun.sleep(30)
    ssOutput = fixture(5000)
    const second = await sampleTraffic()

    const zen2 = second.processes.find((p) => p.name === "zen")!
    expect(zen2.rxRate).toBeGreaterThan(0)

    // per-connection rate keyed by local|remote (zone suffix stripped)
    const connRate = second.connectionRates.get("192.168.1.42:50001|151.101.1.69:443")
    expect(connRate).toBeDefined()
    expect(connRate!.rxRate).toBeGreaterThan(0)

    // connection attributed to its owning pid
    const conns = second.processConnections.get(777)
    expect(conns).toBeDefined()
    expect(conns![0]!.remote).toBe("151.101.1.69:443")

    // aggregated remote host + per-pid history
    expect(second.remotes.map((r) => r.ip)).toContain("151.101.1.69")
    expect(second.histories.get(777)!.rx.length).toBeGreaterThan(0)
  })

  test("a closing socket doesn't knock the process rate to zero", async () => {
    const socket = (port: number, bytes: number) =>
      [
        `ESTAB 0 0       192.168.1.50:${port}    151.101.1.70:443   users:(("wget",pid=555,fd=3))`,
        `\t cubic bytes_sent:${Math.floor(bytes / 2)} bytes_received:${bytes}`,
      ].join("\n")
    const header = "State Recv-Q Send-Q Local Address:Port     Peer Address:Port Process"

    ssOutput = [header, socket(60001, 1_000)].join("\n")
    await sampleTraffic()
    await Bun.sleep(30)
    ssOutput = [header, socket(60001, 101_000)].join("\n")
    const second = await sampleTraffic()
    const rate = second.processes.find((p) => p.pid === 555)!.rxRate
    expect(rate).toBeGreaterThan(0)

    // the socket closes and a fresh one replaces it: the live-socket byte sum
    // drops (101000 → 500), which used to clamp to a fake 0 B/s sample; now
    // the EMA freezes until the new socket has a delta of its own
    await Bun.sleep(30)
    ssOutput = [header, socket(60002, 500)].join("\n")
    const third = await sampleTraffic()
    expect(third.processes.find((p) => p.pid === 555)!.rxRate).toBe(rate)
  })

  test("parses the single-line format where ss appends tcp-info to the socket line", async () => {
    // newer iproute2 prints the tcp-info (incl. byte counters) on the socket
    // line itself instead of a following indented line
    const header = "State Recv-Q Send-Q Local Address:Port     Peer Address:Port Process"
    const socket = (bytes: number) =>
      `ESTAB 0 0 192.168.1.60:55001 151.101.1.71:443 users:(("curl",pid=999,fd=4)) cubic rto:204 bytes_sent:${Math.floor(bytes / 2)} bytes_received:${bytes} segs_out:10`

    ssOutput = [header, socket(2_000)].join("\n")
    const first = await sampleTraffic()
    const curl = first.processes.find((p) => p.pid === 999)!
    expect(curl).toBeDefined()
    expect(curl.rxTotal).toBe(2_000)
    expect(curl.txTotal).toBe(1_000)

    await Bun.sleep(30)
    ssOutput = [header, socket(20_000)].join("\n")
    const second = await sampleTraffic()
    expect(second.processes.find((p) => p.pid === 999)!.rxRate).toBeGreaterThan(0)
    expect(second.remotes.map((r) => r.ip)).toContain("151.101.1.71")
  })

  test("Σ totals never go backwards when a socket closes", async () => {
    const header = "State Recv-Q Send-Q Local Address:Port     Peer Address:Port Process"
    const socket = (port: number, bytes: number) =>
      [
        `ESTAB 0 0       192.168.1.51:${port}    151.101.1.72:443   users:(("rsync",pid=444,fd=3))`,
        `\t cubic bytes_sent:${Math.floor(bytes / 2)} bytes_received:${bytes}`,
      ].join("\n")

    // first sighting seeds the total from the live-socket sum
    ssOutput = [header, socket(60101, 10_000)].join("\n")
    const first = await sampleTraffic()
    expect(first.processes.find((p) => p.pid === 444)!.rxTotal).toBe(10_000)

    // subsequent ticks accumulate the socket delta on top of the seed
    await Bun.sleep(30)
    ssOutput = [header, socket(60101, 50_000)].join("\n")
    const second = await sampleTraffic()
    const total = second.processes.find((p) => p.pid === 444)!.rxTotal
    expect(total).toBeCloseTo(50_000, 0)

    // the socket closes and a fresh one replaces it with tiny counters: the
    // live-socket sum collapses (50000 → 300) but the Σ total must not
    await Bun.sleep(30)
    ssOutput = [header, socket(60102, 300)].join("\n")
    const third = await sampleTraffic()
    expect(third.processes.find((p) => p.pid === 444)!.rxTotal).toBeGreaterThanOrEqual(total)
  })

  test("a process whose sockets vanish decays instead of disappearing", async () => {
    ssOutput = "garbage\nmore garbage"
    const first = await sampleTraffic()
    const zen = first.processes.find((p) => p.name === "zen")
    expect(zen).toBeDefined()
    expect(zen!.rxRate).toBeGreaterThan(0)

    // decays below 1 B/s within a bounded number of ticks, then is pruned
    let sample = first
    for (let i = 0; i < 60 && sample.processes.length > 0; i++) sample = await sampleTraffic()
    expect(sample.processes).toEqual([])
  })
})
