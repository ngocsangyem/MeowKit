#!/usr/bin/env bash
# build-kit.sh <version> — stamp the version and build + gate the kit release assets.
# No git, no gh writes: safe to run in CI on any branch and locally before publish-kit.sh.
# Kit and binary share one version: root package.json, Cargo.toml and the kit contract are
# all stamped to <version>. The readiness gate installs the candidate kit with
# $MEWKIT_NEXT_BIN (the CI release workflow points it at the binary built in the same run).
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION="${1:-}"
if ! printf '%s' "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'; then
  echo "usage: build-kit.sh <X.Y.Z | X.Y.Z-beta.N>" >&2
  exit 1
fi

echo "[1/5] Stamping v$VERSION (package.json, Cargo.toml, Cargo.lock, kit contract)"
node scripts/sync-versions.cjs --set "$VERSION"
node scripts/release/assemble-changelog.cjs check

echo "[2/5] Release-readiness gate"
bash scripts/release-check.sh

echo "[3/5] Harness JSON configs"
for f in .claude/settings.json .claude/hooks/handlers.json .claude/metadata.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || { echo "Error: $f is invalid JSON" >&2; exit 1; }
done

echo "[4/5] Release assets"
node scripts/prepare-release-assets.cjs "$VERSION"
node scripts/verify-release-assets.cjs "$VERSION" dist

echo "[5/5] Docs build"
# The first build in a fresh checkout has failed once and passed on rerun; retry once, and
# never pipe the build through a filter that would hide its exit code.
npm run build -w packages/docs || { echo "docs build failed; retrying once" >&2; npm run build -w packages/docs; }

echo "Kit v$VERSION built: dist/meowkit-release.zip, dist/checksums.txt"
