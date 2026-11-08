#!/bin/bash
# run-canary.sh — Execute the canary benchmark suite against the current harness.
#
# Usage:  run-canary.sh [--full] [--budget N]
#         run-canary.sh check-cap <ledger.jsonl> [cap]   # enforce the cost cap between tasks
# Exit:   0 all tasks completed / cap not reached; 1 infra failure; 2 cost cap reached (halt)
# Reqs:   Bash 3.2+, node
#
# Quick tier (default): 5 tasks under .claude/benchmarks/canary/quick/, ≤$5
# Full tier (--full): quick + 1 heavy task under .claude/benchmarks/canary/full/, ≤$30
# Budget: --budget N or `budget.cap` in .meowkit/config.yaml override the tier cap
#         (harness-rules Rule 6: warn at $30, halt at the effective cap — the
#         override may be lower OR higher). A cap of 0 means "no override".
set -u

# Rule 6 fixed warn threshold (USD). The hard cap is the effective (tier/override) cap.
WARN_USD=30

# The reader ships beside this script, in the kit. Which PROJECT it answers for
# is CLAUDE_PROJECT_DIR, or the working directory, and the reader resolves that
# itself — so a kit invoked from outside its own tree still reads the right file.
CONFIG_READER="$(dirname "$0")/../../../hooks/lib/config-get.cjs"

# One resolved config value, or the fallback. The cap must not fail shut on an
# unreadable config, so every failure path yields the caller's own default.
config_get() {
  if command -v node >/dev/null 2>&1 && [ -f "$CONFIG_READER" ]; then
    node "$CONFIG_READER" "$1" "$2" 2>/dev/null || printf '%s\n' "$2"
  else
    printf '%s\n' "$2"
  fi
}

# `budget.cap` when it is set to something other than "no cap", else empty.
configured_cap() {
  cap=$(config_get budget.cap 0)
  case "$cap" in
    ''|0) printf '' ;;
    *) printf '%s' "$cap" ;;
  esac
}

# check-cap subcommand: sum costUsd across a JSONL ledger and enforce the cap. The orchestrator
# calls this after appending each task's receipt, so a runaway loop halts at the shell boundary
# with the SAME semantics the TypeScript cost-ledger enforces for the (deferred) live backends.
if [ "${1:-}" = "check-cap" ]; then
  LEDGER="${2:-}"
  CAP=$(configured_cap)
  [ -n "$CAP" ] || CAP="${3:-100}"
  [ -f "$LEDGER" ] || { echo "ERROR: ledger not found: $LEDGER" >&2; exit 1; }
  LEDGER="$LEDGER" CAP="$CAP" WARN_USD="$WARN_USD" node "$(dirname "$0")/lib/check-cost-cap.cjs"
  exit $?
fi

TIER="quick"
COST_CAP=5
while [ $# -gt 0 ]; do
  case "$1" in
    --full) TIER="full"; COST_CAP=30 ;;
    --budget) shift; COST_CAP="${1:-}"; [ -n "$COST_CAP" ] || { echo "ERROR: --budget needs a value" >&2; exit 1; } ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    "") ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done
# `budget.cap` overrides the tier/flag cap (Rule 6 operator override).
CONFIG_CAP=$(configured_cap)
[ -n "$CONFIG_CAP" ] && COST_CAP="$CONFIG_CAP"

# Resolve project root
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && cd "$CLAUDE_PROJECT_DIR"

BENCH_DIR=".claude/benchmarks"
RESULTS_DIR="$BENCH_DIR/results"
mkdir -p "$RESULTS_DIR"

