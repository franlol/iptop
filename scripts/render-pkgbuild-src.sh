#!/usr/bin/env bash
# Render the AUR PKGBUILD (iptop, built from source with bun).
# Usage: render-pkgbuild-src.sh <version> <tag> <source-tarball-sha256>
set -euo pipefail

version="$1"
tag="$2"
src_sha="$3"
repo="franlol/iptop"

cat <<EOF
# Maintainer: franlol
pkgname=iptop
pkgver=$version
pkgrel=1
pkgdesc="htop for your network — a beautiful real-time IP traffic monitor for the terminal"
arch=('x86_64' 'aarch64')
url="https://github.com/$repo"
license=('MIT')
makedepends=('bun')
conflicts=('iptop-bin')
options=(!strip)
source=("iptop-\$pkgver.tar.gz::https://github.com/$repo/archive/refs/tags/$tag.tar.gz")
sha256sums=('$src_sha')

build() {
  cd "\$srcdir/iptop-$version"
  bun install --frozen-lockfile
  bun build --compile src/index.tsx --outfile iptop
}

package() {
  cd "\$srcdir/iptop-$version"
  install -Dm755 iptop "\$pkgdir/usr/bin/iptop"
  install -Dm644 LICENSE "\$pkgdir/usr/share/licenses/\$pkgname/LICENSE"
}
EOF
