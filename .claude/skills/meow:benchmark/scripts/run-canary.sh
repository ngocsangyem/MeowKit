#!/bin/bash
# run-canary.sh — Execute the canary benchmark suite against the current harness.
#
# Usage:  run-canary.sh [--full]
# Exit:   0 if all tasks completed (regardless of verdict); 1 on infrastructure failure
# Reqs:   Bash 3.2+, .claude/skills/.venv/bin/python3
#
# Quick tier (default): 5 tasks under .claude/benchmarks/canary/quick/, ≤$5
# Full tier (--full): quick + 1 heavy task under .claude/benchmarks/canary/full/, ≤$30
set -u

TIER="quick"
COST_CAP=5
case "${1:-}" in
  --full) TIER="full"; COST_CAP=30 ;;
  -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
  "") ;;
  *) echo "ERROR: unknown arg: $1" >&2; exit 1 ;;
esac

# Resolve project root
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && cd "$CLAUDE_PROJECT_DIR"

BENCH_DIR=".claude/benchmarks"
RESULTS_DIR="$BENCH_DIR/results"
mkdir -p "$RESULTS_DIR"

PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
command -v "$PY" >/dev/null 2>&1 || { echo "ERROR: python3 not found" >&2; exit 1; }

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
STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "═══════════════════════════════════════════════════════════════"
echo "Benchmark Run: $RUN_ID (tier: $TIER)"
echo "Specs: ${#SPECS[@]} task(s)"
echo "Cost cap: \$${COST_CAP}"
echo "Started: $STARTED"
echo "═══════════════════════════════════════════════════════════════"

# Iterate specs and invoke meow:harness per spec.
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
# shell→Python injection from spec filenames containing quotes
TASKS_JSON="$TASKS_JSON" \
RUN_ID="$RUN_ID" \
TIER="$TIER" \
STARTED="$STARTED" \
MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-unknown}}" \
COST_CAP="$COST_CAP" \
RESULT_FILE="$RESULT_FILE" \
"$PY" -c '
import json, os
manifest = {
    "run_id": os.environ["RUN_ID"],
    "tier": os.environ["TIER"],
    "started": os.environ["STARTED"],
    "ended": None,
    "harness_version": "3.0.0",
    "model": os.environ["MODEL"],
    "cost_cap_usd": float(os.environ["COST_CAP"]),
    "total_cost_usd": 0.0,
    "total_duration_seconds": 0,
    "tasks": json.loads(os.environ["TASKS_JSON"]),
    "summary": {"passed": 0, "warned": 0, "failed": 0, "average_score": 0.0},
    "status": "in_progress"
}
with open(os.environ["RESULT_FILE"], "w") as f:
    json.dump(manifest, f, indent=2)
print(f"Manifest: {os.environ[\"RESULT_FILE\"]}")
'

echo ""

# Phase 8 C2 fix (260408): emit `benchmark_result` trace record INLINE so the trace
# store has at least one record per benchmark invocation, even if the orchestrator
# never finishes filling in per-task results. Links back to the manifest path so
# meow:trace-analyze can correlate.
if [ -x ".claude/hooks/append-trace.sh" ]; then
  RUN_MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-unknown}}"
  bash .claude/hooks/append-trace.sh "benchmark_result" \
    "{\"run_id\":\"$RUN_ID\",\"tier\":\"$TIER\",\"model\":\"$RUN_MODEL\",\"manifest_path\":\"$RESULT_FILE\"}" 2>/dev/null || true
fi

echo "═══════════════════════════════════════════════════════════════"
echo "ORCHESTRATOR HANDOFF (this script is intentionally a half-impl —"
echo "the per-task harness invocation requires fresh subagent contexts"
echo "which only the orchestrator can spawn). Orchestrator must now:"
echo "  1. For each PENDING task in $RESULT_FILE:"
echo "     - Read the spec file"
echo "     - Invoke /meow:harness with the spec content"
echo "     - Capture the verdict, score, duration, cost"
echo "     - Update the task entry in $RESULT_FILE"
echo "  2. After all tasks complete, set status='complete', compute summary"
echo "  3. Append a benchmark_result trace record:"
echo "     bash .claude/hooks/append-trace.sh benchmark_result \"\$(cat $RESULT_FILE)\""
echo "═══════════════════════════════════════════════════════════════"

echo "RUN_ID=$RUN_ID"
exit 0