# Collect spec files for the tier
SPECS=()
if [ -d "$BENCH_DIR/canary/quick" ]; then
  for f in "$BENCH_DIR/canary/quick"/*.md; do
    [ -f "$f" ] && SPECS+=("$f")
  done
fi
if [ "$TIER" = "full" ] && [ -d "$BENCH_DIR/canary/full" ]; then
  for f in "$BENCH_DIR/canary/full"/*.md; do
    [ -f "$f" ] && SPECS+=("$f")
  done
fi

if [ ${#SPECS[@]} -eq 0 ]; then
  echo "ERROR: no canary spec files found in $BENCH_DIR/canary/${TIER}/" >&2
  exit 1
fi

RUN_ID=$(date +%y%m%d-%H%M%S)-bench  # second precision prevents same-minute collisions
RESULT_FILE="$RESULTS_DIR/${RUN_ID}.json"
LEDGER_FILE="$RESULTS_DIR/${RUN_ID}.ledger.jsonl"  # append one {costUsd,...} receipt per task
STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "═══════════════════════════════════════════════════════════════"
echo "Benchmark Run: $RUN_ID (tier: $TIER)"
echo "Specs: ${#SPECS[@]} task(s)"
echo "Cost cap: \$${COST_CAP}"
echo "Started: $STARTED"
echo "═══════════════════════════════════════════════════════════════"

# Iterate specs and invoke mk:autobuild per spec.
# NOTE: this script does NOT actually invoke harness here — it emits a manifest the
# orchestrator picks up. Each invocation requires a fresh subagent context, which is
# the orchestrator's job (not a shell script's). The script's role is to enumerate +
# record results once the orchestrator returns them.
TASKS_JSON="["
FIRST=1
for spec in "${SPECS[@]}"; do
  [ "$FIRST" = "0" ] && TASKS_JSON="${TASKS_JSON},"
  TASK_NAME=$(basename "$spec" -spec.md)
  TASKS_JSON="${TASKS_JSON}{\"spec\":\"$spec\",\"name\":\"$TASK_NAME\",\"verdict\":\"PENDING\",\"weighted_score\":null,\"duration_seconds\":null,\"cost_usd\":null}"
  FIRST=0
  echo "  [PENDING] $TASK_NAME"
done
TASKS_JSON="${TASKS_JSON}]"

# Write the initial manifest — pass dynamic values via env vars to avoid
# shell injection from spec filenames containing quotes
TASKS_JSON="$TASKS_JSON" \
RUN_ID="$RUN_ID" \
TIER="$TIER" \
STARTED="$STARTED" \
MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-unknown}}" \
COST_CAP="$COST_CAP" \
RESULT_FILE="$RESULT_FILE" \
node "$(dirname "$0")/lib/write-run-manifest.cjs"

echo ""

# Phase 8 C2 fix (260408): emit `benchmark_result` trace record INLINE so the trace
# store has at least one record per benchmark invocation, even if the orchestrator
# never finishes filling in per-task results. Links back to the manifest path so
# mk:trace-analyze can correlate.
if [ -x ".claude/hooks/append-trace.cjs" ]; then
  RUN_MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-unknown}}"
  node .claude/hooks/append-trace.cjs "benchmark_result" \
    "{\"run_id\":\"$RUN_ID\",\"tier\":\"$TIER\",\"model\":\"$RUN_MODEL\",\"manifest_path\":\"$RESULT_FILE\"}" 2>/dev/null || true
fi

echo "═══════════════════════════════════════════════════════════════"
echo "ORCHESTRATOR HANDOFF (this script is intentionally a half-impl —"
echo "the per-task harness invocation requires fresh subagent contexts"
echo "which only the orchestrator can spawn). Orchestrator must now:"
echo "  1. For each PENDING task in $RESULT_FILE:"
echo "     - Read the spec file"
echo "     - Invoke /mk:autobuild with the spec content"
echo "     - Capture the verdict, score, duration, cost"
echo "     - Update the task entry in $RESULT_FILE"
echo "     - Append a receipt to the ledger, then enforce the cap BEFORE the next task:"
echo "         echo '{\"name\":\"<task>\",\"costUsd\":<cost>}' >> $LEDGER_FILE"
echo "         bash .claude/skills/benchmark/scripts/run-canary.sh check-cap $LEDGER_FILE $COST_CAP"
echo "       (exit 2 = cap reached — STOP the run; do not start further tasks)"
echo "  2. After all tasks complete, set status='complete', compute summary"
echo "  3. Append a benchmark_result trace record:"
echo "     node .claude/hooks/append-trace.cjs benchmark_result \"\$(cat $RESULT_FILE)\""
echo "═══════════════════════════════════════════════════════════════"

echo "RUN_ID=$RUN_ID"
echo "LEDGER=$LEDGER_FILE"
echo "COST_CAP=$COST_CAP"
exit 0
