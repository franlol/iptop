import { byPlatform } from "../lib/platform"
import * as darwin from "./throughput/throughput.darwin"
import * as linux from "./throughput/throughput.linux"

export interface InterfaceRate {
  name: string
  rxRate: number
  txRate: number
}

export interface ThroughputSample {
  rxRate: number
  txRate: number
  rxTotal: number
  txTotal: number
  interfaces: InterfaceRate[]
}

export const EMPTY_THROUGHPUT: ThroughputSample = {
  rxRate: 0,
  txRate: 0,
  rxTotal: 0,
  txTotal: 0,
  interfaces: [],
}

export const sampleThroughput = byPlatform({ darwin, linux }).sampleThroughput
