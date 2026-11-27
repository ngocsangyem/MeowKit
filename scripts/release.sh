#!/bin/bash
# MeowKit manual kit release — recovery only.
# Releases normally run in GitHub Actions: a merge into `develop` publishes a beta, and a
# merged `release/vX.Y.Z` pull request publishes the stable from `main` (see RELEASING.md).
# Use this script only to finish a kit release that a workflow could not, from a clean
# checkout of the exact commit to release. It never commits or pushes a branch, and it does
# not build the binaries: the `mewkit-v<version>` release must already exist.
#
# Usage: ./scripts/release.sh <version> "<release title>"
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
TITLE="${2:-}"
if [ -z "$VERSION" ] || [ -z "$TITLE" ]; then
  echo "Usage: ./scripts/release.sh <version> \"<release title>\"" >&2
  exit 1
fi
for cmd in node npm gh git cargo; do
  command -v "$cmd" >/dev/null || { echo "Error: $cmd is required" >&2; exit 1; }
done
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: the working tree is not clean; release from a clean checkout." >&2
  exit 1
fi
SHA="$(git rev-parse HEAD)"
if [ -z "$(git branch -r --contains "$SHA" 2>/dev/null)" ]; then
  echo "Error: HEAD $SHA is not on any remote branch; push it through a reviewed PR first." >&2
  exit 1
fi
if ! gh release view "mewkit-v$VERSION" >/dev/null 2>&1; then
  echo "Error: binary release mewkit-v$VERSION does not exist; kit and binary share one version." >&2
  exit 1
fi

bash scripts/release/build-kit.sh "$VERSION"

NOTES="$(mktemp)"
BETA_FLAG=""; case "$VERSION" in *-*) BETA_FLAG=" --beta" ;; esac
cat > "$NOTES" <<NOTES_EOF
## $TITLE

See [changelog](https://docs.meowkit.dev/changelog) for full details.

### Install

\`\`\`bash
mewkit init$BETA_FLAG
# or upgrade:
mewkit upgrade$BETA_FLAG
\`\`\`
NOTES_EOF
bash scripts/release/publish-kit.sh "$VERSION" "$TITLE" "$NOTES" "$SHA"
git checkout -- package.json Cargo.toml Cargo.lock .claude/kit-contract.json 2>/dev/null || true
