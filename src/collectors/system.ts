import { hostname } from "node:os"
import { byPlatform } from "../lib/platform"
import * as darwin from "./system/system.darwin"
import * as linux from "./system/system.linux"

export interface SystemInfo {
  host: string
  localIp: string
  gateway: string
  publicIp: string
}

export const EMPTY_SYSTEM: SystemInfo = { host: "", localIp: "", gateway: "", publicIp: "" }

// The platform-specific part: local address + default gateway.
export interface NetworkInfo {
  localIp: string
  gateway: string
}

const impl = byPlatform({ darwin, linux })

let cachedPublicIp = ""

async function fetchPublicIp(): Promise<string> {
  if (process.env.IPTOP_FAKE_PUBLIC_IP) return process.env.IPTOP_FAKE_PUBLIC_IP
  if (cachedPublicIp) return cachedPublicIp
  try {
    const res = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(3000) })
    cachedPublicIp = (await res.text()).trim()
  } catch {
    cachedPublicIp = ""
  }
  return cachedPublicIp
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const [{ localIp, gateway }, publicIp] = await Promise.all([impl.getNetworkInfo(), fetchPublicIp()])
  return { host: hostname(), localIp, gateway, publicIp }
}
