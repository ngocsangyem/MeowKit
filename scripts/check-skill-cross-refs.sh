#!/bin/bash
# check-skill-cross-refs.sh — exits non-zero if any mk:* reference fails to resolve.
# Resolves to either an existing skill at .claude/skills/<name>/ OR a command at
# .claude/commands/mk/<name>.md, per CLAUDE.md "Commands vs Skills" semantics.
#
# Usage: bash scripts/check-skill-cross-refs.sh [project-root]
# Exit:  0 if clean; 1 if any phantom ref found.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

[ -d .claude/skills ] || { echo "No .claude/skills dir at $ROOT" >&2; exit 1; }

# Build authoritative inventories — bare-name folders only, ignore dotfiles + non-skill files
SKILLS=$(ls .claude/skills/ 2>/dev/null | grep -v '^\.' | grep -v 'SKILLS_ATTRIBUTION' | sort -u)
COMMANDS=$(ls .claude/commands/mk/ 2>/dev/null | sed -n 's/\.md$//p' | sort -u)

# Zero-match guard: an empty inventory must not phantom-pass.
if [ -z "$SKILLS" ]; then
  echo "ERROR: empty skill inventory under .claude/skills/" >&2
  exit 1
fi

# Allowlist:
#   - Deprecated aliases per meowkit-architecture.md §3 (debug, shipping, documentation)
#   - Documentation placeholders that are NOT real routing targets:
#     * command       — generic syntax placeholder in commands/mk/mk.md printf
#     * my-feature    — example skill name in mk:skill-creator CLI usage docs
#     * research      — illustrative skill name in mk:web-to-markdown composition examples
#     * evil-skill    — fictional name in mk:web-to-markdown security warning examples
ALLOWLIST="debug shipping documentation command my-feature research evil-skill"

PHANTOM=0
while read -r ref; do
  [ -z "$ref" ] && continue
  name="${ref#mk:}"

  # Skip allowlisted deprecated aliases
  case " $ALLOWLIST " in *" $name "*) continue ;; esac

  # Skip if resolves as skill OR command
  if echo "$SKILLS" | grep -qx "$name"; then continue; fi
  if echo "$COMMANDS" | grep -qx "$name"; then continue; fi

  echo "PHANTOM: mk:$name (no skill dir, no command file)" >&2
  PHANTOM=1
done < <(grep -rohE --include='*.md' --include='*.json' 'mk:[a-z][a-z0-9-]*' .claude/commands/ .claude/skills/ 2>/dev/null | sort -u)

if [ "$PHANTOM" -eq 0 ]; then
  echo "OK: all mk:* refs resolve"
  exit 0
fi
exit 1
