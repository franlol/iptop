import { run } from "../../lib/exec"

export async function getDnsServer(): Promise<string> {
  const out = await run(["scutil", "--dns"])
  return out.match(/nameserver\[0\] : (\S+)/)?.[1] ?? ""
}

// BSD ping: -W is the reply timeout in milliseconds, -t caps the run in seconds.
export function pingCommand(host: string): string[] {
  return ["ping", "-c", "1", "-W", "1000", "-t", "2", host]
}
