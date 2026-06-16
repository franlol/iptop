import { run } from "../../lib/exec"
import type { NetworkInfo } from "../system"

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const routeOut = await run(["route", "-n", "get", "default"])
  const gateway = routeOut.match(/gateway: (\S+)/)?.[1] ?? ""
  const iface = routeOut.match(/interface: (\S+)/)?.[1] ?? "en0"
  const localIp = (await run(["ipconfig", "getifaddr", iface])).trim()
  return { localIp, gateway }
}
