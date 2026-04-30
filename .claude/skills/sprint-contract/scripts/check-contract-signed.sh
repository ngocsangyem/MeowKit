#!/usr/bin/env bash
# check-contract-signed.sh — Gate helper: verifies a signed sprint contract exists
# for the active task. Used by gate-enforcement.sh on Edit/Write of source files.
#
# Usage:  check-contract-signed.sh
# Exit:   0 if a signed contract exists OR LEAN mode bypass active
#         1 if no signed contract for the active sprint
#         2 on usage / environment error
# Reqs:   Bash 3.2+. Tested macOS BSD + GNU coreutils.
#
# Behavior:
#   1. If MEOWKIT_HARNESS_MODE=LEAN  → exit 0 (LEAN mode bypass per adaptive density policy)
#   2. Resolve active plan dir (newest tasks/plans/YYMMDD-* directory)
#   3. Look for signed contract at tasks/contracts/{slug}-sprint-{N}.md where status: signed
#   4. Exit 0 if found, 1 otherwise
set -u

# 1. LEAN/MINIMAL mode bypass — per harness-rules.md Rule 3:
#    MINIMAL (Haiku) = contract skipped, LEAN (Opus 4.6+) = contract optional
if [ "${MEOWKIT_HARNESS_MODE:-}" = "LEAN" ] || [ "${MEOWKIT_HARNESS_MODE:-}" = "MINIMAL" ]; then
  # Log the bypass for audit (per security considerations) but don't block
  if [ -d ".claude" ]; then
    log_file=".claude/memory/lean-bypass.log"
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) MEOWKIT_HARNESS_MODE=LEAN bypassed contract gate" >> "$log_file" 2>/dev/null || true
  fi
  exit 0
fi

# 2. Locate the active plan directory (newest tasks/plans/YYMMDD-* directory).
# Per Phase 4 spec + red-team P10: ls | grep | sort | head pattern.
if [ ! -d "tasks/plans" ]; then
  # No plans directory at all — defer to Gate 1 (which has its own enforcement).
  # We don't claim contract gate authority over a project with no plans.
  exit 0
fi

active_plan_dir=""
# shellcheck disable=SC2012
# Match both YYMMDD- and YYMMDD-HHMM- prefixes (closes red-team M5).
for d in $(ls tasks/plans/ 2>/dev/null | grep -E '^[0-9]{6}(-[0-9]{4})?-' | sort -r); do
  if [ -d "tasks/plans/$d" ]; then
    active_plan_dir="$d"
    break
  fi
done

if [ -z "$active_plan_dir" ]; then
  # No date-prefixed plan dirs found (e.g., flat-file plans only). Defer.
  exit 0
fi

# Extract the slug — strip BOTH `YYMMDD-` and optional `HHMM-` prefix.
slug=$(echo "$active_plan_dir" | sed -E 's/^[0-9]{6}-([0-9]{4}-)?//')

# 3. Look for any signed contract file matching this task slug.
# Contract path: tasks/contracts/{date}-{slug}-sprint-{N}.md
if [ ! -d "tasks/contracts" ]; then
  echo "@@CONTRACT_GATE_BLOCK@@" >&2
  echo "No tasks/contracts/ directory exists." >&2
  echo "Phase 4 sprint contract is required for source code edits on plan: $active_plan_dir" >&2
  echo "" >&2
  echo "To proceed, do ONE of:" >&2
  echo "  1. Run: /mk:sprint-contract propose $slug" >&2
  echo "  2. Set: export MEOWKIT_HARNESS_MODE=LEAN  (skips contract for Opus 4.6 tier)" >&2
  exit 1
fi

# Find a signed contract for this slug.
# `signed` status accepts as-is. `amended` status REQUIRES both signature
# fields populated (closes red-team M1 — stale-sig window when amendment
# was appended but agents haven't re-signed yet).
signed=0
for contract in tasks/contracts/*-"$slug"-sprint-*.md; do
  [ -f "$contract" ] || continue
  status_line=$(grep -E '^status:[[:space:]]*' "$contract" | head -1 | sed -E 's/^status:[[:space:]]*//' | tr -d ' ')
  case "$status_line" in
    signed)
      signed=1
      break
      ;;
    amended)
      # Extract sig fields and strip surrounding quotes/whitespace.
      # Round 2 M6 fix: previously `generator_signed: "null"` (quoted) bypassed the check.
      gen_sig=$(grep -E '^generator_signed:[[:space:]]*' "$contract" | head -1 | sed -E 's/^generator_signed:[[:space:]]*//' | tr -d ' "'"'"'')
      eval_sig=$(grep -E '^evaluator_signed:[[:space:]]*' "$contract" | head -1 | sed -E 's/^evaluator_signed:[[:space:]]*//' | tr -d ' "'"'"'')
      # Reject empty, "null", "pending", "todo" placeholder values.
      case "$gen_sig" in ""|null|pending|todo|TODO) continue ;; esac
      case "$eval_sig" in ""|null|pending|todo|TODO) continue ;; esac
      signed=1
      break
      ;;
  esac
done

if [ "$signed" -eq 1 ]; then
  exit 0
fi

# No signed contract found
echo "@@CONTRACT_GATE_BLOCK@@" >&2
echo "No signed sprint contract found for task '$slug'." >&2
echo "Active plan: tasks/plans/$active_plan_dir/plan.md" >&2
echo "" >&2
echo "Phase 4 sprint contract gate requires a signed contract before source edits." >&2
echo "" >&2
echo "To proceed, do ONE of:" >&2
echo "  1. Run: /mk:sprint-contract propose $slug" >&2
echo "     Then: /mk:sprint-contract sign (after evaluator review)" >&2
echo "  2. Set: export MEOWKIT_HARNESS_MODE=LEAN  (Opus 4.6 LEAN mode bypass)" >&2
exit 1
