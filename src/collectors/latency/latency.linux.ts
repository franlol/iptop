import { readText } from "../../lib/exec"

export async function getDnsServer(): Promise<string> {
  const out = await readText("/etc/resolv.conf").catch(() => "")
  return out.match(/^nameserver (\S+)/m)?.[1] ?? ""
}

// GNU ping: -W is the reply timeout in seconds; -n skips reverse DNS.
export function pingCommand(host: string): string[] {
  return ["ping", "-n", "-c", "1", "-W", "1", host]
}
