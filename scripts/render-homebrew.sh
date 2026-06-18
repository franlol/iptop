#!/usr/bin/env bash
# Render the Homebrew formula from release checksums.
# Usage: render-homebrew.sh <version> <tag> <checksums.txt>
set -euo pipefail

version="$1"
tag="$2"
checksums="$3"
repo="franlol/iptop"
base="https://github.com/$repo/releases/download/$tag"

sha() { awk -v f="iptop-$tag-$1.tar.gz" '$2==f{print $1}' "$checksums"; }

cat <<EOF
class Iptop < Formula
  desc "htop for your network — real-time terminal IP traffic monitor"
  homepage "https://github.com/$repo"
  version "$version"
  license "MIT"

  # macOS: Apple Silicon only (Intel Macs are not supported via this tap).
  on_macos do
    depends_on arch: :arm64
    on_arm do
      url "$base/iptop-$tag-darwin-arm64.tar.gz"
      sha256 "$(sha darwin-arm64)"
    end
  end

  on_linux do
    on_arm do
      url "$base/iptop-$tag-linux-arm64.tar.gz"
      sha256 "$(sha linux-arm64)"
    end
    on_intel do
      url "$base/iptop-$tag-linux-x64.tar.gz"
      sha256 "$(sha linux-x64)"
    end
  end

  def install
    bin.install "iptop"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/iptop --version")
  end
end
EOF
