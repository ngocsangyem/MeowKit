# ADR: the kit and the `mewkit-next` binary ship as two release streams

- Date: 2026-11-11
- Status: proposed
- Scope: GitHub releases of this repository, `.github/workflows/rust-release.yml`,
  `install.sh`, `install.ps1`, `mewkit-next self-update`, `scripts/release-check.sh`
- Related: [261110-rust-adapter-contract.md](261110-rust-adapter-contract.md)

## Context

The kit (`.claude/` content) is released as `meowkit-release.zip` on `v*` tags, and the npm
`mewkit` CLI downloads it. `mewkit-next`, the Rust installer, is a native binary for six
targets. It needs its own releases, and those releases share the repository's release list
with the kit.

Deployed npm CLIs cannot be changed. Their release filter
(`packages/mewkit/src/core/github-releases.ts`) takes the newest release that has an asset
ending in `.zip`, or the three kit-artifact assets. A binary release that matched would be
installed as a kit by every existing user. GitHub's `releases/latest` must also keep
resolving to a kit, since links and scripts outside this repository use it.

The maintainer decided against signing keys (the project is open source and has no key
custody). Integrity therefore rests on SHA-256 digests and on who can change them.

## Decision

**Two streams, never mistakable for each other.**

| | Kit | Binary |
| --- | --- | --- |
| Tag | `vX.Y.Z`, `vX.Y.Z-beta.N` | `mewkit-vX.Y.Z`, `mewkit-vX.Y.Z-beta.N` |
| Built by | `scripts/release.sh` | `rust-release.yml` on the tag |
| Assets | `meowkit-release.zip`, `checksums.txt` | `mewkit-next-<ver>-<target>.tar.gz` ×6, `checksums.txt`, `binary-manifest.json` |
| `releases/latest` | yes, for a stable kit | never (`--latest=false`) |
| Consumer | npm `mewkit`, `mewkit-next init/upgrade` | `install.sh`, `install.ps1`, `mewkit-next self-update` |

- Binary archives are `.tar.gz` on every target, Windows included, and every asset name
  starts with `mewkit-next-`. No binary asset can match the npm filter.
- A prerelease version (`-beta.N`) is published as a GitHub prerelease.
- `binary-manifest.json` (`version`, `channel`, `published_at`, `min_supported`, per-target
  `url`, `sha256`, `size`) is what `self-update` reads. Raising `min_supported` withdraws a
  bad version: `self-update` on any version below it says the version is withdrawn and names
  the release to move to. It does not update by itself.
- **Trust model, no signature.** First install: `install.sh` / `install.ps1` carry, per
  channel and target, the archive URL, SHA-256 and size. The release job proposes new pins in
  a pull request; they reach the default branch only through review. Self-update: the
  manifest is fetched over TLS from this repository's release, and the archive must match its
  digest and size. Anyone who can publish a release here can ship code to `self-update` users;
  that is accepted and stated in `RELEASING.md`.
- **Kit release gate.** `scripts/release-check.sh` installs the candidate kit with the newest
  published `mewkit-next` (`init --dry-run`, all three runtimes). A kit whose `kitContract` or
  `requires.mewkitMin` is beyond that binary fails the kit release.

## Consequences

- A test (`github-releases-binary-coexistence.test.ts`) runs the npm filter over a fixture
  that mixes both streams, using the real asset names from `scripts/release/binary-targets.mjs`.
  Renaming a binary asset into the npm filter's reach fails it.
- `releases/latest` keeps meaning "the newest stable kit". Binary links use the tag
  (`releases/tag/mewkit-v…`) or the pinned installers.
- Installer pins lag a release until its pin PR merges; the installers refuse a channel with
  no pin instead of guessing.
- Adding signing later is additive: a signature asset beside `binary-manifest.json` and a
  verifier in the installers and `self-update`. Nothing in this decision blocks it.
- When `mewkit-next` is renamed to `mewkit` (see `docs/maintainer/mewkit-next-cutover.md`),
  the binary tag prefix and asset prefix stay as they are, so old clients keep finding updates.

## Alternatives rejected

- **One stream (binaries attached to kit releases).** Couples two version cadences that are
  independent by design (`RELEASING.md` "Version Independence"), and puts binaries on the
  release every npm CLI inspects.
- **A separate repository for binaries.** Splits the trust root and the review of installer
  pins across two repositories, for no gain over a tag prefix.
- **`.zip` archives on Windows.** Matches the npm filter.
- **Signed manifests (Ed25519, minisign).** Declined by the maintainer: no key custody.
