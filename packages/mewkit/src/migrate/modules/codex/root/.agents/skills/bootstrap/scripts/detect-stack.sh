#!/bin/sh
# detect-stack.sh — Best-effort stack detection from project files
# Outputs detected stack name or "unknown"
# Used by mk:bootstrap to auto-detect before scaffolding
#
# Usage: ./detect-stack.sh [directory]
# Default directory: current working directory
#
# Detected stacks:
#   Mobile    : swift-ios, flutter, android-compose, android
#   Systems   : rust
#   Go        : go
#   Ruby      : rails, ruby
#   Java/Kotlin: spring-boot, kotlin
#   PHP       : laravel, symfony, wordpress, php
#   Python    : fastapi, django, flask, python
#   Node.js   : nestjs, nextjs, nuxt, sveltekit, remix, astro,
#               turborepo, nx, monorepo-pnpm,
#               vue3-ts, react-ts, express, fastify, hono,
#               node-ts, node-js
#   Fallback  : unknown

set -e

DIR="${1:-.}"

detect() {

  # ─── Mobile ───────────────────────────────────────────────────────────────
  if [ -f "$DIR/Package.swift" ]; then
    echo "swift-ios"; return 0
  fi

  if [ -f "$DIR/pubspec.yaml" ]; then
    echo "flutter"; return 0
  fi

  if [ -f "$DIR/android/build.gradle" ] || [ -f "$DIR/build.gradle" ]; then
    if grep -q "compose" "$DIR/build.gradle" 2>/dev/null; then
      echo "android-compose"; return 0
    fi
    echo "android"; return 0
  fi

  # ─── Systems / Low-level ──────────────────────────────────────────────────
  if [ -f "$DIR/Cargo.toml" ]; then
    echo "rust"; return 0
  fi

  # ─── Go ───────────────────────────────────────────────────────────────────
  if [ -f "$DIR/go.mod" ]; then
    echo "go"; return 0
  fi

  # ─── Ruby ─────────────────────────────────────────────────────────────────
  if [ -f "$DIR/Gemfile" ]; then
    if grep -q "rails" "$DIR/Gemfile" 2>/dev/null; then
      echo "rails"; return 0
    fi
    echo "ruby"; return 0
  fi

  # ─── Java / Kotlin ────────────────────────────────────────────────────────
  if [ -f "$DIR/pom.xml" ]; then
    echo "spring-boot"; return 0
  fi

  if [ -f "$DIR/build.gradle.kts" ]; then
    if grep -q "spring" "$DIR/build.gradle.kts" 2>/dev/null; then
      echo "spring-boot"; return 0
    fi
    echo "kotlin"; return 0
  fi

  # ─── PHP ──────────────────────────────────────────────────────────────────
  # WordPress without composer (check early — wp-config.php is definitive)
  if [ -f "$DIR/wp-config.php" ] || [ -d "$DIR/wp-content" ]; then
    echo "wordpress"; return 0
  fi

  if [ -f "$DIR/composer.json" ]; then
    # artisan file is the most reliable Laravel marker
    if [ -f "$DIR/artisan" ]; then
      echo "laravel"; return 0
    fi
    if grep -q '"symfony/' "$DIR/composer.json" 2>/dev/null; then
      echo "symfony"; return 0
    fi
    # WordPress with composer
    if grep -q '"wordpress/' "$DIR/composer.json" 2>/dev/null; then
      echo "wordpress"; return 0
    fi
    echo "php"; return 0
  fi

  # ─── Python ───────────────────────────────────────────────────────────────
  if [ -f "$DIR/pyproject.toml" ]; then
    if grep -q "fastapi" "$DIR/pyproject.toml" 2>/dev/null; then
      echo "fastapi"; return 0
    fi
    if grep -q "django" "$DIR/pyproject.toml" 2>/dev/null; then
      echo "django"; return 0
    fi
    if grep -q "flask" "$DIR/pyproject.toml" 2>/dev/null; then
      echo "flask"; return 0
    fi
    echo "python"; return 0
  fi

  if [ -f "$DIR/setup.py" ]; then
    echo "python"; return 0
  fi

  if [ -f "$DIR/requirements.txt" ]; then
    if grep -qi "fastapi" "$DIR/requirements.txt" 2>/dev/null; then
      echo "fastapi"; return 0
    fi
    if grep -qi "django" "$DIR/requirements.txt" 2>/dev/null; then
      echo "django"; return 0
    fi
    if grep -qi "flask" "$DIR/requirements.txt" 2>/dev/null; then
      echo "flask"; return 0
    fi
    echo "python"; return 0
  fi

  # ─── Node.js ecosystem ────────────────────────────────────────────────────
  if [ -f "$DIR/package.json" ]; then

    # Monorepo markers (check before framework markers)
    if [ -f "$DIR/turbo.json" ]; then
      echo "turborepo"; return 0
    fi
    if [ -f "$DIR/nx.json" ]; then
      echo "nx"; return 0
    fi
    if [ -f "$DIR/pnpm-workspace.yaml" ]; then
      echo "monorepo-pnpm"; return 0
    fi

    # Config file markers — more reliable than package.json dep scan
    # (config files are framework-specific and have fewer false positives)
    if [ -f "$DIR/nest-cli.json" ]; then
      echo "nestjs"; return 0
    fi
    if [ -f "$DIR/next.config.js" ] || \
       [ -f "$DIR/next.config.ts" ] || \
       [ -f "$DIR/next.config.mjs" ]; then
      echo "nextjs"; return 0
    fi
    if [ -f "$DIR/nuxt.config.ts" ] || [ -f "$DIR/nuxt.config.js" ]; then
      echo "nuxt"; return 0
    fi
    if [ -f "$DIR/svelte.config.js" ] || [ -f "$DIR/svelte.config.ts" ]; then
      echo "sveltekit"; return 0
    fi
    if [ -f "$DIR/remix.config.js" ]; then
      echo "remix"; return 0
    fi
    if [ -f "$DIR/astro.config.mjs" ] || [ -f "$DIR/astro.config.ts" ]; then
      echo "astro"; return 0
    fi

    # Vite + Remix (no remix.config.js in newer versions)
    if [ -f "$DIR/vite.config.ts" ] || [ -f "$DIR/vite.config.js" ]; then
      if grep -q "remix" "$DIR/vite.config.ts" 2>/dev/null || \
         grep -q "remix" "$DIR/vite.config.js" 2>/dev/null; then
        echo "remix"; return 0
      fi
    fi

    # package.json dependency scan (fallback — less reliable, more false positives)
    if grep -q '"@nestjs/core"' "$DIR/package.json" 2>/dev/null; then
      echo "nestjs"; return 0
    fi
    if grep -q '"next"' "$DIR/package.json" 2>/dev/null; then
      echo "nextjs"; return 0
    fi
    if grep -q '"nuxt"' "$DIR/package.json" 2>/dev/null; then
      echo "nuxt"; return 0
    fi
    if grep -q '"@sveltejs/kit"' "$DIR/package.json" 2>/dev/null; then
      echo "sveltekit"; return 0
    fi
    if grep -q '"@remix-run' "$DIR/package.json" 2>/dev/null; then
      echo "remix"; return 0
    fi
    if grep -q '"astro"' "$DIR/package.json" 2>/dev/null; then
      echo "astro"; return 0
    fi
    if grep -q '"vue"' "$DIR/package.json" 2>/dev/null; then
      echo "vue3-ts"; return 0
    fi
    if grep -q '"react"' "$DIR/package.json" 2>/dev/null; then
      echo "react-ts"; return 0
    fi
    if grep -q '"fastify"' "$DIR/package.json" 2>/dev/null; then
      echo "fastify"; return 0
    fi
    if grep -q '"hono"' "$DIR/package.json" 2>/dev/null; then
      echo "hono"; return 0
    fi
    if grep -q '"express"' "$DIR/package.json" 2>/dev/null; then
      echo "express"; return 0
    fi

    # Generic Node fallback — TypeScript before plain JS
    if grep -q '"typescript"' "$DIR/package.json" 2>/dev/null; then
      echo "node-ts"; return 0
    fi
    echo "node-js"; return 0
  fi

  # ─── Fallback ─────────────────────────────────────────────────────────────
  echo "unknown"
}

STACK=$(detect)
echo "$STACK"