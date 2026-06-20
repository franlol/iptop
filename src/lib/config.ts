// Persisted user config, stored at $XDG_CONFIG_HOME/iptop/config
// (XDG_CONFIG_HOME defaults to ~/.config). Plain `key = value` lines so it's
// trivial to hand-edit; `#` starts a comment. Reads/writes are best-effort: a
// missing or malformed file just yields defaults so the app never fails to
// start over config.

export interface Config {
  theme?: string
}

const configDir = `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/iptop`
export const configPath = `${configDir}/config`

// known keys, in the order they're written back out
const KEYS = ["theme"] as const

function parse(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (key !== "") out[key] = line.slice(eq + 1).trim()
  }
  return out
}

function serialize(values: Record<string, string>): string {
  const lines = ["# iptop config — edit by hand or via the in-app theme picker (t)"]
  // known keys first (stable order), then any extras the user added
  const extras = Object.keys(values).filter((k) => !KEYS.includes(k as (typeof KEYS)[number]))
  for (const key of [...KEYS, ...extras]) {
    const value = values[key]
    if (value !== undefined && value !== "") lines.push(`${key} = ${value}`)
  }
  return `${lines.join("\n")}\n`
}

export async function loadConfig(): Promise<Config> {
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) return {}
    return parse(await file.text())
  } catch {
    return {}
  }
}

export async function saveConfig(patch: Config): Promise<void> {
  try {
    const merged = { ...(await loadConfig()), ...patch } as Record<string, string>
    // Bun.write creates parent directories as needed
    await Bun.write(configPath, serialize(merged))
  } catch {
    // ignore — persistence is a nicety, not worth crashing over
  }
}
