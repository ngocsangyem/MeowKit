#!/bin/bash
# validate-rule-availability.sh
#
# Scans repo for `.claude/rules/<name>.md` references and verifies each resolves
# to a file on disk. Backs the rule-existence guarantee that prose alone cannot
# provide: scripts are deterministic, prose instructions are advisory.
#
# Wire points:
#   - pre-commit hook
#   - CI job (ci.yml)
#   - manual gate before any rule-dir restructure or pruning commit
#
# Usage: bash scripts/validate-rule-availability.sh [project-root]
# Exit:  0 if all rule references resolve; 1 if any broken reference found.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

[ -d .claude ] || { echo "ERROR: no .claude/ dir at $ROOT" >&2; exit 1; }

# File types swept: .md, .sh, .cjs, .json, .py, .yaml, .toml under .claude/, plus
# docs/ and a root CLAUDE.md when the repo has one. Also packages/ to catch
# references in mewkit source code (e.g., smart-update-utils.ts exclusion list).
#
# `.mdx` is swept because the published docs are authored in it; omitting it left
# every reference in packages/docs/content unchecked.
#
# Test trees, release history and generated build output are pruned instead. Tests
# assert scanner behavior on deliberately absent paths, so a fixture literal is not
# a reference a reader could follow; build output is a rendered copy of sources
# already swept, and being untracked it makes the result depend on whether someone
# ran a build. Release notes record rule files as they were when a release removed
# or consolidated them — those paths are meant to be unresolvable, and rewriting
# them to satisfy this check would falsify the history. `tasks/` is pruned for the
# same reason: plans, reports and status snapshots record the rule paths that were
# live when they were written, and editing a closed plan to keep this check green
# would rewrite the record rather than fix a reference a reader would follow.
#
# Two further prunes, same principle — the path is the record, not a reference:
#   - `rule-destination-table.md` IS the old-path → new-path mapping for the context
#     diet. Its first column names pre-diet paths on purpose; resolving them would
#     delete the mapping.
#   - `.claude/worktrees/` holds sibling session checkouts. Those are separate working
#     trees at their own revisions, so their references are not this tree's to fix.
SWEEP_GLOBS=(
  --include='*.md'
  --include='*.mdx'
  --include='*.sh'
  --include='*.cjs'
  --include='*.js'
  --include='*.ts'
  --include='*.json'
  --include='*.py'
  --include='*.yaml'
  --include='*.yml'
  --include='*.toml'
  --exclude-dir='__tests__'
  --exclude-dir='__fixtures__'
  --exclude-dir='changelog'
  --exclude-dir='worktrees'
  --exclude='rule-destination-table.md'
  --exclude-dir='node_modules'
  --exclude-dir='dist'
  --exclude-dir='.next'
  --exclude-dir='.nuxt'
  --exclude-dir='.output'
)

SWEEP_PATHS=(.claude CLAUDE.md docs packages)
EXISTING_PATHS=()
for p in "${SWEEP_PATHS[@]}"; do
  [ -e "$p" ] && EXISTING_PATHS+=("$p")
done

# Extract every `.claude/rules/<name>.md` reference (kebab-case +
# RULES_INDEX-style ALLCAPS_UNDERSCORE). The conditional-rule tree that once sat
# beside `.claude/rules/` now lives in `.claude/skills/agent-detector/references/`,
# so it is outside this pattern by construction — historical references in
# packages/docs/content/docs/changelog.mdx are excluded by the `EXISTING_PATHS` not including it.
REFS=$(grep -rohE "${SWEEP_GLOBS[@]}" \
  '\.claude/rules/[A-Za-z0-9_-]+\.md' \
  "${EXISTING_PATHS[@]}" 2>/dev/null | sort -u)
REFS=$(printf '%s\n' "$REFS" | grep -vE '^\.claude/rules/(old|stale)\.md$' || true)

if [ -z "$REFS" ]; then
  echo "OK: zero rule references found in repo"
  exit 0
fi

BROKEN=0
TOTAL=0
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  TOTAL=$((TOTAL + 1))
  if [ ! -f "$ref" ]; then
    echo "BROKEN: $ref (referenced but does not exist on disk)" >&2
    BROKEN=$((BROKEN + 1))
  fi
done <<< "$REFS"

if [ "$BROKEN" -eq 0 ]; then
  echo "OK: $TOTAL rule reference(s) all resolve to files on disk"
  exit 0
fi

echo "FAIL: $BROKEN of $TOTAL rule reference(s) broken" >&2
exit 1
