import { run } from "../../lib/exec"
import type { NetworkInfo } from "../system"

// `ip route show default` →
// "default via 192.168.1.1 dev enp39s0 proto dhcp src 192.168.1.42 metric 100"
// The src hint is usually present; fall back to the interface address.
export async function getNetworkInfo(): Promise<NetworkInfo> {
  const routeOut = await run(["ip", "route", "show", "default"])
  const gateway = routeOut.match(/via (\S+)/)?.[1] ?? ""
  const iface = routeOut.match(/dev (\S+)/)?.[1]
  let localIp = routeOut.match(/src (\S+)/)?.[1] ?? ""
  if (!localIp && iface) {
    const addrOut = await run(["ip", "-4", "addr", "show", "dev", iface])
    localIp = addrOut.match(/inet (\S+?)\//)?.[1] ?? ""
  }
  return { localIp, gateway }
}
