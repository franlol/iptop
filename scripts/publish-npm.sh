#!/usr/bin/env bash
# Build and publish the npm packages from the release tarballs:
#   - one per-platform package (iptop-<os>-<arch>) holding the prebuilt binary
#   - the main `iptop` launcher package that depends on them
# Usage: publish-npm.sh <version> <tag> <dir-with-release-tarballs>
# Requires: npm authenticated (NODE_AUTH_TOKEN / .npmrc). Pass DRY_RUN=1 to skip publish.
set -euo pipefail

version="$1"
tag="$2"
reldir="$3"
repo="franlol/iptop"

# target (matches release.yml build matrix) -> "<npm os> <npm cpu>"
targets=(darwin-arm64 linux-x64 linux-arm64)
declare -A oscpu=(
  [darwin-arm64]="darwin arm64"
  [linux-x64]="linux x64"
  [linux-arm64]="linux arm64"
)

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
publish() { if [ "${DRY_RUN:-0}" = "1" ]; then echo "DRY_RUN: skipping npm publish in $PWD"; else npm publish --access public; fi; }

optdeps=""
for target in "${targets[@]}"; do
  read -r os cpu <<<"${oscpu[$target]}"
  name="iptop-$target"
  dir="$work/$name"
  mkdir -p "$dir/bin"

  tar -xzf "$reldir/iptop-$tag-$target.tar.gz" -C "$dir/bin" iptop
  chmod 755 "$dir/bin/iptop"
  cp "$root/LICENSE" "$dir/LICENSE"

  cat > "$dir/package.json" <<EOF
{
  "name": "$name",
  "version": "$version",
  "description": "iptop prebuilt binary for $os $cpu",
  "homepage": "https://github.com/$repo",
  "repository": { "type": "git", "url": "https://github.com/$repo" },
  "license": "MIT",
  "os": ["$os"],
  "cpu": ["$cpu"],
  "files": ["bin/iptop", "LICENSE"]
}
EOF

  ( cd "$dir" && publish )
  optdeps+="    \"$name\": \"$version\","$'\n'
done
optdeps="${optdeps%,$'\n'}"  # drop the trailing comma

# --- main launcher package -------------------------------------------------
main="$work/iptop"
mkdir -p "$main/bin"
cp "$root/packaging/npm/iptop.js" "$main/bin/iptop.js"
cp "$root/README.md" "$root/LICENSE" "$main/"

cat > "$main/package.json" <<EOF
{
  "name": "iptop",
  "version": "$version",
  "description": "htop for your network — real-time terminal IP traffic monitor",
  "homepage": "https://github.com/$repo",
  "repository": { "type": "git", "url": "https://github.com/$repo" },
  "license": "MIT",
  "bin": { "iptop": "bin/iptop.js" },
  "files": ["bin/iptop.js", "README.md", "LICENSE"],
  "optionalDependencies": {
$optdeps
  }
}
EOF

( cd "$main" && publish )
echo "npm: published iptop@$version + ${#targets[@]} platform packages"
