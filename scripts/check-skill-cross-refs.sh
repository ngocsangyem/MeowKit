#!/bin/bash
# check-skill-cross-refs.sh — exits non-zero if any meow:* reference fails to resolve.
# Resolves to either an existing skill at .claude/skills/meow:<name>/ OR a command at
# .claude/commands/meow/<name>.md, per CLAUDE.md "Commands vs Skills" semantics.
#
# Usage: bash scripts/check-skill-cross-refs.sh [project-root]
# Exit:  0 if clean; 1 if any phantom ref found.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

[ -d .claude/skills ] || { echo "No .claude/skills dir at $ROOT" >&2; exit 1; }

# Build authoritative inventories
SKILLS=$(ls .claude/skills/ 2>/dev/null | grep '^meow:' | sort -u)
COMMANDS=$(ls .claude/commands/meow/ 2>/dev/null | sed -n 's/\.md$//p' | sort -u)

# Allowlist:
#   - Deprecated aliases per meowkit-architecture.md §3 (debug, shipping, documentation)
#   - Documentation placeholders that are NOT real routing targets:
#     * command       — generic syntax placeholder in commands/meow/meow.md printf
#     * my-feature    — example skill name in meow:skill-creator CLI usage docs
#     * research      — illustrative skill name in meow:web-to-markdown composition examples
#     * evil-skill    — fictional name in meow:web-to-markdown security warning examples
ALLOWLIST="debug shipping documentation command my-feature research evil-skill"

PHANTOM=0
while read -r ref; do
  [ -z "$ref" ] && continue
  name="${ref#meow:}"

  # Skip allowlisted deprecated aliases
  case " $ALLOWLIST " in *" $name "*) continue ;; esac

  # Skip if resolves as skill OR command
  if echo "$SKILLS" | grep -qx "meow:$name"; then continue; fi
  if echo "$COMMANDS" | grep -qx "$name"; then continue; fi

  echo "PHANTOM: meow:$name (no skill dir, no command file)" >&2
  PHANTOM=1
done < <(grep -rohE --include='*.md' --include='*.json' 'meow:[a-z][a-z0-9-]*' .claude/commands/ .claude/skills/ 2>/dev/null | sort -u)

if [ "$PHANTOM" -eq 0 ]; then
  echo "OK: all meow:* refs resolve"
  exit 0
fi
exit 1
