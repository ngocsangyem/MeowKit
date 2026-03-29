#!/bin/sh
# validate-gate-2.sh — Check review verdict has no FAIL dimensions for Gate 2
# Usage: sh validate-gate-2.sh <path-to-verdict-or-review-output>
# Can also read from stdin: echo "Score: 9/10..." | sh validate-gate-2.sh -
# Exit 0 = GATE_2_READY, Exit 1 = GATE_2_BLOCKED

set -e

INPUT="${1:--}"

if [ "$INPUT" = "-" ]; then
  CONTENT=$(cat)
elif [ -f "$INPUT" ]; then
  CONTENT=$(cat "$INPUT")
else
  echo "GATE_2_BLOCKED: File not found: $INPUT"
  exit 1
fi

# Check for FAIL dimensions — match structured patterns only to avoid false positives
# Matches: "FAIL", "VERDICT: FAIL", "Security: FAIL", "BLOCK" at word boundaries
FAIL_COUNT=$(printf '%s\n' "$CONTENT" | grep -c '^FAIL:\|: FAIL\|VERDICT.*FAIL\|^BLOCK:\|GATE.*BLOCK' 2>/dev/null || true)
FAIL_COUNT=$(echo "$FAIL_COUNT" | tr -d '[:space:]')
FAIL_COUNT=${FAIL_COUNT:-0}

# Check for critical issues (critical_count > 0 or "Critical (N)" where N > 0)
CRITICAL=$(echo "$CONTENT" | grep -oi 'Critical ([0-9]\+)' 2>/dev/null | grep -o '[0-9]\+' | head -1)
CRITICAL=${CRITICAL:-0}

# Extract score if present
SCORE=$(echo "$CONTENT" | grep -oi '[0-9]\+\(\.[0-9]\+\)\?/10' 2>/dev/null | head -1 | cut -d/ -f1)
SCORE=${SCORE:-0}

ISSUES=""

if [ "$FAIL_COUNT" -gt 0 ]; then
  ISSUES="$ISSUES has-FAIL-dimensions($FAIL_COUNT)"
fi

if [ "$CRITICAL" -gt 0 ]; then
  ISSUES="$ISSUES critical-issues($CRITICAL)"
fi

if [ -n "$ISSUES" ]; then
  echo "GATE_2_BLOCKED:$ISSUES — score: $SCORE/10"
  echo "Human approval required to override."
  exit 1
fi

echo "GATE_2_READY — score: $SCORE/10, 0 critical, 0 FAIL"
exit 0
