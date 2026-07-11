#!/bin/bash
# Capability-Resolution Bootstrap Hook
# SessionStart: emit the always-visible capability-resolution guidance into agent context.
#
# The text is a committed, human-approved constant generated from the CLI
# (`mewkit capabilities bootstrap --write`); this hook just cats it — no CLI
# spawn, no runtime dependency. A drift test keeps the file in sync with the source.
# Silent (exit 0, no output) when the file is absent, so a partial install never errors.

# Resolve the bootstrap file relative to THIS hook, not a fixed .claude/ path: the hook and
# the file are siblings (hooks/capability-bootstrap.sh ← → capability-bootstrap.md one level
# up). This works both in a flat-copy install (.claude/) and in the generated plugin payload
# (plugin/), where the tree is rooted differently. Silent (exit 0) if the file is absent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)" || exit 0
BOOTSTRAP_FILE="$SCRIPT_DIR/../capability-bootstrap.md"
if [ -f "$BOOTSTRAP_FILE" ]; then
  cat "$BOOTSTRAP_FILE"
  echo ""
fi
exit 0
