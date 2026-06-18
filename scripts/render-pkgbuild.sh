#!/usr/bin/env bash
# Render the AUR PKGBUILD (iptop-bin) from release checksums.
# Usage: render-pkgbuild.sh <version> <tag> <checksums.txt>
set -euo pipefail

version="$1"
tag="$2"
checksums="$3"
repo="franlol/iptop"
base="https://github.com/$repo/releases/download/$tag"

sha() { awk -v f="iptop-$tag-$1.tar.gz" '$2==f{print $1}' "$checksums"; }

cat <<EOF
# Maintainer: franlol
pkgname=iptop-bin
pkgver=$version
pkgrel=1
pkgdesc="htop for your network — a beautiful real-time IP traffic monitor for the terminal"
arch=('x86_64' 'aarch64')
url="https://github.com/$repo"
license=('MIT')
provides=('iptop')
conflicts=('iptop')
options=(!strip)
source_x86_64=("iptop-\$pkgver-x86_64.tar.gz::$base/iptop-$tag-linux-x64.tar.gz")
source_aarch64=("iptop-\$pkgver-aarch64.tar.gz::$base/iptop-$tag-linux-arm64.tar.gz")
sha256sums_x86_64=('$(sha linux-x64)')
sha256sums_aarch64=('$(sha linux-arm64)')

package() {
  install -Dm755 "\$srcdir/iptop" "\$pkgdir/usr/bin/iptop"
  install -Dm644 "\$srcdir/LICENSE" "\$pkgdir/usr/share/licenses/\$pkgname/LICENSE"
}
EOF
