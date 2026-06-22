#!/usr/bin/env node
// npm launcher for iptop. The real program is a `bun build --compile` binary
// shipped in a per-platform optionalDependency (iptop-<os>-<arch>); npm installs
// only the one matching the user's machine. This script finds it and execs it.
"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")

const key = `${process.platform}-${process.arch}`

// Must stay in sync with the build matrix in .github/workflows/release.yml and
// scripts/publish-npm.sh.
const PKGS = {
  "darwin-arm64": "iptop-darwin-arm64",
  "linux-x64": "iptop-linux-x64",
  "linux-arm64": "iptop-linux-arm64",
}

const pkg = PKGS[key]
if (!pkg) {
  console.error(`iptop: unsupported platform "${key}".`)
  console.error("Supported: macOS arm64, Linux x64, Linux arm64.")
  process.exit(1)
}

let binary
try {
  binary = require.resolve(`${pkg}/bin/iptop`)
} catch {
  console.error(`iptop: the platform package "${pkg}" is not installed.`)
  console.error("Reinstall without --no-optional / --ignore-scripts, e.g. `npm i -g iptop`.")
  process.exit(1)
}

// npm usually preserves the exec bit packed into the tarball, but a global
// root install can drop it — make sure before we run.
try {
  fs.chmodSync(binary, 0o755)
} catch {}

const r = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" })
if (r.error) {
  console.error(`iptop: ${r.error.message}`)
  process.exit(1)
}
process.exit(r.status === null ? 1 : r.status)
