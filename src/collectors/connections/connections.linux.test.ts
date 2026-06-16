import { describe, expect, mock, test } from "bun:test"

// mock.module is process-global across test files: spread the real module so
// only the network-touching functions are replaced
import * as realDns from "../../lib/dns"

let ssOutput = ""
mock.module("../../lib/exec", () => ({ run: async () => ssOutput, readText: async () => "" }))
mock.module("../../lib/dns", () => ({ ...realDns, displayAddr: (addr: string) => addr }))

const { sampleConnections } = await import("./connections.linux")

const FIXTURE = [
  "Netid State  Recv-Q Send-Q        Local Address:Port     Peer Address:Port Process",
  `udp   UNCONN 0      0                   0.0.0.0:5353          0.0.0.0:*`,
  `tcp   LISTEN 0      128               127.0.0.1:45569         0.0.0.0:*     users:(("steam",pid=41686,fd=66))`,
  `tcp   ESTAB  0      0      192.168.1.42%enp39s0:37160    2.19.221.101:443   users:(("steamwebhelper",pid=41949,fd=48))`,
].join("\n")

describe("sampleConnections (linux)", () => {
  test("parses ss -tunap rows", async () => {
    ssOutput = FIXTURE
    const conns = await sampleConnections()
    expect(conns.length).toBe(3)

    const established = conns.find((c) => c.state === "ESTABLISHED")!
    expect(established.command).toBe("steamwebhelper")
    expect(established.pid).toBe(41949)
    expect(established.protocol).toBe("TCP")
    // %iface zone suffix is stripped
    expect(established.local).toBe("192.168.1.42:37160")
    expect(established.remote).toBe("2.19.221.101:443")

    // wildcard peers mean no remote endpoint
    const listening = conns.find((c) => c.state === "LISTEN")!
    expect(listening.command).toBe("steam")
    expect(listening.remote).toBe("")

    // UNCONN UDP maps to the empty state, like lsof's UDP rows
    const udp = conns.find((c) => c.protocol === "UDP")!
    expect(udp.state).toBe("")
    expect(udp.pid).toBe(0)

    // sort order: established first, listening last
    expect(conns[0]!.state).toBe("ESTABLISHED")
    expect(conns[conns.length - 1]!.state).toBe("LISTEN")
  })

  test("deduplicates identical sockets", async () => {
    ssOutput = `${FIXTURE}\ntcp   LISTEN 0      128               127.0.0.1:45569         0.0.0.0:*     users:(("steam",pid=41686,fd=67))`
    const conns = await sampleConnections()
    expect(conns.filter((c) => c.local === "127.0.0.1:45569").length).toBe(1)
  })
})
