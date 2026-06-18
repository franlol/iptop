# Release & packaging setup

Releases are tag-driven. Once configured:

```bash
# bump version first so the tag matches package.json
git tag v0.1.0 && git push origin v0.1.0
```

fires `.github/workflows/release.yml`, which:

1. **builds** a self-contained binary on each native runner
   (macOS arm64/x64, Linux x64/arm64) — the Zig `libopentui` core is embedded
   by `bun build --compile`, so cross-compiling is not possible; each target
   builds on its own OS;
2. **publishes** a GitHub Release with the tarballs + `checksums.txt`;
3. **(opt-in)** bumps the Homebrew tap and the AUR package.

> The build job **fails fast if the tag doesn't match `package.json` version** —
> always bump `package.json` in the same commit you tag.

---

## Homebrew (opt-in)

Distributes via your own tap: `brew install franlol/tap/iptop`.

One-time setup:

1. Create a public repo **`franlol/homebrew-tap`** with an empty `Formula/`
   directory.
2. Create a fine-grained PAT with **Contents: read/write** on that repo and add
   it to *this* repo as the secret **`HOMEBREW_TAP_TOKEN`**.
3. Enable the job: add repo **variable** `PUBLISH_HOMEBREW=true`
   (Settings → Secrets and variables → Actions → Variables).

The `homebrew` job renders `Formula/iptop.rb` via `scripts/render-homebrew.sh`
and pushes it on every tag.

> `homebrew-core` (the bare `brew install iptop`) is **not** automatable — it
> needs a manual PR and meets notability requirements. The tap is the
> hands-off path.

---

## AUR (opt-in)

Publishes **two** packages from the same secrets:

- **`iptop-bin`** — downloads the prebuilt binary (instant install)
- **`iptop`** — builds from source with `bun` (`makedepends`) on the user's machine

They `conflict` with each other, per AUR convention (a binary package must carry
the `-bin` suffix; the bare name builds from source).

One-time setup:

1. Create an account on <https://aur.archlinux.org> and add an SSH public key
   to it.
2. Add the matching **private** key to this repo as secret
   **`AUR_SSH_PRIVATE_KEY`**.
3. Add repo variables: `PUBLISH_AUR=true`, `AUR_USERNAME=<you>`,
   `AUR_EMAIL=<you@example.com>`.

The `aur` job renders the PKGBUILD via `scripts/render-pkgbuild.sh` and pushes
it. For the *very first* publish the AUR repo must exist; the deploy action
creates it on first push if the package name is free.

> The binary is glibc-linked (built on Ubuntu). It runs on Arch as-is. A musl
> variant is not shipped.

---

## Test the renderers locally

```bash
printf '%s  iptop-v0.1.0-linux-x64.tar.gz\n' "$(shasum -a 256 dist/iptop | cut -d' ' -f1)" > /tmp/c.txt
scripts/render-homebrew.sh 0.1.0 v0.1.0 /tmp/c.txt
scripts/render-pkgbuild.sh 0.1.0 v0.1.0 /tmp/c.txt
```
