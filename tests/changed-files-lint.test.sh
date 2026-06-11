#!/usr/bin/env bash
# changed-files-lint.test.sh — tests scripts/lib/changed-files.sh + the brand-prose
# diff-mode severity split in .claude/scripts/lint-brand-prose.sh.
#
# Builds throwaway git repos in mktemp dirs, each with a minimal .claude tree and a
# copy of the real lint scripts, then asserts:
#   1. base_ref_env        — LINT_BASE_REF wins
#   2. no_base_rc2          — no env, no GITHUB_BASE_REF → resolve_base_ref rc=2, no output
#   3. changed_violation    — violation in a CHANGED file → exit 1
#   4. legacy_violation     — violation only in an UNCHANGED file → exit 0 + WARN
#   5. no_base_local_warn   — diff mode, no base, local → exit 0 (warn-only)
#   6. no_base_ci_error     — diff mode, no base, GITHUB_ACTIONS=true → exit 1

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/scripts/lib/changed-files.sh"
LINT="$ROOT/.claude/scripts/lint-brand-prose.sh"
HELPER="$ROOT/.claude/scripts/check-anthropic-context.py"

PASS=0
FAIL=0
FAILED_NAMES=()
assert() {
  local name="$1" cond="$2"
  if [ "$cond" = "1" ]; then PASS=$((PASS+1)); printf "  ok   %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); printf "  FAIL %s\n" "$name"; fi
}

# Stage a throwaway git repo that mirrors the real script layout so the lint script's
# relative source path (../../scripts/lib/changed-files.sh) resolves.
stage_repo() {
  local d="$1"
  mkdir -p "$d/.claude/scripts" "$d/scripts/lib"
  cp "$LIB" "$d/scripts/lib/changed-files.sh"
  cp "$LINT" "$d/.claude/scripts/lint-brand-prose.sh"
  cp "$HELPER" "$d/.claude/scripts/check-anthropic-context.py"
  : > "$d/.claude/.brand-allowlist.txt"
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t \
      && git add -A && git commit -qm init )
}

[ -f "$LIB" ] || { echo "FATAL: $LIB not found"; exit 1; }
[ -f "$LINT" ] || { echo "FATAL: $LINT not found"; exit 1; }

# ---- Case 1: LINT_BASE_REF env wins ----
OUT=$( . "$LIB"; LINT_BASE_REF="deadbeef" resolve_base_ref )
[ "$OUT" = "deadbeef" ] && assert "resolve_base_ref honors LINT_BASE_REF" 1 || assert "resolve_base_ref honors LINT_BASE_REF" 0

# ---- Case 2: no base resolvable → rc=2, no output ----
OUT=$( . "$LIB"; unset LINT_BASE_REF GITHUB_BASE_REF 2>/dev/null; resolve_base_ref; echo "rc=$?" )
{ echo "$OUT" | grep -q "rc=2" && [ "$(echo "$OUT" | grep -v rc=)" = "" ]; } \
  && assert "resolve_base_ref returns rc=2 with no output when no base" 1 \
  || assert "resolve_base_ref returns rc=2 with no output when no base" 0

# ---- Case 3: violation introduced in a CHANGED file → exit 1 ----
D="$(mktemp -d)"; stage_repo "$D"
( cd "$D" && printf '# Doc\n\nMeowKit is a toolkit.\n' > .claude/newdoc.md && git add -A && git commit -qm "add doc with violation" )
( cd "$D" && LINT_MODE=diff LINT_BASE_REF=HEAD~1 bash .claude/scripts/lint-brand-prose.sh >/dev/null 2>&1 ); RC=$?
[ "$RC" = "1" ] && assert "violation in changed file → exit 1" 1 || assert "violation in changed file → exit 1" 0
rm -rf "$D"

# ---- Case 4: legacy violation only in UNCHANGED file → exit 0 + WARN ----
D="$(mktemp -d)"; stage_repo "$D"
# Commit a violation first (becomes legacy), then make an unrelated clean change.
( cd "$D" && printf '# Legacy\n\nMeowKit is a toolkit.\n' > .claude/legacy.md && git add -A && git commit -qm "legacy violation" )
( cd "$D" && printf '# Clean\n\nNothing to see.\n' > .claude/clean.md && git add -A && git commit -qm "clean change" )
OUT=$( cd "$D" && LINT_MODE=diff LINT_BASE_REF=HEAD~1 bash .claude/scripts/lint-brand-prose.sh 2>&1 ); RC=$?
{ [ "$RC" = "0" ] && echo "$OUT" | grep -qi "legacy"; } \
  && assert "legacy-only violation → exit 0 + WARN" 1 || assert "legacy-only violation → exit 0 + WARN" 0
rm -rf "$D"

# ---- Case 5: diff mode, no base, local → exit 0 (warn-only) ----
D="$(mktemp -d)"; stage_repo "$D"
( cd "$D" && env -u LINT_BASE_REF -u GITHUB_BASE_REF -u GITHUB_ACTIONS LINT_MODE=diff bash .claude/scripts/lint-brand-prose.sh >/dev/null 2>&1 ); RC=$?
[ "$RC" = "0" ] && assert "diff mode, no base, local → exit 0" 1 || assert "diff mode, no base, local → exit 0" 0
rm -rf "$D"

# ---- Case 6: diff mode, no base, CI env → exit 1 ----
D="$(mktemp -d)"; stage_repo "$D"
( cd "$D" && env -u LINT_BASE_REF -u GITHUB_BASE_REF LINT_MODE=diff GITHUB_ACTIONS=true bash .claude/scripts/lint-brand-prose.sh >/dev/null 2>&1 ); RC=$?
[ "$RC" = "1" ] && assert "diff mode, no base, CI env → exit 1" 1 || assert "diff mode, no base, CI env → exit 1" 0
rm -rf "$D"

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"; for n in "${FAILED_NAMES[@]}"; do echo "  - $n"; done
  exit 1
fi
exit 0
