#!/bin/bash
# Brand-prose lint for the toolkit .claude/ markdown source tree.
# Delegates all checks to check-anthropic-context.py because path-glob allowlist
# matching needs PurePosixPath semantics that bash + grep --exclude can't model.
#
# Modes (LINT_MODE env var):
#   full (default) — scan the whole .claude/ tree; ANY violation → exit 1.
#                    Passes ONLY the positional args ($ROOT $ALLOWLIST) to the
#                    helper — never --files. This is the original behavior.
#   diff           — scope severity by changed files vs a base ref:
#                      • violation in a CHANGED file        → exit 1
#                      • violation only in UNCHANGED (legacy) files → WARN, exit 0
#                      • no base ref resolvable, locally    → warn-only, exit 0
#                      • no base ref resolvable, in CI      → ERROR, exit 1
#
# Base ref for diff mode comes from scripts/lib/changed-files.sh. Local default:
# export LINT_BASE_REF=HEAD~1 (or any ref) before running in diff mode.
#
# Exit 0 = clean (or legacy-only/local-fallback warn). Exit 1 = violations / CI error.
# Exit 2 = misconfigured. Run from the meowkit/ working directory.

set -euo pipefail

ROOT=".claude"
ALLOWLIST=".claude/.brand-allowlist.txt"
PY_HELPER=".claude/scripts/check-anthropic-context.py"
LINT_MODE="${LINT_MODE:-full}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANGED_LIB="$SCRIPT_DIR/../../scripts/lib/changed-files.sh"

if [ ! -d "$ROOT" ]; then
  echo "lint-brand-prose: $ROOT not found (run from meowkit/ working directory)" >&2
  exit 2
fi
if [ ! -f "$PY_HELPER" ]; then
  echo "lint-brand-prose: $PY_HELPER missing" >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "lint-brand-prose: python3 required but not on PATH" >&2
  exit 2
fi

validate_allowlist() {
  [ -f "$ALLOWLIST" ] || {
    echo "lint-brand-prose: $ALLOWLIST is required." >&2
    return 1
  }

  local line number=0 pattern
  while IFS= read -r line || [ -n "$line" ]; do
    number=$((number + 1))
    [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ ! "$line" =~ ^\.claude/.+[[:space:]]+\#[[:space:]]+.+$ ]]; then
      echo "lint-brand-prose: invalid allowlist entry at $ALLOWLIST:$number; use '.claude/path.md # reason'." >&2
      return 1
    fi
    pattern="${line%%[[:space:]]#*}"
    if [[ "$pattern" == *"*"* || "$pattern" == *"?"* || "$pattern" == *"["* ]]; then
      echo "lint-brand-prose: allowlist entry at $ALLOWLIST:$number must be an exact full path, not a glob." >&2
      return 1
    fi
  done < "$ALLOWLIST"
}

validate_allowlist

run_full() {
  # Original behavior — positional args only, never --files.
  local hits
  hits=$(python3 "$PY_HELPER" "$ROOT" "$ALLOWLIST")
  if [ -n "$hits" ]; then
    echo "Brand-prose violations:"
    echo "$hits"
    echo ""
    echo "See the kit's branding style guide for replacement rules (the patterns this linter rejects are intentionally banned)."
    echo "Or add the file to $ALLOWLIST if it is toolkit-internal navigation."
    return 1
  fi
  echo "lint-brand-prose: clean."
  return 0
}

if [ "$LINT_MODE" = "full" ]; then
  run_full
  exit $?
fi

# ---- diff mode ----
if [ ! -f "$CHANGED_LIB" ]; then
  echo "lint-brand-prose: $CHANGED_LIB missing (needed for diff mode)" >&2
  exit 2
fi
# shellcheck source=/dev/null
. "$CHANGED_LIB"

if ! BASE="$(resolve_base_ref)"; then
  # No base ref. CI should always have one after fetch-depth:0 — treat a missing
  # base in CI as an infrastructure error so the gate is never silently disabled.
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "lint-brand-prose: LINT_MODE=diff but no base ref resolvable in CI." >&2
    echo "  Ensure checkout uses fetch-depth: 0 and export LINT_BASE_REF (or set GITHUB_BASE_REF)." >&2
    exit 1
  fi
  echo "::warning:: lint-brand-prose: no base ref resolvable; running full-tree warn-only (local fallback)." >&2
  echo "  Set LINT_BASE_REF=HEAD~1 (or another ref) to enable diff severity locally." >&2
  if run_full; then
    exit 0
  fi
  echo "" >&2
  echo "::warning:: lint-brand-prose: violations above are warn-only in the no-base local fallback." >&2
  exit 0
fi

# Base ref available — compute changed .claude markdown files.
CHANGED_MD=$(changed_files "$ROOT" | grep -E '\.md$' || true)

CHANGED_HITS=""
if [ -n "$CHANGED_MD" ]; then
  # Word-split is intentional: --files takes a list of paths. Safe because paths under
  # .claude/ are enforced kebab-case (no spaces) — see development-rules.md file naming.
  # shellcheck disable=SC2086
  CHANGED_HITS=$(python3 "$PY_HELPER" "$ROOT" "$ALLOWLIST" --files $CHANGED_MD)
fi

if [ -n "$CHANGED_HITS" ]; then
  echo "Brand-prose violations in CHANGED files (base: $BASE):"
  echo "$CHANGED_HITS"
  echo ""
  echo "Fix these before merge — they are in files this branch changed."
  exit 1
fi

# No violations in changed files — surface any legacy violations as a WARN only.
LEGACY_HITS=$(python3 "$PY_HELPER" "$ROOT" "$ALLOWLIST")
if [ -n "$LEGACY_HITS" ]; then
  echo "::warning:: lint-brand-prose: pre-existing (legacy) brand-prose violations in unchanged files:"
  echo "$LEGACY_HITS"
  echo ""
  echo "These are WARN-only (not in this branch's changed files). Clean them up opportunistically."
  exit 0
fi

echo "lint-brand-prose: clean (diff mode, base: $BASE)."
exit 0
