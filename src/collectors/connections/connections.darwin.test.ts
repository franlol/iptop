import { describe, expect, mock, test } from "bun:test"

// mock.module is process-global across test files: spread the real module so
// only the network-touching functions are replaced
import * as realDns from "../../lib/dns"

let lsofOutput = ""
mock.module("../../lib/exec", () => ({ run: async () => lsofOutput, readText: async () => "" }))
mock.module("../../lib/dns", () => ({ ...realDns, displayAddr: (addr: string) => addr }))

const { sampleConnections } = await import("./connections.darwin")

const FIXTURE = [
  "p123",
  "ccurl",
  "f5",
  "PTCP",
  "n192.168.1.2:50000->93.184.216.34:443",
  "TST=ESTABLISHED",
  "TQR=0",
  "f6",
  "PUDP",
  "n*:5353",
  "p456",
  "cnode server",
  "f7",
  "PTCP",
  "n*:3000",
  "TST=LISTEN",
].join("\n")

describe("sampleConnections (darwin)", () => {
  test("parses lsof -F field groups", async () => {
    lsofOutput = FIXTURE
    const conns = await sampleConnections()
    expect(conns.length).toBe(3)

    const established = conns.find((c) => c.state === "ESTABLISHED")!
    expect(established.command).toBe("curl")
    expect(established.pid).toBe(123)
    expect(established.local).toBe("192.168.1.2:50000")
    expect(established.remote).toBe("93.184.216.34:443")

    // command names with spaces survive (lsof -F c is a single field)
    const listening = conns.find((c) => c.state === "LISTEN")!
    expect(listening.command).toBe("node server")
    expect(listening.local).toBe("*:3000")
    expect(listening.remote).toBe("")

    // sort order: established first, listening last
    expect(conns[0]!.state).toBe("ESTABLISHED")
    expect(conns[conns.length - 1]!.state).toBe("LISTEN")
  })

  test("deduplicates identical sockets", async () => {
    lsofOutput = `${FIXTURE}\nf8\nPTCP\nn*:3000\nTST=LISTEN`
    const conns = await sampleConnections()
    expect(conns.filter((c) => c.local === "*:3000").length).toBe(1)
  })
})
