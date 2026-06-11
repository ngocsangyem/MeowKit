#!/usr/bin/env bash
# check-hook-registration.test.sh — unit test for scripts/check-hook-registration.sh
#
# Builds fabricated .claude trees (settings.json + hooks/ + handlers.json) in temp
# dirs and asserts the three drift classes plus the clean and allowlist cases:
#   1. clean              — disk + settings + handlers all consistent → exit 0
#   2. unregistered_disk  — a disk hook absent from settings.json → exit 1 UNREGISTERED
#   3. missing_on_disk     — a registered hook with no file → exit 1 MISSING-ON-DISK
#   4. missing_handler     — handlers.json entry with no file → exit 1 MISSING-HANDLER
#   5. allowlisted_indirect — indirect-call hook on disk only → exit 0
#
# Each case runs the real script against an isolated temp root.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/check-hook-registration.sh"

PASS=0
FAIL=0
FAILED_NAMES=()

assert() {
  local name="$1" cond="$2"
  if [ "$cond" = "1" ]; then
    PASS=$((PASS + 1))
    printf "  ok   %s\n" "$name"
  else
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("$name")
    printf "  FAIL %s\n" "$name"
  fi
}

# Build a base tree with one registered .sh hook + a handlers.json using the REAL
# ./handlers/ relative path form (anchored at .claude/hooks/, as dispatch.cjs expects).
make_tree() {
  local dir="$1"
  mkdir -p "$dir/.claude/hooks/handlers"
  cat > "$dir/.claude/settings.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "bash .claude/hooks/session-start.sh" } ] }
    ]
  }
}
JSON
  printf '#!/bin/bash\nexit 0\n' > "$dir/.claude/hooks/session-start.sh"
  chmod +x "$dir/.claude/hooks/session-start.sh"
  printf '#!/usr/bin/env node\n' > "$dir/.claude/hooks/dispatch.cjs"
  printf 'module.exports={};\n' > "$dir/.claude/hooks/handlers/build-verify.cjs"
  cat > "$dir/.claude/hooks/handlers.json" <<'JSON'
{
  "PostToolUse": { "Edit|Write": [ "./handlers/build-verify.cjs" ] }
}
JSON
  # dispatch.cjs is registered so it is not "unregistered"
  cat > "$dir/.claude/settings.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "bash .claude/hooks/session-start.sh" } ] }
    ],
    "PostToolUse": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/dispatch.cjs" } ] }
    ]
  }
}
JSON
}

run() { bash "$SCRIPT" "$1" >/dev/null 2>&1; echo $?; }
run_out() { bash "$SCRIPT" "$1" 2>&1; }

[ -f "$SCRIPT" ] || { echo "FATAL: $SCRIPT not found"; exit 1; }

# ---- Case 1: clean tree ----
D="$(mktemp -d)"; make_tree "$D"
[ "$(run "$D")" = "0" ] && assert "clean tree exits 0" 1 || assert "clean tree exits 0" 0
rm -rf "$D"

# ---- Case 2: unregistered disk hook ----
D="$(mktemp -d)"; make_tree "$D"
printf '#!/bin/bash\nexit 0\n' > "$D/.claude/hooks/rogue.sh"; chmod +x "$D/.claude/hooks/rogue.sh"
OUT="$(run_out "$D")"; RC=$?
{ [ "$RC" != "0" ] && echo "$OUT" | grep -q "UNREGISTERED:"; } && assert "unregistered disk hook → UNREGISTERED exit 1" 1 || assert "unregistered disk hook → UNREGISTERED exit 1" 0
rm -rf "$D"

# ---- Case 3: registered hook missing on disk ----
D="$(mktemp -d)"; make_tree "$D"
rm "$D/.claude/hooks/session-start.sh"
OUT="$(run_out "$D")"; RC=$?
{ [ "$RC" != "0" ] && echo "$OUT" | grep -q "MISSING-ON-DISK:"; } && assert "registered hook missing on disk → MISSING-ON-DISK exit 1" 1 || assert "registered hook missing on disk → MISSING-ON-DISK exit 1" 0
rm -rf "$D"

# ---- Case 4: handlers.json entry missing on disk ----
D="$(mktemp -d)"; make_tree "$D"
rm "$D/.claude/hooks/handlers/build-verify.cjs"
OUT="$(run_out "$D")"; RC=$?
{ [ "$RC" != "0" ] && echo "$OUT" | grep -q "MISSING-HANDLER:"; } && assert "handlers.json entry missing on disk → MISSING-HANDLER exit 1" 1 || assert "handlers.json entry missing on disk → MISSING-HANDLER exit 1" 0
rm -rf "$D"

# ---- Case 5: allowlisted indirect hook on disk only ----
D="$(mktemp -d)"; make_tree "$D"
printf '#!/bin/bash\nexit 0\n' > "$D/.claude/hooks/append-trace.sh"; chmod +x "$D/.claude/hooks/append-trace.sh"
[ "$(run "$D")" = "0" ] && assert "allowlisted indirect hook (append-trace.sh) ignored → exit 0" 1 || assert "allowlisted indirect hook (append-trace.sh) ignored → exit 0" 0
rm -rf "$D"

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"
  for n in "${FAILED_NAMES[@]}"; do echo "  - $n"; done
  exit 1
fi
exit 0
