#!/bin/bash
# validate-rule-availability.sh
#
# Scans repo for `.claude/rules/<name>.md` references and verifies each resolves
# to a file on disk. Backs the rule-existence guarantee that CLAUDE.md prose
# alone cannot provide (Anthropic best-practices.md: hooks/scripts deterministic,
# CLAUDE.md instructions advisory).
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
# top-level CLAUDE.md and docs/. Also packages/ to catch references in mewkit
# source code (e.g., smart-update-utils.ts exclusion list).
SWEEP_GLOBS=(
  --include='*.md'
  --include='*.sh'
  --include='*.cjs'
  --include='*.js'
  --include='*.ts'
  --include='*.json'
  --include='*.py'
  --include='*.yaml'
  --include='*.yml'
  --include='*.toml'
)

SWEEP_PATHS=(.claude CLAUDE.md docs packages tasks)
EXISTING_PATHS=()
for p in "${SWEEP_PATHS[@]}"; do
  [ -e "$p" ] && EXISTING_PATHS+=("$p")
done

# Extract every `.claude/rules/<name>.md` reference (kebab-case +
# RULES_INDEX-style ALLCAPS_UNDERSCORE). The legacy `.claude/rules-conditional/`
# tree was merged into `.claude/rules/` in v2.8.4 — historical references in
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
