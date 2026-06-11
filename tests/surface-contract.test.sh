#!/usr/bin/env bash
# surface-contract.test.sh — asserts three orchestration-surface invariants against the
# REAL repo tree, plus self-check cases proving each invariant fails when violated.
#
# Invariants:
#   1. settings.json SubagentStart/SubagentStop arrays stay EMPTY. Registering a hook
#      there is a documented REJECTED pattern (orchestration-rules.md → Rejected
#      Patterns): hooks fire inside subagents → infinite loop. Absent key and empty
#      array both satisfy the invariant (jq `// []` null-safe semantics).
#   2. The five truly-retired rule files never reappear in .claude/rules/.
#   3. No team-coordination rule file appears in always-loaded .claude/rules/ (or
#      rules-conditional/) — team coordination is skill-local (mk:team-config).
#
# Usage: bash tests/surface-contract.test.sh [repo-root]   (default: $(pwd))

set -u

# Provenance: these names were deleted and never re-added (git log --diff-filter=D),
# verified at commits a549dac and 69b7bd3. Several OTHER rule deletions were later
# re-added, so they are intentionally NOT listed here (asserting on them would
# false-fail). If a future plan legitimately revives one of these names, this array
# is the single edit point.
RETIRED_RULES=(RULES_INDEX.md context-ordering-rules.md naming-rules.md output-format-rules.md search-before-building-rules.md)

PASS=0
FAIL=0
FAILED_NAMES=()
assert() {
  local name="$1" cond="$2"
  if [ "$cond" = "1" ]; then PASS=$((PASS+1)); printf "  ok   %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); printf "  FAIL %s\n" "$name"; fi
}

# Null-safe array length of a hooks key (jq `// []` semantics; python fallback).
hook_array_len() {
  local file="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    jq -r "(.hooks.${key} // []) | length" "$file" 2>/dev/null
  else
    python3 - "$file" "$key" <<'PY' 2>/dev/null
import json, sys
d = json.load(open(sys.argv[1]))
v = (d.get("hooks") or {}).get(sys.argv[2])
print(len(v) if isinstance(v, list) else 0)
PY
  fi
}

# Returns 0 if all invariants hold for the given root; prints failures to stderr.
check_invariants() {
  local root="$1"
  local settings="$root/.claude/settings.json"
  local rules="$root/.claude/rules"
  local rulescond="$root/.claude/rules-conditional"
  local fails=0

  # Invariant 1
  if [ -f "$settings" ]; then
    local ss st
    ss="$(hook_array_len "$settings" SubagentStart)"; ss="${ss:-0}"
    st="$(hook_array_len "$settings" SubagentStop)"; st="${st:-0}"
    if [ "$ss" != "0" ] || [ "$st" != "0" ]; then
      echo "FAIL: SubagentStart/SubagentStop must stay empty (got start=$ss stop=$st)." >&2
      echo "      REJECTED pattern (orchestration-rules.md): hooks fire inside subagents → infinite loop." >&2
      fails=$((fails+1))
    fi
  else
    echo "FAIL: settings.json not found at $settings" >&2
    fails=$((fails+1))
  fi

  # Invariant 2
  for r in "${RETIRED_RULES[@]}"; do
    if [ -f "$rules/$r" ]; then
      echo "FAIL: retired rule reappeared: rules/$r (provenance a549dac, 69b7bd3)." >&2
      fails=$((fails+1))
    fi
  done

  # Invariant 3
  local dir
  for dir in "$rules" "$rulescond"; do
    if [ -d "$dir" ] && find "$dir" -maxdepth 1 -name 'team-coordination*' 2>/dev/null | grep -q .; then
      echo "FAIL: team-coordination* file in $dir — team rules must be skill-local (mk:team-config), not always-loaded." >&2
      fails=$((fails+1))
    fi
  done

  return "$fails"
}

# Build a minimal clean tree (empty Subagent arrays, empty rules dir) for self-checks.
make_clean_tree() {
  local d="$1"
  mkdir -p "$d/.claude/rules" "$d/.claude/rules-conditional"
  cat > "$d/.claude/settings.json" <<'JSON'
{ "hooks": { "SubagentStart": [], "SubagentStop": [] } }
JSON
}

ROOT="${1:-$(pwd)}"

# ---- Real repo: all invariants must hold ----
if check_invariants "$ROOT"; then assert "real repo satisfies all surface invariants" 1; else assert "real repo satisfies all surface invariants" 0; fi

# ---- Self-check 1: populated SubagentStart fails ----
D="$(mktemp -d)"; make_clean_tree "$D"
cat > "$D/.claude/settings.json" <<'JSON'
{ "hooks": { "SubagentStart": [ { "hooks": [ { "type": "command", "command": "echo x" } ] } ], "SubagentStop": [] } }
JSON
check_invariants "$D" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && assert "populated SubagentStart → fails" 1 || assert "populated SubagentStart → fails" 0
rm -rf "$D"

# ---- Self-check 2: reappeared retired rule fails ----
D="$(mktemp -d)"; make_clean_tree "$D"
: > "$D/.claude/rules/naming-rules.md"
check_invariants "$D" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && assert "reappeared naming-rules.md → fails" 1 || assert "reappeared naming-rules.md → fails" 0
rm -rf "$D"

# ---- Self-check 3: team-coordination rule in always-loaded rules fails ----
D="$(mktemp -d)"; make_clean_tree "$D"
: > "$D/.claude/rules/team-coordination-rules.md"
check_invariants "$D" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && assert "team-coordination-rules.md in rules/ → fails" 1 || assert "team-coordination-rules.md in rules/ → fails" 0
rm -rf "$D"

# ---- Self-check 4: a clean synthetic tree passes ----
D="$(mktemp -d)"; make_clean_tree "$D"
check_invariants "$D" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && assert "clean synthetic tree passes" 1 || assert "clean synthetic tree passes" 0
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
