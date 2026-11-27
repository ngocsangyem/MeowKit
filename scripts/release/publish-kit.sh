#!/usr/bin/env bash
# publish-kit.sh <version> <title> <notes-file> <commit-sha>
# Publishes dist/meowkit-release.zip + dist/checksums.txt as the GitHub Release v<version>,
# creating the tag at <commit-sha> when it does not exist. A version with `-` is a
# prerelease and never `latest`, so plain `mewkit init` keeps the stable kit.
# Published assets are never replaced (immutable releases): a rerun completes a draft or exits.
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION="${1:-}"; TITLE="${2:-}"; NOTES_FILE="${3:-}"; SHA="${4:-}"
if [ -z "$VERSION" ] || [ -z "$TITLE" ] || [ ! -f "$NOTES_FILE" ] || [ -z "$SHA" ]; then
  echo "usage: publish-kit.sh <version> <title> <notes-file> <commit-sha>" >&2
  exit 1
fi
for asset in meowkit-release.zip checksums.txt; do
  [ -f "dist/$asset" ] || { echo "dist/$asset is missing: run build-kit.sh first" >&2; exit 1; }
done

TAG="v$VERSION"
FLAGS=(--latest)
case "$VERSION" in *-*) FLAGS=(--prerelease --latest=false) ;; esac

# A beta planned before its stable shipped must not be published after it.
case "$VERSION" in *-*)
  if gh release view "v${VERSION%%-*}" >/dev/null 2>&1; then
    echo "v${VERSION%%-*} is already released; beta $VERSION is obsolete and is not published" >&2
    exit 1
  fi ;;
esac

# Immutable releases: once published, a release's assets can never change. So the release is
# built as a draft (mutable), every asset uploaded, and only then published, which also
# creates the tag at <commit-sha>. A published release is left exactly as it is.
STATE="$(gh release view "$TAG" --json isDraft -q .isDraft 2>/dev/null || echo missing)"
case "$STATE" in
  false)
    echo "$TAG is already published; releases are immutable, leaving it."
    exit 0 ;;
  true)
    echo "  $TAG is a draft from an earlier run; completing it."
    EXISTING="$(gh release view "$TAG" --json assets --jq '.assets[].name')"
    for asset in meowkit-release.zip checksums.txt; do
      printf '%s\n' "$EXISTING" | grep -qx "$asset" || gh release upload "$TAG" "dist/$asset"
    done
    gh release edit "$TAG" --target "$SHA" --title "$TAG — $TITLE" --notes-file "$NOTES_FILE" ;;
  *)
    gh release create "$TAG" dist/meowkit-release.zip dist/checksums.txt --draft \
      --target "$SHA" --title "$TAG — $TITLE" --notes-file "$NOTES_FILE" "${FLAGS[@]}" ;;
esac
gh release edit "$TAG" --draft=false "${FLAGS[@]}"
echo "Published $TAG: $(gh release view "$TAG" --json url -q .url)"
