#!/usr/bin/env bash
# resolve-model.test.sh — unit test for hooks/lib/resolve-model.sh
#
# Verifies the 5 resolution paths declared in resolve-model.sh:
#   1. happy_path     — detected-model.json with real model_id → returns id
#   2. missing_file   — file absent → falls back to env (MEOWKIT_MODEL_HINT)
#   3. malformed_json — bad JSON → grep fallback OR env fallback OR "unknown"
#   4. literal_unknown — JSON contains {"model_id":"unknown"} → fall through
#   5. env_hint       — file missing AND env hint set → returns hint
#
# Runs each case in an isolated temp CLAUDE_PROJECT_DIR with a clean env.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HELPER="$ROOT/.claude/hooks/lib/resolve-model.sh"

PASS=0
FAIL=0
FAILED_NAMES=()

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    printf "  ok   %s\n" "$name"
  else
    FAIL=$((FAIL+1))
    FAILED_NAMES+=("$name")
    printf "  FAIL %s\n      expected: %s\n      actual:   %s\n" "$name" "$expected" "$actual"
  fi
}

run_case() {
  # Args: case_name, json_content_or_empty, env_hint_or_empty
  # Returns: stdout of resolve_model in a clean subshell
  local _name="$1" _json="$2" _hint="$3"
  local tmpdir
  tmpdir="$(mktemp -d)"
  if [ -n "$_json" ]; then
    mkdir -p "$tmpdir/session-state"
    printf '%s' "$_json" > "$tmpdir/session-state/detected-model.json"
  fi
  (
    unset CLAUDE_MODEL ANTHROPIC_MODEL MEOWKIT_MODEL_HINT
    [ -n "$_hint" ] && export MEOWKIT_MODEL_HINT="$_hint"
    export CLAUDE_PROJECT_DIR="$tmpdir"
    # shellcheck disable=SC1090
    . "$HELPER"
    resolve_model
  ) 2>/dev/null
  rm -rf "$tmpdir"
}

[ -f "$HELPER" ] || { echo "FATAL: $HELPER not found"; exit 1; }

# ---------- Case 1: happy_path ----------
RESULT="$(run_case happy '{"model_id":"claude-sonnet-4-6","tier":"STANDARD","density":"FULL"}' '')"
assert_eq "happy_path — detected-model.json with claude-sonnet-4-6" "claude-sonnet-4-6" "$RESULT"

# ---------- Case 2: missing_file falls back to env hint ----------
RESULT="$(run_case missing '' 'opus-4-7')"
assert_eq "missing_file — env hint MEOWKIT_MODEL_HINT=opus-4-7" "opus-4-7" "$RESULT"

# ---------- Case 3: missing_file with no env → "unknown" ----------
RESULT="$(run_case missing_no_env '' '')"
assert_eq "missing_file + no env → unknown" "unknown" "$RESULT"

# ---------- Case 4: malformed JSON, no env → "unknown" (or grep salvage) ----------
RESULT="$(run_case malformed '{ this is not json' '')"
# grep fallback may extract nothing → env chain → "unknown"
assert_eq "malformed_json — no model_id field → unknown" "unknown" "$RESULT"

# ---------- Case 5: literal "unknown" in JSON falls through to env hint ----------
RESULT="$(run_case literal_unknown '{"model_id":"unknown"}' 'haiku-4-5')"
assert_eq "literal_unknown JSON + env hint → haiku-4-5" "haiku-4-5" "$RESULT"

# ---------- Case 6: env_hint_override when file present but value used as primary ----------
# (env hint should NOT override a valid file value — file is primary)
RESULT="$(run_case file_wins_over_env '{"model_id":"claude-sonnet-4-6"}' 'opus-4-7')"
assert_eq "file wins over env hint" "claude-sonnet-4-6" "$RESULT"

# ---------- Case 7: sanitization removes invalid chars ----------
RESULT="$(run_case sanitize '{"model_id":"claude;rm -rf /"}' '')"
# Sanitizer keeps [a-zA-Z0-9._-]; ";", " ", "/" stripped → "clauderm-rf"
EXPECTED_SANITIZED="clauderm-rf"
assert_eq "sanitizer strips shell metachars" "$EXPECTED_SANITIZED" "$RESULT"

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"
  for n in "${FAILED_NAMES[@]}"; do
    echo "  - $n"
  done
  exit 1
fi
exit 0
