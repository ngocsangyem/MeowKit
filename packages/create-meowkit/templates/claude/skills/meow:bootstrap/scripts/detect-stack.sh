#!/bin/sh
# detect-stack.sh — Best-effort stack detection from project files
# Outputs detected stack name or "unknown"
# Used by meow:bootstrap to auto-detect before scaffolding

set -e

DIR="${1:-.}"

detect() {
  # Check for existing project markers
  if [ -f "$DIR/Package.swift" ]; then echo "swift-ios"; return 0; fi
  if [ -f "$DIR/Cargo.toml" ]; then echo "rust"; return 0; fi
  if [ -f "$DIR/go.mod" ]; then echo "go"; return 0; fi
  if [ -f "$DIR/pyproject.toml" ] || [ -f "$DIR/setup.py" ]; then echo "python"; return 0; fi

  # Node.js ecosystem — check package.json for framework hints
  if [ -f "$DIR/package.json" ]; then
    if grep -q '"@nestjs/core"' "$DIR/package.json" 2>/dev/null; then echo "nestjs"; return 0; fi
    if grep -q '"nuxt"' "$DIR/package.json" 2>/dev/null; then echo "nuxt"; return 0; fi
    if grep -q '"next"' "$DIR/package.json" 2>/dev/null; then echo "nextjs"; return 0; fi
    if grep -q '"vue"' "$DIR/package.json" 2>/dev/null; then echo "vue3-ts"; return 0; fi
    if grep -q '"react"' "$DIR/package.json" 2>/dev/null; then echo "react-ts"; return 0; fi
    # Generic Node.js with TypeScript
    if grep -q '"typescript"' "$DIR/package.json" 2>/dev/null; then echo "node-ts"; return 0; fi
    echo "node-js"; return 0
  fi

  echo "unknown"
}

STACK=$(detect)
echo "$STACK"
