import { byPlatform } from "../lib/platform"
import * as darwin from "./traffic/traffic.darwin"
import * as linux from "./traffic/traffic.linux"

export interface ProcessRate {
  name: string
  pid: number
  rxRate: number
  txRate: number
  rxTotal: number
  txTotal: number
}

export interface RemoteHost {
  ip: string
  host: string
  country: string
  org: string
  lat: number | null
  lon: number | null
  rxRate: number
  txRate: number
}

export interface ProcessConnection {
  local: string
  remote: string
  remoteDisplay: string
  country: string
  rxRate: number
  txRate: number
}

export interface ProcessHistory {
  rx: number[]
  tx: number[]
}

export interface TrafficSample {
  processes: ProcessRate[]
  remotes: RemoteHost[]
  // keyed by "local|remote" for joining with the connections collector
  connectionRates: Map<string, { rxRate: number; txRate: number }>
  processConnections: Map<number, ProcessConnection[]>
  histories: Map<number, ProcessHistory>
}

export { EMPTY_TRAFFIC } from "./traffic/traffic.shared"

export const sampleTraffic = byPlatform({ darwin, linux }).sampleTraffic
