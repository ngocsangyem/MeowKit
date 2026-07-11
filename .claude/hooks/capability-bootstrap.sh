#!/bin/bash
# Capability-Resolution Bootstrap Hook
# SessionStart: emit the always-visible capability-resolution guidance into agent context.
#
# The text is a committed, human-approved constant generated from the CLI
# (`mewkit capabilities bootstrap --write`); this hook just cats it — no CLI
# spawn, no runtime dependency. A drift test keeps the file in sync with the source.
# Silent (exit 0, no output) when the file is absent, so a partial install never errors.

if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

BOOTSTRAP_FILE=".claude/capability-bootstrap.md"
if [ -f "$BOOTSTRAP_FILE" ]; then
  cat "$BOOTSTRAP_FILE"
  echo ""
fi
exit 0
