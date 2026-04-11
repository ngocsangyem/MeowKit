#!/bin/bash
# MeowKit Release Script
# Usage: ./scripts/release.sh <version> "<release title>"
# Example: ./scripts/release.sh 2.3.2 "The Agent-Skills Integration Release"

set -euo pipefail

VERSION="${1:-}"
TITLE="${2:-}"

if [ -z "$VERSION" ] || [ -z "$TITLE" ]; then
  echo "Usage: ./scripts/release.sh <version> \"<release title>\""
  echo "Example: ./scripts/release.sh 2.3.2 \"The Agent-Skills Integration Release\""
  exit 1
fi

# Validate version format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: Invalid version format: $VERSION"
  echo "Expected: X.Y.Z or X.Y.Z-beta.N"
  exit 1
fi

# Ensure we're in the meowkit root
if [ ! -f "package.json" ] || [ ! -d ".claude" ]; then
  echo "Error: Run this script from the meowkit project root"
  exit 1
fi

# Check required tools
for cmd in node npm gh git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not installed"
    exit 1
  fi
done

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Warning: You have uncommitted changes."
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "=== MeowKit Release v$VERSION ==="
echo ""

# Step 1: Bump version (metadata only — packages/mewkit is released separately)
echo "[1/7] Bumping version to $VERSION..."
# metadata.json is updated by prepare-release-assets.cjs in step 3

# Step 2: Build and verify (harness-only — skip CLI packages)
echo "[2/7] Verifying harness files..."
# Validate settings.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" || { echo "Error: settings.json is invalid JSON"; exit 1; }
# Validate handlers.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('.claude/hooks/handlers.json','utf8'))" || { echo "Error: handlers.json is invalid JSON"; exit 1; }
# Validate metadata.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('.claude/metadata.json','utf8'))" || { echo "Error: metadata.json is invalid JSON"; exit 1; }
echo "  All JSON configs valid."

# Step 3: Build release assets
echo "[3/7] Building release assets..."
node scripts/prepare-release-assets.cjs "$VERSION"

# Verify zip
ZIP_SIZE=$(python3 -c "import os; print(f'{os.path.getsize(\"dist/meowkit-release.zip\")/1024:.0f}')")
echo "  Release zip: ${ZIP_SIZE} KB"

# Step 4: VitePress build check
echo "[4/7] Verifying VitePress build..."
(cd website && npx vitepress build) 2>&1 | tail -1

# Step 5: Commit and tag
echo "[5/7] Committing and tagging..."
git add -A
git commit -m "chore: release v$VERSION"
git tag -a "v$VERSION" -m "v$VERSION — $TITLE"

# Step 6: Push
echo "[6/7] Pushing to GitHub..."
git push origin main
git push origin "v$VERSION"

# Step 7: Create GitHub Release
echo "[7/7] Creating GitHub Release..."
gh release create "v$VERSION" dist/meowkit-release.zip \
  --title "v$VERSION — $TITLE" \
  --notes "## $TITLE

See [changelog](https://docs.meowkit.dev/changelog) for full details.

### Install

\`\`\`bash
npx mewkit init
# or upgrade:
npx mewkit upgrade
\`\`\`"

# Verify
echo ""
echo "=== Release v$VERSION Complete ==="
echo ""
echo "Verify:"
echo "  Tag:   $(git tag | grep "v$VERSION")"
echo "  Asset: $(gh release view "v$VERSION" --json assets -q '.assets[].name')"
echo "  URL:   $(gh release view "v$VERSION" --json url -q '.url')"
