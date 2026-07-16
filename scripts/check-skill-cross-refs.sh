#!/bin/bash
# check-skill-cross-refs.sh — exits non-zero if a skill or local entrypoint reference fails to resolve.
# Resolves mk:* references to a skill or command, and explicit local references/
# scripts/ paths relative to the SKILL.md or step file that names them.
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
#   - Deprecated aliases per meowkit-architecture.md (debug, shipping, documentation)
#   - Documentation placeholders that are NOT real routing targets:
#     * command       — generic syntax placeholder in commands/mk/mk.md printf
#     * my-feature    — example skill name in mk:skill-creator CLI usage docs
#     * research      — illustrative skill name in mk:web-to-markdown composition examples
#     * evil-skill    — fictional name in mk:web-to-markdown security warning examples
ALLOWLIST="debug shipping documentation command my-feature research evil-skill figma-code-connect figma-library figma-write"

PHANTOM=0
while read -r ref; do
  [ -z "$ref" ] && continue
  name="${ref#mk:}"

  # Skip allowlisted deprecated aliases
  case " $ALLOWLIST " in *" $name "*) continue ;; esac

  # Skip partial regex captures from wildcard/placeholder families such as mk:jira-* or mk:jira-{leaf}.
  case "$name" in *-) continue ;; esac

  # Skip if resolves as skill OR command. Skills whose folder keeps the canonical
  # mk: prefix resolve as mk-<name> directories.
  if echo "$SKILLS" | grep -qx "$name"; then continue; fi
  if echo "$SKILLS" | grep -qx "mk-$name"; then continue; fi
  if echo "$COMMANDS" | grep -qx "$name"; then continue; fi

  echo "PHANTOM: mk:$name (no skill dir, no command file)" >&2
  PHANTOM=1
done < <(
  find .claude/commands .claude/skills \
    \( -path '*/.*' -o -path '*/.venv/*' -o -path '*/node_modules/*' \) -prune -o \
    -type f \( -name '*.md' -o -name '*.json' \) -print0 \
    | xargs -0 grep -hoE 'mk:[a-z][a-z0-9-]*-?\*?' 2>/dev/null \
    | grep -v '\*$' \
    | sort -u
)

# Entrypoints intentionally lazy-load local references. Validate those paths here
# so a moved manual or executable cannot become an invisible broken route. This
# deliberately scans only SKILL.md and step files: references may mention examples
# or external paths without making them an entrypoint contract.
while IFS= read -r file; do
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    case "$ref" in
      .claude/*) target="$ref" ;;
      *) target="$(dirname "$file")/$ref" ;;
    esac
    if [ ! -e "$target" ]; then
      echo "BROKEN_LOCAL_REF: $file -> $ref" >&2
      PHANTOM=1
    fi
  done < <(
    perl -ne 'while (/(?:^|[\s`(])((?:\.{1,2}\/)?(?:[A-Za-z0-9._-]+\/)*(?:references|scripts)\/[A-Za-z0-9._\/-]+)/g) { $ref = $1; $ref =~ s/[.,;:]$//; print "$ref\n" }' "$file"
  )
done < <(
  find .claude/skills \
    \( -path '*/.*' -o -path '*/.venv/*' -o -path '*/node_modules/*' \) -prune -o \
    -type f \( -name 'SKILL.md' -o -name 'step-*.md' \) -print
)

if [ "$PHANTOM" -eq 0 ]; then
  echo "OK: all skill and local entrypoint refs resolve"
  exit 0
fi
exit 1
