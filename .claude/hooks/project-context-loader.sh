#!/bin/bash
# MeowKit Project Context Loader Hook
# SessionStart: Auto-load docs/project-context.md into agent context.
# Supports Phase 5 (Project Context System).
#
# If docs/project-context.md exists, outputs its content for injection.
# If not, outputs a reminder to generate it.

CONTEXT_FILE="docs/project-context.md"

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
