#!/bin/bash
# run-canary.sh — Execute the canary benchmark suite against the current harness.
#
# Usage:  run-canary.sh [--full] [--budget N]
#         run-canary.sh check-cap <ledger.jsonl> [cap]   # enforce the cost cap between tasks
# Exit:   0 all tasks completed / cap not reached; 1 infra failure; 2 cost cap reached (halt)
# Reqs:   Bash 3.2+, .agents/skills/.venv/bin/python3
#
# Quick tier (default): 5 tasks under .codex/benchmarks/canary/quick/, ≤$5
# Full tier (--full): quick + 1 heavy task under .codex/benchmarks/canary/full/, ≤$30
# Budget: --budget N or MEOWKIT_BUDGET_CAP override the tier cap (harness-rules Rule 6:
#         warn at $30, halt at the effective cap — the override may be lower OR higher).
set -u

# Rule 6 fixed warn threshold (USD). The hard cap is the effective (tier/override) cap.
WARN_USD=30

# check-cap subcommand: sum costUsd across a JSONL ledger and enforce the cap. The orchestrator
# calls this after appending each task's receipt, so a runaway loop halts at the shell boundary
# with the SAME semantics the TypeScript cost-ledger enforces for the (deferred) live backends.
if [ "${1:-}" = "check-cap" ]; then
  LEDGER="${2:-}"
  CAP="${MEOWKIT_BUDGET_CAP:-${3:-100}}"
  [ -f "$LEDGER" ] || { echo "ERROR: ledger not found: $LEDGER" >&2; exit 1; }
  PY=".agents/skills/.venv/bin/python3"; [ -x "$PY" ] || PY="python3"
  LEDGER="$LEDGER" CAP="$CAP" WARN_USD="$WARN_USD" "$PY" - <<'PYEOF'
import json, os, sys
cap = float(os.environ["CAP"]); warn = float(os.environ["WARN_USD"])
total = 0.0
for line in open(os.environ["LEDGER"], encoding="utf-8"):
    line = line.strip()
    if line:
        try: total += float(json.loads(line).get("costUsd") or 0)
        except Exception: pass
if total >= cap:
    print(f"HALT: cost cap reached: ${total:.2f} >= ${cap:.2f}"); sys.exit(2)
if cap > warn and total >= warn:
    print(f"WARN: ${total:.2f} >= ${warn:.0f} (cap ${cap:.2f})")
else:
    print(f"OK: ${total:.2f} of ${cap:.2f}")
sys.exit(0)
PYEOF
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
# MEOWKIT_BUDGET_CAP overrides the tier/flag cap (Rule 6 operator override).
[ -n "${MEOWKIT_BUDGET_CAP:-}" ] && COST_CAP="$MEOWKIT_BUDGET_CAP"

# Resolve project root
[ -n "$(git rev-parse --show-toplevel):-}" ] && cd "$(git rev-parse --show-toplevel)"

BENCH_DIR=".codex/benchmarks"
RESULTS_DIR="$BENCH_DIR/results"
mkdir -p "$RESULTS_DIR"

PY=".agents/skills/.venv/bin/python3"
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
# orchestrator picks up. Each invocation requires a fresh sub-task context, which is
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
MODEL="${MEOWKIT_MODEL_HINT:-the project environment:-unknown}}" \
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
print("Manifest: " + os.environ["RESULT_FILE"])
'

echo ""

# Phase 8 C2 fix (260408): emit `benchmark_result` trace record INLINE so the trace
# store has at least one record per benchmark invocation, even if the orchestrator
# never finishes filling in per-task results. Links back to the manifest path so
# mk:trace-analyze can correlate.
if [ -x ".codex/hooks/append-trace.sh" ]; then
  RUN_MODEL="${MEOWKIT_MODEL_HINT:-the project environment:-unknown}}"
  bash .codex/hooks/append-trace.sh "benchmark_result" \
    "{\"run_id\":\"$RUN_ID\",\"tier\":\"$TIER\",\"model\":\"$RUN_MODEL\",\"manifest_path\":\"$RESULT_FILE\"}" 2>/dev/null || true
fi

echo "═══════════════════════════════════════════════════════════════"
echo "ORCHESTRATOR HANDOFF (this script is intentionally a half-impl —"
echo "the per-task harness invocation requires fresh sub-task contexts"
echo "which only the orchestrator can spawn). Orchestrator must now:"
echo "  1. For each PENDING task in $RESULT_FILE:"
echo "     - Read the spec file"
echo "     - Invoke the autobuild skill with the spec content"
echo "     - Capture the verdict, score, duration, cost"
echo "     - Update the task entry in $RESULT_FILE"
echo "     - Append a receipt to the ledger, then enforce the cap BEFORE the next task:"
echo "         echo '{\"name\":\"<task>\",\"costUsd\":<cost>}' >> $LEDGER_FILE"
echo "         bash .agents/skills/benchmark/scripts/run-canary.sh check-cap $LEDGER_FILE $COST_CAP"
echo "       (exit 2 = cap reached — STOP the run; do not start further tasks)"
echo "  2. After all tasks complete, set status='complete', compute summary"
echo "  3. Append a benchmark_result trace record:"
echo "     bash .codex/hooks/append-trace.sh benchmark_result \"\$(cat $RESULT_FILE)\""
echo "═══════════════════════════════════════════════════════════════"

echo "RUN_ID=$RUN_ID"
echo "LEDGER=$LEDGER_FILE"
echo "COST_CAP=$COST_CAP"
exit 0
