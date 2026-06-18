import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { MapApp } from "./MapApp"
import pkg from "../package.json" with { type: "json" }

const args = process.argv.slice(2)

if (args.includes("--version") || args.includes("-v")) {
  console.log(`iptop ${pkg.version}`)
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`iptop ${pkg.version} — htop for your network

Usage: iptop [options]

Options:
  --map            Fullscreen world-map mode
  -v, --version    Print version and exit
  -h, --help       Print this help and exit

Keys: j/k select · ⏎ inspect · s sort · m map · q quit`)
  process.exit(0)
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
})

createRoot(renderer).render(args.includes("--map") ? <MapApp /> : <App />)
