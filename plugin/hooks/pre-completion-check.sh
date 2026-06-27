#!/bin/bash
# pre-completion-check.sh — Block session Stop when no verification evidence exists.
# Phase 7 middleware — PreCompletion verification from LangChain harness research.
#
# Registered: Stop event ONLY (NOT SubagentStop — that would infinite-loop inside subagents).
# Input: JSON on stdin (parsed via lib/read-hook-input.sh).
# Behavior:
#   - Check for test run evidence, evaluator verdict, or contract sign-off in the current session
#
# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
#   - If missing AND attempts < 3 AND density != LEAN: emit JSON block decision
#   - If missing AND attempts >= 3: soft nudge (avoid infinite loop)
#   - If present: clear attempts counter; exit 0
#
# Density bypass: LEAN falls back to soft nudge; MINIMAL skipped entirely.
# Env var bypass: MEOWKIT_PRECOMPLETION=off
set -u

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Bypass
[ "${MEOWKIT_PRECOMPLETION:-on}" = "off" ] && exit 0

# Density bypass
case "${MEOWKIT_AUTOBUILD_MODE:-}" in
  MINIMAL) exit 0 ;;
  LEAN)
    # Soft nudge only — trust the model
    echo "Note: verification not enforced in LEAN mode. Ensure you ran tests / evaluator before stopping." >&2
    exit 0
    ;;
esac

# Parse JSON on stdin
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi

STATE_DIR="session-state"
ATTEMPTS_FILE="$STATE_DIR/precompletion-attempts.json"
mkdir -p "$STATE_DIR"

PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
command -v "$PY" >/dev/null 2>&1 || exit 0

# Verification gate (root-cause fix):
# enforce ONLY when mk:cook or mk:autobuild explicitly marks verification-required.
VERIFICATION_REQUIRED_FILE="session-state/verification-required.json"
if [ ! -f "$VERIFICATION_REQUIRED_FILE" ]; then
  exit 0
fi

