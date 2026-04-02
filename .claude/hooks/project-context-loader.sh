#!/bin/bash
# MeowKit Project Context Loader Hook
# SessionStart: Auto-load docs/project-context.md into agent context.
# Supports Phase 5 (Project Context System).
#
# If docs/project-context.md exists, outputs its content for injection.
# If not, outputs a reminder to generate it.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

CONTEXT_FILE="docs/project-context.md"
VENV_PYTHON=".claude/skills/.venv/bin/python3"

# Check Python venv existence — required for MeowKit scripts
if [ ! -f "$VENV_PYTHON" ]; then
  echo "## WARNING: Python venv not found"
  echo ""
  echo "MeowKit scripts require \`.claude/skills/.venv/bin/python3\` but it doesn't exist."
  echo "Run \`npx mewkit setup\` to create the venv and install dependencies."
  echo "Until then, python-based skills (validate, security-scan, multimodal, llms) will fail."
  echo ""
fi

if [ -f "$CONTEXT_FILE" ]; then
  echo "## Project Context (auto-loaded)"
  echo ""
  cat "$CONTEXT_FILE"
else
  echo "## Project Context"
  echo ""
  echo "No project-context.md found. Run \`meow:project-context generate\` to create one."
  echo "This file helps all agents understand your project's tech stack, conventions, and anti-patterns."
fi
