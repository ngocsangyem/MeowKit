#!/bin/sh
# validate-gate-2.sh — Check a review or security verdict has no blocking state for Gate 2
# Usage: sh validate-gate-2.sh <path-to-verdict-or-review-output>
# Can also read from stdin: echo "Score: 9/10..." | sh validate-gate-2.sh -
# Exit 0 = GATE_2_READY, Exit 1 = GATE_2_BLOCKED

set -e

INPUT="${1:--}"
VERDICT_KIND="review"
case "$INPUT" in
  *-security-verdict.md) VERDICT_KIND="security" ;;
esac

if [ "$INPUT" = "-" ]; then
  CONTENT=$(cat)
elif [ -f "$INPUT" ]; then
  CONTENT=$(cat "$INPUT")
else
  echo "GATE_2_BLOCKED: File not found: $INPUT"
  exit 1
fi

# Check for FAIL dimensions — match structured patterns only to avoid false positives
# Matches structured verdict states only, including the security agent's
# documented `Verdict: BLOCK` form and Markdown-table findings. Incidental
# prose such as "blocked by" is deliberately ignored.
FAIL_COUNT=$(printf '%s\n' "$CONTENT" | grep -ciE '^FAIL:|: FAIL|VERDICT[[:space:]]*:?[[:space:]]*(FAIL|BLOCK)|^BLOCK:|GATE.*BLOCK|^\|[^|]*\|[[:space:]]*(FAIL|BLOCK)[[:space:]]*\|' 2>/dev/null || true)
FAIL_COUNT=$(echo "$FAIL_COUNT" | tr -d '[:space:]')
FAIL_COUNT=${FAIL_COUNT:-0}

# Check for critical issues (critical_count > 0 or "Critical (N)" where N > 0)
CRITICAL=$(echo "$CONTENT" | grep -oiE 'Critical \([0-9]+\)' 2>/dev/null | grep -oE '[0-9]+' | head -1)
CRITICAL=${CRITICAL:-0}

# Check for side-effect signal (positive-presence-only; absence = no block)
# Block when "Side Effects Detected: Yes" is present AND no User Decision Addendum follows.
# Must be plaintext line at start-of-line — markdown headers (## Side Effects ...) are NOT recognized.
# Addendum detection is substring-match (any of: User Decision Addendum, User selected:, Resumption point:);
# verdict authors should keep these strings out of quoted user prose to avoid false negatives.
SIDE_EFFECT=$(printf '%s\n' "$CONTENT" | grep -cE '^Side Effects Detected: Yes' 2>/dev/null || true)
SIDE_EFFECT=$(echo "$SIDE_EFFECT" | tr -d '[:space:]')
SIDE_EFFECT=${SIDE_EFFECT:-0}
ADDENDUM=0
if [ "$SIDE_EFFECT" -gt 0 ]; then
  ADDENDUM=$(printf '%s\n' "$CONTENT" | grep -cE 'User Decision Addendum|User selected:|Resumption point:' 2>/dev/null || true)
  ADDENDUM=$(echo "$ADDENDUM" | tr -d '[:space:]')
  ADDENDUM=${ADDENDUM:-0}
fi

# Extract score if present
SCORE=$(echo "$CONTENT" | grep -oiE '[0-9]+(\.[0-9]+)?/10' 2>/dev/null | head -1 | cut -d/ -f1)
SCORE=${SCORE:-0}

ISSUES=""

if [ "$FAIL_COUNT" -gt 0 ]; then
  ISSUES="$ISSUES has-FAIL-dimensions($FAIL_COUNT)"
fi

if [ "$CRITICAL" -gt 0 ]; then
  ISSUES="$ISSUES critical-issues($CRITICAL)"
fi

if [ "$SIDE_EFFECT" -gt 0 ] && [ "$ADDENDUM" -eq 0 ]; then
  ISSUES="$ISSUES side-effects-without-addendum"
fi

if [ -n "$ISSUES" ]; then
  echo "GATE_2_BLOCKED:$ISSUES — $VERDICT_KIND verdict, score: $SCORE/10"
  echo "Human approval required to override."
  exit 1
fi

echo "GATE_2_READY — $VERDICT_KIND verdict, score: $SCORE/10, 0 critical, 0 FAIL"
exit 0
