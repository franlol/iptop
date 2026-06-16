import { run } from "../lib/exec"
import { byPlatform } from "../lib/platform"
import * as darwin from "./latency/latency.darwin"
import * as linux from "./latency/latency.linux"

export interface LatencySample {
  gatewayMs: number | null
  internetMs: number | null
  dnsMs: number | null
  // fraction of burst probes lost (0..1); null when the target wasn't probed
  gatewayLoss: number | null
  internetLoss: number | null
  dnsLoss: number | null
  dnsServer: string
}

export const EMPTY_LATENCY: LatencySample = {
  gatewayMs: null,
  internetMs: null,
  dnsMs: null,
  gatewayLoss: null,
  internetLoss: null,
  dnsLoss: null,
  dnsServer: "",
}

export const INTERNET_HOST = "1.1.1.1"

const impl = byPlatform({ darwin, linux })

let dnsServer: string | null = null

async function getDnsServer(): Promise<string> {
  if (dnsServer !== null) return dnsServer
  dnsServer = await impl.getDnsServer()
  return dnsServer
}

// Both BSD and GNU ping print "time=12.3 ms"; only the flags differ.
async function pingOnce(host: string): Promise<number | null> {
  if (!host) return null
  const out = await run(impl.pingCommand(host))
  const ms = out.match(/time=([\d.]+) ms/)?.[1]
  return ms ? Number(ms) : null
}

// Probes per sample; staggered single pings rather than `ping -c N -i 0.2`
// because BSD ping requires root for sub-second intervals.
const BURST = 4
const BURST_SPACING_MS = 150

interface BurstResult {
  ms: number | null
  loss: number | null
}

const NO_PROBE: BurstResult = { ms: null, loss: null }

// Latency is the average of the replies; loss is the fraction that got none.
async function pingBurst(host: string): Promise<BurstResult> {
  if (!host) return NO_PROBE
  const times = await Promise.all(
    Array.from({ length: BURST }, async (_, i) => {
      if (i > 0) await Bun.sleep(i * BURST_SPACING_MS)
      return pingOnce(host)
    }),
  )
  const replies = times.filter((t): t is number => t !== null)
  return {
    ms: replies.length > 0 ? replies.reduce((a, b) => a + b, 0) / replies.length : null,
    loss: (BURST - replies.length) / BURST,
  }
}

export async function sampleLatency(gateway: string): Promise<LatencySample> {
  const dns = await getDnsServer()
  const [gatewayR, internetR, dnsR] = await Promise.all([
    pingBurst(gateway),
    pingBurst(INTERNET_HOST),
    dns === gateway ? Promise.resolve(NO_PROBE) : pingBurst(dns),
  ])
  return {
    gatewayMs: gatewayR.ms,
    internetMs: internetR.ms,
    dnsMs: dnsR.ms,
    gatewayLoss: gatewayR.loss,
    internetLoss: internetR.loss,
    dnsLoss: dnsR.loss,
    dnsServer: dns,
  }
}