VERIFICATION_REQUIRED=$("$PY" -c "
import json
try:
    with open('$VERIFICATION_REQUIRED_FILE') as f:
        d = json.load(f)
    print('1' if d.get('required', True) else '0')
except Exception:
    print('1')
" 2>/dev/null)
if [ "${VERIFICATION_REQUIRED:-1}" != "1" ]; then
  exit 0
fi

# Resolve explicit active-plan only (no newest-plan fallback for blocking decisions).
ACTIVE_PLAN=""
ACTIVE_PLAN_SLUG=""
if [ -f "session-state/active-plan.json" ]; then
  ACTIVE_PLAN=$("$PY" -c "
import json
try:
    with open('session-state/active-plan.json') as f:
        d = json.load(f)
    print((d.get('path') or d.get('slug') or '').strip())
except Exception:
    print('')
" 2>/dev/null)
fi

# Legacy fallback kept for compatibility during state migration.
if [ -z "$ACTIVE_PLAN" ] && [ -f "session-state/active-plan" ]; then
  ACTIVE_PLAN=$(cat session-state/active-plan 2>/dev/null | tr -d '\n' | tr -d '\r')
fi

ACTIVE_PLAN_SLUG=$("$PY" -c "
import re
raw = '''$ACTIVE_PLAN'''.strip()
if not raw:
    print('')
else:
    raw = raw.rstrip('/')
    slug = raw.split('/')[-1]
    m = re.match(r'^[0-9]{6}(?:-[0-9]{4})?-(.+)$', slug)
    print(m.group(1) if m else slug)
" 2>/dev/null)

if [ -z "${ACTIVE_PLAN_SLUG:-}" ]; then
  ACTIVE_PLAN_SLUG=$("$PY" -c "
import json, re
try:
    with open('$VERIFICATION_REQUIRED_FILE') as f:
        d = json.load(f)
    raw = (d.get('slug') or d.get('plan_slug') or '').strip()
    m = re.match(r'^[0-9]{6}(?:-[0-9]{4})?-(.+)$', raw)
    print(m.group(1) if m else raw)
except Exception:
    print('')
" 2>/dev/null)
fi

# Without explicit active plan slug, do not block stopping.
if [ -z "${ACTIVE_PLAN_SLUG:-}" ]; then
  echo "verification-required set but active plan slug missing; skipping block." >&2
  exit 0
fi

SLUG="$ACTIVE_PLAN_SLUG"

# Verification evidence check — any ONE of these satisfies
HAS_VERIFICATION=0

# 1. Evaluator verdict file exists for this slug
for f in tasks/reviews/[0-9]*-"$SLUG"-evalverdict.md; do
  [ -f "$f" ] && HAS_VERIFICATION=1 && break
done

# 2. Signed sprint contract exists for this slug
if [ "$HAS_VERIFICATION" -eq 0 ]; then
  for c in tasks/contracts/*-"$SLUG"-sprint-*.md; do
    [ -f "$c" ] || continue
    STATUS=$(grep -E '^status:[[:space:]]*' "$c" | head -1 | sed -E 's/^status:[[:space:]]*//' | tr -d ' ')
    case "$STATUS" in
      signed|amended) HAS_VERIFICATION=1 ; break ;;
    esac
  done
fi

# 3. Trace log shows test evidence (P13 — capped scan)
if [ "$HAS_VERIFICATION" -eq 0 ] && [ -f ".claude/memory/trace-log.jsonl" ]; then
  if tail -n 500 .claude/memory/trace-log.jsonl 2>/dev/null | grep -qE '"test_result":[[:space:]]*"pass"|"exit_code":[[:space:]]*0.*"test"'; then
    HAS_VERIFICATION=1
  fi
fi

# 4. mk:review verdict file exists (regular Gate 2)
if [ "$HAS_VERIFICATION" -eq 0 ]; then
  for f in tasks/reviews/[0-9]*-"$SLUG"-verdict.md; do
    [ -f "$f" ] && HAS_VERIFICATION=1 && break
  done
fi

# Read/update attempts counter (P15 — robust parse)
ATTEMPTS=$("$PY" -c "
import json
try:
    with open('$ATTEMPTS_FILE') as f:
        d = json.load(f)
    print(d.get('$SLUG', 0))
except Exception:
    print(0)
" 2>/dev/null)
ATTEMPTS=${ATTEMPTS:-0}

if [ "$HAS_VERIFICATION" -eq 1 ]; then
  # Clear counter and allow stop
  "$PY" -c "
import json
try:
    with open('$ATTEMPTS_FILE') as f:
        d = json.load(f)
except Exception:
    d = {}
d.pop('$SLUG', None)
with open('$ATTEMPTS_FILE', 'w') as f:
    json.dump(d, f)
" 2>/dev/null || true
  exit 0
fi

# No verification AND under attempts cap → block via JSON
if [ "$ATTEMPTS" -lt 3 ]; then
  NEW_ATTEMPTS=$((ATTEMPTS + 1))
  "$PY" -c "
import json
try:
    with open('$ATTEMPTS_FILE') as f:
        d = json.load(f)
except Exception:
    d = {}
d['$SLUG'] = $NEW_ATTEMPTS
with open('$ATTEMPTS_FILE', 'w') as f:
    json.dump(d, f)
" 2>/dev/null || true

  cat <<EOF
{"decision":"block","reason":"Verification missing for active plan '${ACTIVE_PLAN:-$SLUG}' (attempt $NEW_ATTEMPTS/3). No evaluator verdict, no signed contract, and no test-pass markers found in this session. Run tests, invoke /mk:evaluate, OR sign the sprint contract before stopping."}
EOF
  exit 0
fi

# Over attempts cap → soft nudge, give up to avoid infinite loop
echo "@@PRECOMPLETION_NUDGE@@" >&2
echo "Max PreCompletion re-entries reached ($ATTEMPTS/3) for '$ACTIVE_PLAN'. Allowing stop to prevent infinite loop." >&2
echo "WARN: session ending without verification evidence. This is a soft nudge — please run verification before your next session." >&2

# Clear counter so next session starts fresh
"$PY" -c "
import json
try:
    with open('$ATTEMPTS_FILE') as f:
        d = json.load(f)
except Exception:
    d = {}
d.pop('$SLUG', None)
with open('$ATTEMPTS_FILE', 'w') as f:
    json.dump(d, f)
" 2>/dev/null || true

exit 0
