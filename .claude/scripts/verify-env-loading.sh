#!/bin/sh
# verify-env-loading.sh — Full verification suite for MEOWKIT_ env var handling.
#
# Run from meowkit project root:
#   sh .claude/scripts/verify-env-loading.sh
#
# Covers: native env field, .env parser hardening, agent config output,
# inline comment handling, quoted value preservation, key validation,
# and dangerous key blocking.

set -u
PASS=0
FAIL=0
MEOWKIT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1 — $2"; }

make_tmp() {
  TMPDIR=$(mktemp -d)
  mkdir -p "$TMPDIR/.claude/hooks/lib"
  cp "$MEOWKIT_ROOT/.claude/hooks/lib/load-dotenv.sh" "$TMPDIR/.claude/hooks/lib/"
  echo "$TMPDIR"
}

echo ""
echo "═══ MeowKit Env Var Loading Verification ═══"
echo ""

# Test 1: Inline comment stripped from unquoted value
echo "Test 1: Inline comment stripped (unquoted)"
TMPDIR=$(make_tmp)
echo 'MEOWKIT_BUILD_VERIFY=off # disable in CI' > "$TMPDIR/.claude/.env"
RESULT=$(CLAUDE_PROJECT_DIR="$TMPDIR" sh -c '. "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/load-dotenv.sh" && echo "${MEOWKIT_BUILD_VERIFY}"')
[ "$RESULT" = "off" ] && pass "inline comment stripped" || fail "inline comment stripped" "got [$RESULT], expected [off]"
rm -rf "$TMPDIR"

# Test 2: Quoted value preserves # literally (H-4 regression)
echo "Test 2: Quoted # preserved (API key with hash)"
TMPDIR=$(make_tmp)
echo 'MEOWKIT_API_KEY="abc#123"' > "$TMPDIR/.claude/.env"
RESULT=$(CLAUDE_PROJECT_DIR="$TMPDIR" sh -c '. "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/load-dotenv.sh" && echo "${MEOWKIT_API_KEY}"')
[ "$RESULT" = "abc#123" ] && pass "quoted # preserved" || fail "quoted # preserved" "got [$RESULT]"
rm -rf "$TMPDIR"

# Test 3: Indented key whitespace trimmed
echo "Test 3: Indented key whitespace trimmed"
TMPDIR=$(make_tmp)
printf '  MEOWKIT_TDD=1\n' > "$TMPDIR/.claude/.env"
RESULT=$(CLAUDE_PROJECT_DIR="$TMPDIR" sh -c '. "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/load-dotenv.sh" && echo "${MEOWKIT_TDD}"')
[ "$RESULT" = "1" ] && pass "indented key trimmed" || fail "indented key trimmed" "got [$RESULT]"
rm -rf "$TMPDIR"

# Test 4: Dangerous key PATH blocked
echo "Test 4: PATH not hijacked by .env"
TMPDIR=$(make_tmp)
echo 'PATH=/evil/bin' > "$TMPDIR/.claude/.env"
ORIGINAL_PATH="$PATH"
RESULT=$(CLAUDE_PROJECT_DIR="$TMPDIR" sh -c '. "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/load-dotenv.sh" && echo "$PATH"')
[ "$RESULT" = "$ORIGINAL_PATH" ] && pass "PATH not hijacked" || fail "PATH not hijacked" "PATH changed to $RESULT"
rm -rf "$TMPDIR"

# Test 5: Invalid key (starts with digit) skipped, valid key still loaded
echo "Test 5: Invalid key name skipped"
TMPDIR=$(make_tmp)
cat > "$TMPDIR/.claude/.env" <<'EOF'
1INVALID=value
MEOWKIT_VALID=works
KEY WITH SPACE=value
MEOWKIT_AFTER=after
EOF
# Just verify the valid keys loaded (invalid ones are silently skipped)
RESULT=$(CLAUDE_PROJECT_DIR="$TMPDIR" sh -c '. "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/load-dotenv.sh" && echo "${MEOWKIT_VALID:-missing}|${MEOWKIT_AFTER:-missing}"')
[ "$RESULT" = "works|after" ] && pass "valid keys loaded, invalid keys skipped without error" || fail "invalid key handling" "got [$RESULT]"
rm -rf "$TMPDIR"

# Test 6: settings.json contains env field (Phase 0)
echo "Test 6: settings.json has native env field"
if node -e "const s=JSON.parse(require('fs').readFileSync('$MEOWKIT_ROOT/.claude/settings.json')); process.exit(s.env && s.env.MEOWKIT_BUILD_VERIFY ? 0 : 1)" 2>/dev/null; then
  pass "settings.json env block present"
else
  fail "settings.json env block" "MEOWKIT_BUILD_VERIFY not in settings.json env"
fi

# Test 7: Agent config block appears in SessionStart stdout for NEW session
echo "Test 7: Agent config block emitted on new session"
cd "$MEOWKIT_ROOT"
rm -f session-state/last-session-id-test 2>/dev/null
OUTPUT=$(echo '{"session_id":"verify-test-'"$$"'","hook_event_name":"SessionStart"}' | \
  CLAUDE_PROJECT_DIR="$MEOWKIT_ROOT" \
  MEOWKIT_TDD=1 \
  sh "$MEOWKIT_ROOT/.claude/hooks/project-context-loader.sh" 2>&1)
echo "$OUTPUT" | grep -q "## MeowKit Config" && pass "config block emitted" || fail "config block" "not found in stdout"

# Test 8: Config block NOT duplicated on session resume
echo "Test 8: Config block gated on resume (same session id)"
# Previous test wrote the session id — second call with same id should skip the block
OUTPUT2=$(echo '{"session_id":"verify-test-'"$$"'","hook_event_name":"SessionStart"}' | \
  CLAUDE_PROJECT_DIR="$MEOWKIT_ROOT" \
  sh "$MEOWKIT_ROOT/.claude/hooks/project-context-loader.sh" 2>&1)
echo "$OUTPUT2" | grep -q "## MeowKit Config" && fail "resume gating" "block duplicated on resume" || pass "config block gated on resume"

echo ""
echo "═══ Results: $PASS passed, $FAIL failed ═══"
[ $FAIL -eq 0 ] && exit 0 || exit 1
