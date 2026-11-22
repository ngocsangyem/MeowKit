#!/bin/bash
# check-skill-cross-refs.sh — exits non-zero if a skill or local entrypoint reference fails to resolve.
# Resolves mk:* references to a skill, and explicit local references/scripts/ paths
# relative to the SKILL.md or step file that names them. Skills are the kit's only
# routable surface, so a mk:* token resolves against the skill inventory or fails.
#
# Usage: bash scripts/check-skill-cross-refs.sh [project-root [installed-tree ...]]
# Exit:  0 if clean; 1 if any phantom ref found.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

[ -d .claude/skills ] || { echo "No .claude/skills dir at $ROOT" >&2; exit 1; }

# Build authoritative inventories — bare-name folders only, ignore dotfiles + non-skill files
SKILLS=$(ls .claude/skills/ 2>/dev/null | grep -v '^\.' | grep -v 'SKILLS_ATTRIBUTION' | sort -u)

# Zero-match guard: an empty inventory must not phantom-pass.
if [ -z "$SKILLS" ]; then
  echo "ERROR: empty skill inventory under .claude/skills/" >&2
  exit 1
fi

# Allowlist:
#   - Deprecated aliases per meowkit-architecture.md (debug, shipping, documentation)
#   - Documentation placeholders that are NOT real routing targets:
#     * my-feature    — example skill name in mk:skill-creator CLI usage docs
#     * research      — illustrative skill name in mk:web-to-markdown composition examples
#     * evil-skill    — fictional name in mk:web-to-markdown security warning examples
#     * my-skill      — example dir tree in the skill-authoring rules (progressive disclosure)
#     * my-workflow   — example dir tree in the skill-authoring rules (step-file decomposition)
ALLOWLIST="debug shipping documentation my-feature my-skill my-workflow research evil-skill figma-code-connect figma-library figma-write"

PHANTOM=0
while read -r ref; do
  [ -z "$ref" ] && continue
  name="${ref#mk:}"

  # Skip allowlisted deprecated aliases
  case " $ALLOWLIST " in *" $name "*) continue ;; esac

  # Skip partial regex captures from wildcard/placeholder families such as mk:jira-* or mk:jira-{leaf}.
  case "$name" in *-) continue ;; esac

  # Skills whose folder keeps the canonical mk: prefix resolve as mk-<name> dirs.
  if echo "$SKILLS" | grep -qx "$name"; then continue; fi
  if echo "$SKILLS" | grep -qx "mk-$name"; then continue; fi

  echo "PHANTOM: mk:$name (no skill dir)" >&2
  PHANTOM=1
done < <(
  find .claude/skills \
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

# Explicit `.claude/...` paths named by an entrypoint, an agent or a rule must exist, so a
# deleted or moved kit file cannot stay quoted as live. Files a user or a session creates at
# run time (MCP config, agent memory, product areas) are optional and exempt.
OPTIONAL_PATHS=".claude/mcp.json .claude/.mcp.json .meowkit/product-areas.yaml .claude/settings.local.json"
while IFS= read -r file; do
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    case " $OPTIONAL_PATHS " in *" $ref "*) continue ;; esac
    # `.claude/skills/foo/` is the placeholder in a "write here, not there" authoring example.
    case "$ref" in .claude/agent-memory/*|.claude/session-state/*|.claude/logs/*|.claude/cache/*|.claude/skills/foo/*) continue ;; esac
    if [ ! -e "$ref" ]; then
      echo "DEAD_PATH: $file -> $ref" >&2
      PHANTOM=1
    fi
  done < <(
    perl -ne 'while (/(?:^|[\s`("])(\.claude\/[A-Za-z0-9._\/-]+\.(?:md|cjs|sh|json|py|yaml))/g) { print "$1\n" }' "$file"
  )
done < <(
  find .claude/skills .claude/agents .claude/rules \
    \( -path '*/.*' -o -path '*/.venv/*' -o -path '*/node_modules/*' \) -prune -o \
    -type f \( -name 'SKILL.md' -o -name 'step-*.md' -o -path '*/references/*.md' -o -path '.claude/agents/*.md' -o -path '.claude/rules/*.md' \) -print 2>/dev/null
)

# An installed tree of another runtime names its own paths (`.agents/skills/mk-x/…`, `.codex/…`,
# `.cursor/…`, `.grok/…`, `.pi/…`, `.omp/…`; Antigravity writes under `.agents/` only). Each must exist in that tree: a path to a file the install does not write is
# a command that fails for the user. Exempt: files a user or a session creates at run time,
# the example path the authoring rules warn against, and the audit rules the text marks as
# kept in the kit's own repository.
# With no tree named, the kit source installs each runtime into a temp directory and checks that.
shift || true
if [ "$#" -gt 0 ]; then
  for tree in "$@"; do INSTALLED+=("$(basename "$tree")=$tree"); done
elif [ -d kit/overlays ] && [ -f scripts/lib/installed-tree.cjs ]; then
  for runtime in codex cursor grok pi omp antigravity; do
    tree=$(node scripts/lib/installed-tree.cjs "$runtime") || { echo "ERROR: no installed $runtime tree to check" >&2; exit 1; }
    INSTALLED+=("$runtime=$tree")
    BUILT+=("$tree")
  done
fi
for entry in ${INSTALLED[@]+"${INSTALLED[@]}"}; do
  label="${entry%%=*}"
  tree="${entry#*=}"
  while IFS=$'\t' read -r file ref; do
    [ -z "$ref" ] && continue
    case "$ref" in
      */cache/*|*/logs/*|*/agent-memory/*|*/state/*) continue ;;
      *mcp.json|*settings.local.json|*product-areas.yaml|*.env|*.env.example) continue ;;
      */skills/foo/*|*/SKILLS_ATTRIBUTION.md|*/benchmark/references/dead-weight-audit-rules.md) continue ;;
    esac
    if [ ! -e "$tree/$ref" ]; then
      echo "DEAD_PATH: installed $label: ${file#./} -> $ref" >&2
      PHANTOM=1
    fi
  done < <(
    cd "$tree" && find . \( -path '*/.venv/*' -o -path '*/node_modules/*' \) -prune -o \
      -type f \( -name '*.md' -o -name '*.mdc' -o -name '*.toml' \) -print0 \
      | xargs -0 perl -ne 'while (/(?:^|[\s`("\/])(\.(?:agents|codex|cursor|grok|pi|omp)\/[A-Za-z0-9._\/-]+\.(?:mdc|md|cjs|sh|json|py|yaml|toml))(?![A-Za-z0-9])/g) { print "$ARGV\t$1\n" }'
  )
done
for tree in ${BUILT[@]+"${BUILT[@]}"}; do rm -r "$tree"; done

if [ "$PHANTOM" -eq 0 ]; then
  echo "OK: all skill and local entrypoint refs resolve"
  exit 0
fi
exit 1
