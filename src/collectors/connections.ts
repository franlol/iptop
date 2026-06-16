import { byPlatform } from "../lib/platform"
import * as darwin from "./connections/connections.darwin"
import * as linux from "./connections/connections.linux"

export interface Connection {
  command: string
  pid: number
  protocol: string
  local: string
  remote: string
  remoteDisplay: string
  state: string
}

export const sampleConnections = byPlatform({ darwin, linux }).sampleConnections
