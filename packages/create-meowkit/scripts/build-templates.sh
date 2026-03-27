#!/usr/bin/env bash
# Copies the real MeowKit .claude/ system into templates/ for npm packaging.
# Run before `tsc` in the build pipeline.
# Source of truth: ../../.claude/ (the monorepo root .claude/ directory)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_CLAUDE="$(cd "$PKG_DIR/../.." && pwd)/.claude"
TEMPLATES="$PKG_DIR/templates"

if [ ! -d "$SOURCE_CLAUDE" ]; then
  echo "ERROR: Source .claude/ not found at $SOURCE_CLAUDE"
  exit 1
fi

echo "Building templates from $SOURCE_CLAUDE ..."

# Clean previous templates
rm -rf "$TEMPLATES"
mkdir -p "$TEMPLATES/claude"

# Copy core system directories
for dir in agents commands hooks modes rules scripts skills; do
  if [ -d "$SOURCE_CLAUDE/$dir" ]; then
    rsync -a \
      --exclude '__pycache__' \
      --exclude 'node_modules' \
      --exclude '.DS_Store' \
      --exclude '*.pyc' \
      "$SOURCE_CLAUDE/$dir/" "$TEMPLATES/claude/$dir/"
  fi
done

# Copy settings.json
if [ -f "$SOURCE_CLAUDE/settings.json" ]; then
  cp "$SOURCE_CLAUDE/settings.json" "$TEMPLATES/claude/settings.json"
fi

# Create empty memory directory marker
mkdir -p "$TEMPLATES/claude/memory"
touch "$TEMPLATES/claude/memory/.gitkeep"

# Create CLAUDE.md template with placeholders
# Read the real CLAUDE.md and add placeholder markers at top
REAL_CLAUDE="$PKG_DIR/../../CLAUDE.md"
if [ -f "$REAL_CLAUDE" ]; then
  {
    echo "# __MEOWKIT_PROJECT_NAME__"
    echo ""
    echo "> Stack: __MEOWKIT_STACK__ | Team: __MEOWKIT_TEAM_SIZE__ | Mode: __MEOWKIT_DEFAULT_MODE__"
    echo ""
    cat "$REAL_CLAUDE"
  } > "$TEMPLATES/claude-md.template"
else
  echo "WARNING: CLAUDE.md not found at $REAL_CLAUDE — creating minimal template"
  cat > "$TEMPLATES/claude-md.template" << 'TMPL'
# __MEOWKIT_PROJECT_NAME__

> Stack: __MEOWKIT_STACK__ | Team: __MEOWKIT_TEAM_SIZE__ | Mode: __MEOWKIT_DEFAULT_MODE__

## MeowKit — AI Agent Workflow System

See .claude/ directory for agents, skills, commands, modes, rules, and hooks.
TMPL
fi

# Create config.json template
cat > "$TEMPLATES/meowkit-config.json.template" << 'TMPL'
{
  "$schema": "https://meowkit.dev/schema/config.json",
  "version": "1.0.0",
  "project": {
    "name": "__MEOWKIT_PROJECT_NAME__",
    "stack": __MEOWKIT_STACK_JSON__
  },
  "team": {
    "size": "__MEOWKIT_TEAM_SIZE__"
  },
  "tool": {
    "primary": "__MEOWKIT_PRIMARY_TOOL__"
  },
  "mode": {
    "default": "__MEOWKIT_DEFAULT_MODE__"
  },
  "features": {
    "costTracking": __MEOWKIT_COST_TRACKING__,
    "memory": __MEOWKIT_MEMORY_ENABLED__
  }
}
TMPL

# Create .env.example template
cat > "$TEMPLATES/env.example" << 'TMPL'
# MeowKit Environment Variables
# Copy to .env and fill in values. Never commit .env to git.

# Gemini API key (required for meow:multimodal skill)
# Get from: https://aistudio.google.com/apikey
GEMINI_API_KEY=
TMPL

# Create .mcp.json.example template
cat > "$TEMPLATES/mcp.json.example" << 'TMPL'
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
TMPL

# Create .gitignore additions
cat > "$TEMPLATES/gitignore.meowkit" << 'TMPL'
# MeowKit — append to your .gitignore
.env
.env.local
.claude/memory/
.claude/logs/
TMPL

# Count results
FILE_COUNT=$(find "$TEMPLATES" -type f | wc -l | tr -d ' ')
echo "Templates built: $FILE_COUNT files"
